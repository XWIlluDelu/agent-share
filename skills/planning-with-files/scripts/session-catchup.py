#!/usr/bin/env python3
"""
Session Catchup Script for planning-with-files

Analyzes prior agent session logs to find unsynced context after the last
planning file update. Designed to run at session start as a best-effort
recovery helper.

Supported backends:
- Claude legacy project sessions in ~/.claude/projects/<sanitized-path>/*.jsonl
- Codex native sessions in ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
- Gemini native chats in ~/.gemini/tmp/<project-id>/chats/session-*.json

Usage: python3 session-catchup.py [project-path]
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

PLANNING_FILES = ["task_plan.md", "progress.md", "findings.md"]


def normalize_path(project_path: str) -> str:
    """Normalize a path for backends that sanitize project paths."""
    p = project_path
    if len(p) >= 3 and p[0] == "/" and p[2] == "/":
        p = p[1].upper() + ":" + p[2:]
    try:
        p = str(Path(p).resolve())
    except (OSError, ValueError):
        pass
    return p


def normalize_for_compare(path: str) -> str:
    return os.path.normcase(os.path.abspath(path))


def extract_planning_file(text: str) -> Optional[str]:
    for name in PLANNING_FILES:
        if text.endswith(name) or f"/{name}" in text or f"\\{name}" in text:
            return name
    return None


def decode_json_maybe(raw: str) -> Dict:
    try:
        return json.loads(raw)
    except Exception:
        return {}


def extract_planning_file_from_patch(patch_text: str) -> Optional[str]:
    for line in patch_text.splitlines():
        if line.startswith("*** Add File: ") or line.startswith("*** Update File: "):
            _, path = line.split(": ", 1)
            found = extract_planning_file(path.strip())
            if found:
                return found
    return None


def build_tool_event(index: int, tool_name: str, details: str, file_name: Optional[str]) -> Dict:
    return {
        "index": index,
        "role": "tool",
        "tool_name": tool_name,
        "details": details[:300],
        "planning_file": file_name,
    }


def parse_claude_legacy_session(session_file: Path) -> List[Dict]:
    records: List[Dict] = []
    with session_file.open("r", encoding="utf-8", errors="replace") as handle:
        for index, line in enumerate(handle):
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            is_meta = msg.get("isMeta", False)
            if msg_type == "user" and not is_meta:
                content = msg.get("message", {}).get("content", "")
                if isinstance(content, list):
                    content = next(
                        (
                            item.get("text", "")
                            for item in content
                            if isinstance(item, dict) and item.get("type") == "text"
                        ),
                        "",
                    )
                if isinstance(content, str) and content and not content.startswith(
                    ("<local-command", "<command-", "<task-notification")
                ):
                    records.append({"index": index, "role": "user", "content": content[:600]})
                continue

            if msg_type != "assistant":
                continue

            text_content = ""
            tools: List[str] = []
            for item in msg.get("message", {}).get("content", []) or []:
                if item.get("type") == "text":
                    text_content = item.get("text", "")
                elif item.get("type") == "tool_use":
                    tool_name = item.get("name", "")
                    tool_input = item.get("input", {}) or {}
                    file_path = tool_input.get("file_path", "")
                    planning_file = extract_planning_file(file_path)
                    if tool_name in ("Write", "Edit") and planning_file:
                        records.append(
                            build_tool_event(index, tool_name, file_path, planning_file)
                        )
                    elif tool_name == "Bash":
                        tools.append(f"Bash: {tool_input.get('command', '')[:120]}")
                    elif tool_name:
                        tools.append(tool_name)

            if text_content or tools:
                records.append(
                    {
                        "index": index,
                        "role": "assistant",
                        "content": text_content[:600],
                        "tools": tools[:4],
                    }
                )
    return records


def iter_claude_legacy_sessions(project_path: str) -> Iterable[Path]:
    normalized = normalize_path(project_path)
    sanitized = normalized.replace("\\", "-").replace("/", "-").replace(":", "-")
    sanitized = sanitized.replace("_", "-")
    if sanitized.startswith("-"):
        sanitized = sanitized[1:]
    project_dir = Path.home() / ".claude" / "projects" / sanitized
    if project_dir.exists():
        yield from sorted(
            [p for p in project_dir.glob("*.jsonl") if not p.name.startswith("agent-")],
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )


def parse_codex_session(session_file: Path) -> Tuple[Optional[str], List[Dict]]:
    cwd = None
    records: List[Dict] = []
    with session_file.open("r", encoding="utf-8", errors="replace") as handle:
        for index, line in enumerate(handle):
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {}) or {}

            if msg_type == "session_meta":
                cwd = payload.get("cwd")
                continue

            if msg_type == "event_msg":
                event_type = payload.get("type")
                if event_type == "user_message":
                    text = payload.get("message", "")
                    if text:
                        records.append({"index": index, "role": "user", "content": text[:600]})
                elif event_type == "agent_message":
                    text = payload.get("message", "")
                    if text:
                        records.append({"index": index, "role": "assistant", "content": text[:600]})
                continue

            if msg_type != "response_item":
                continue

            item_type = payload.get("type")
            if item_type == "function_call":
                tool_name = payload.get("name", "")
                arguments = decode_json_maybe(payload.get("arguments", ""))
            elif item_type == "custom_tool_call":
                tool_name = payload.get("name", "")
                arguments = {"input": payload.get("input", "")}
            else:
                continue

            planning_file = None
            details = ""

            if "file_path" in arguments:
                details = arguments.get("file_path", "")
                planning_file = extract_planning_file(details)
            elif tool_name == "apply_patch":
                details = arguments.get("input", "")
                planning_file = extract_planning_file_from_patch(details)
            elif tool_name == "exec_command":
                details = arguments.get("cmd", "")[:160]

            records.append(build_tool_event(index, tool_name, details, planning_file))

    return cwd, records


def iter_codex_sessions(project_path: str) -> Iterable[Path]:
    target = normalize_for_compare(project_path)
    sessions_root = Path.home() / ".codex" / "sessions"
    if not sessions_root.exists():
        return []

    matching: List[Tuple[float, Path]] = []
    for session_file in sessions_root.rglob("rollout-*.jsonl"):
        cwd, _ = parse_codex_session(session_file)
        if cwd and normalize_for_compare(cwd) == target:
            matching.append((session_file.stat().st_mtime, session_file))

    return [path for _, path in sorted(matching, key=lambda item: item[0], reverse=True)]


def parse_gemini_session(session_file: Path) -> List[Dict]:
    try:
        data = json.loads(session_file.read_text(encoding="utf-8"))
    except Exception:
        return []

    records: List[Dict] = []
    for index, message in enumerate(data.get("messages", [])):
        msg_type = message.get("type")
        if msg_type == "user":
            content = message.get("content", [])
            if isinstance(content, list):
                text = " ".join(part.get("text", "") for part in content if isinstance(part, dict))
            else:
                text = str(content)
            if text:
                records.append({"index": index, "role": "user", "content": text[:600]})
            continue

        if msg_type != "gemini":
            continue

        text = message.get("content", "")
        tools: List[str] = []
        tool_calls = message.get("toolCalls", []) or []
        for call in tool_calls:
            tool_name = call.get("name", "")
            args = call.get("args", {}) or {}
            file_path = args.get("file_path", "")
            planning_file = extract_planning_file(file_path)
            if planning_file and tool_name in ("write_file", "replace", "edit_file", "save_file"):
                records.append(build_tool_event(index, tool_name, file_path, planning_file))
            elif tool_name:
                details = file_path or args.get("command", "")[:160]
                tools.append(f"{tool_name}: {details}".strip(": "))

        if text or tools:
            records.append(
                {
                    "index": index,
                    "role": "assistant",
                    "content": str(text)[:600],
                    "tools": tools[:4],
                }
            )
    return records


def iter_gemini_sessions(project_path: str) -> Iterable[Path]:
    projects_path = Path.home() / ".gemini" / "projects.json"
    if not projects_path.exists():
        return []

    try:
        projects = json.loads(projects_path.read_text(encoding="utf-8")).get("projects", {})
    except Exception:
        return []

    project_id = projects.get(str(Path(project_path).resolve()))
    if not project_id:
        return []

    chats_dir = Path.home() / ".gemini" / "tmp" / project_id / "chats"
    if not chats_dir.exists():
        return []

    return sorted(chats_dir.glob("session-*.json"), key=lambda path: path.stat().st_mtime, reverse=True)


def find_last_planning_update(records: List[Dict]) -> Tuple[int, Optional[str]]:
    last_index = -1
    last_file = None
    for record in records:
        if record.get("role") == "tool" and record.get("planning_file"):
            last_index = record["index"]
            last_file = record["planning_file"]
    return last_index, last_file


def extract_messages_after(records: List[Dict], after_index: int) -> List[Dict]:
    return [
        record
        for record in records
        if record.get("role") in {"user", "assistant", "tool"} and record["index"] > after_index
    ]


def format_backend_name(name: str) -> str:
    return {
        "claude-legacy": "Claude legacy",
        "codex": "Codex",
        "gemini": "Gemini",
    }.get(name, name)


def find_best_session(project_path: str) -> Tuple[Optional[str], Optional[Path], List[Dict], int, Optional[str]]:
    backends = [
        ("codex", iter_codex_sessions(project_path), parse_codex_session),
        ("gemini", iter_gemini_sessions(project_path), parse_gemini_session),
        ("claude-legacy", iter_claude_legacy_sessions(project_path), parse_claude_legacy_session),
    ]

    for backend_name, sessions, parser in backends:
        for session_file in sessions:
            if session_file.stat().st_size < 500:
                continue
            parsed = parser(session_file)
            if backend_name == "codex":
                _, records = parsed
            else:
                records = parsed
            last_index, last_file = find_last_planning_update(records)
            if last_index < 0:
                continue
            messages_after = extract_messages_after(records, last_index)
            if messages_after:
                return backend_name, session_file, messages_after, last_index, last_file
    return None, None, [], -1, None


def print_catchup(backend: str, session_file: Path, messages_after: List[Dict], last_index: int, last_file: str) -> None:
    print("\n[planning-with-files] SESSION CATCHUP DETECTED")
    print(f"Backend: {format_backend_name(backend)}")
    print(f"Previous session: {session_file.stem}")
    print(f"Last planning update: {last_file} at record #{last_index}")
    print(f"Unsynced records: {len(messages_after)}")

    print("\n--- UNSYNCED CONTEXT ---")
    for record in messages_after[-15:]:
        role = record.get("role")
        if role == "user":
            print(f"USER: {record.get('content', '')[:300]}")
        elif role == "assistant":
            if record.get("content"):
                print(f"ASSISTANT: {record.get('content', '')[:300]}")
            if record.get("tools"):
                print(f"  Tools: {', '.join(record['tools'][:4])}")
        elif role == "tool":
            detail = record.get("details", "")
            print(f"TOOL: {record.get('tool_name', 'tool')} {detail[:200]}".rstrip())

    print("\n--- RECOMMENDED ---")
    print("1. Run: git diff --stat")
    print("2. Read: task_plan.md, progress.md, findings.md")
    print("3. Update planning files based on above context")
    print("4. Continue with task")


def main():
    project_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    if not any(Path(project_path, name).exists() for name in PLANNING_FILES):
        return

    backend, session_file, messages_after, last_index, last_file = find_best_session(project_path)
    if not backend or not session_file or last_index < 0 or not last_file:
        return

    print_catchup(backend, session_file, messages_after, last_index, last_file)


if __name__ == "__main__":
    main()
