#!/usr/bin/env python3
"""Reviewer call script for research-refine skill.

Maintains conversation state in a JSON thread file for multi-round continuity.
Prints the reviewer response to stdout and exits 0 on success.
Exits 1 on failure so the caller can fallback to another reviewer path.

Auto-detected backends, in order:
1. Logged-in coding CLIs: codex, claude, gemini
2. THIRD_PARTY_API_BASE + THIRD_PARTY_API_KEY
3. OPENAI_API_KEY (+ optional OPENAI_BASE_URL / OPENAI_API_BASE)
4. GEMINI_API_KEY or GOOGLE_API_KEY
"""

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
PARENT_DIR = SCRIPT_DIR.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

from scripts.runtime_cli import detect_cli_runtime, run_text_prompt


OPENAI_DEFAULT_BASE = "https://api.openai.com/v1"
GEMINI_DEFAULT_MODEL = "gemini-2.5-pro"


def read_prompt(path: pathlib.Path) -> str:
    if not path.exists():
        print(f"ERROR: prompt file not found: {path}", file=sys.stderr)
        sys.exit(1)
    return path.read_text(encoding="utf-8")


def load_thread_state(thread_path: pathlib.Path) -> dict:
    if not thread_path.exists():
        return {"messages": [], "runtime": None}
    try:
        data = json.loads(thread_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"messages": [], "runtime": None}
    if isinstance(data, list):
        return {"messages": data, "runtime": None}
    if isinstance(data, dict):
        return {"messages": data.get("messages", []), "runtime": data.get("runtime")}
    return {"messages": [], "runtime": None}


def save_thread_state(thread_path: pathlib.Path, state: dict) -> None:
    thread_path.parent.mkdir(parents=True, exist_ok=True)
    thread_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def http_post_json(url: str, headers: dict, payload: dict, timeout: int = 180) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"ERROR: HTTP {exc.code}: {body[:500]}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    except TimeoutError:
        print("ERROR: Request timed out.", file=sys.stderr)
        sys.exit(1)


def detect_api_provider() -> tuple:
    third_party_base = os.environ.get("THIRD_PARTY_API_BASE", "").rstrip("/")
    third_party_key = os.environ.get("THIRD_PARTY_API_KEY", "")
    if third_party_base and third_party_key:
        return ("openai-compatible", third_party_base, third_party_key)

    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if openai_key:
        base = (
            os.environ.get("OPENAI_BASE_URL", "").rstrip("/")
            or os.environ.get("OPENAI_API_BASE", "").rstrip("/")
            or OPENAI_DEFAULT_BASE
        )
        return ("openai-compatible", base, openai_key)

    gemini_key = os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")
    if gemini_key:
        return ("gemini", "https://generativelanguage.googleapis.com/v1beta", gemini_key)

    print(
        "ERROR: No reviewer API backend configured. Set one of: "
        "THIRD_PARTY_API_BASE + THIRD_PARTY_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY.",
        file=sys.stderr,
    )
    sys.exit(1)


def gemini_model_name(requested_model: str) -> str:
    if requested_model.startswith("gemini-"):
        return requested_model
    return os.environ.get("GEMINI_REVIEWER_MODEL", GEMINI_DEFAULT_MODEL)


def call_openai_compatible(base_url: str, api_key: str, model: str, reasoning_effort: str, messages: list) -> str:
    payload = {"model": model, "messages": messages}
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort
    data = http_post_json(
        f"{base_url}/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        payload,
    )
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        print(f"ERROR: Unexpected OpenAI-compatible response format: {exc}", file=sys.stderr)
        print(json.dumps(data)[:500], file=sys.stderr)
        sys.exit(1)


def call_gemini(api_key: str, model: str, messages: list) -> str:
    contents = []
    for message in messages:
        role = "model" if message.get("role") == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": message.get("content", "")}]})

    encoded_model = urllib.parse.quote(model, safe="-_.")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{encoded_model}:generateContent?key={urllib.parse.quote(api_key, safe='')}"
    )
    payload = {"contents": contents}
    data = http_post_json(url, {}, payload)
    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "\n".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
    except (KeyError, IndexError, TypeError) as exc:
        print(f"ERROR: Unexpected Gemini response format: {exc}", file=sys.stderr)
        print(json.dumps(data)[:500], file=sys.stderr)
        sys.exit(1)


def build_cli_prompt(messages: list) -> str:
    parts = [
        "You are continuing a multi-round external review conversation.",
        "Preserve the same reviewer role and standards across rounds.",
        "Below is the conversation history in chronological order.",
        "",
    ]
    for message in messages[:-1]:
        role = message.get("role", "user").upper()
        parts.append(f"[{role}]")
        parts.append(message.get("content", ""))
        parts.append("")
    parts.append("[NEW USER MESSAGE]")
    parts.append(messages[-1].get("content", ""))
    parts.append("")
    parts.append("Respond only with the reviewer reply for the newest user message.")
    return "\n".join(parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-file", required=True, help="File containing the user prompt")
    parser.add_argument("--thread-file", required=True, help="JSON file storing conversation history")
    parser.add_argument("--model", default="gpt-5.4")
    parser.add_argument("--reasoning-effort", default="high")
    parser.add_argument("--runtime", choices=["auto", "codex", "claude", "gemini", "api"], default="auto")
    args = parser.parse_args()

    prompt_path = pathlib.Path(args.prompt_file)
    thread_path = pathlib.Path(args.thread_file)
    prompt = read_prompt(prompt_path)
    thread_state = load_thread_state(thread_path)
    messages = thread_state["messages"]
    messages.append({"role": "user", "content": prompt})

    previous_runtime = thread_state.get("runtime")
    provider = None
    backend = None
    api_key = None

    if args.runtime == "api":
        provider, backend, api_key = detect_api_provider()
    elif args.runtime in {"codex", "claude", "gemini"}:
        cli_runtime = detect_cli_runtime(args.runtime, args.model)
        if not cli_runtime:
            print(f"ERROR: Requested CLI runtime is not available: {args.runtime}", file=sys.stderr)
            sys.exit(1)
        provider, backend, api_key = ("cli", cli_runtime, None)
    else:
        if previous_runtime in {"codex", "claude", "gemini"}:
            cli_runtime = detect_cli_runtime(previous_runtime, args.model)
            if cli_runtime:
                provider, backend, api_key = ("cli", cli_runtime, None)
        if provider is None:
            cli_runtime = detect_cli_runtime("auto", args.model)
            if cli_runtime:
                provider, backend, api_key = ("cli", cli_runtime, None)
        if provider is None:
            provider, backend, api_key = detect_api_provider()

    if provider == "cli":
        content = run_text_prompt(
            build_cli_prompt(messages),
            runtime=backend,
            model=args.model,
            cwd=thread_path.parent,
            timeout=300,
        )
        thread_state["runtime"] = backend
    elif provider == "openai-compatible":
        content = call_openai_compatible(backend, api_key, args.model, args.reasoning_effort, messages)
        thread_state["runtime"] = "api-openai-compatible"
    else:
        content = call_gemini(api_key, gemini_model_name(args.model), messages)
        thread_state["runtime"] = "api-gemini"

    messages.append({"role": "assistant", "content": content})
    thread_state["messages"] = messages
    save_thread_state(thread_path, thread_state)
    print(content)


if __name__ == "__main__":
    main()
