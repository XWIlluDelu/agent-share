#!/usr/bin/env python3
"""Run trigger evaluation for a skill description.

Supports:
- native Claude CLI trigger detection
- heuristic Codex/Gemini CLI trigger detection via a temporary `.agents/skills`
  workspace plus an explicit used-skill marker in the final response
"""

from __future__ import annotations

import argparse
import json
import os
import re
import select
import subprocess
import sys
import tempfile
import time
import uuid
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PARENT_DIR = SCRIPT_DIR.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

from scripts.runtime_cli import detect_runtime, sanitize_env
from scripts.utils import parse_skill_md


USED_SKILL_RE = re.compile(r"<used_skill>\s*(true|false)\s*</used_skill>", re.IGNORECASE)


def find_project_root() -> Path:
    """Find the current project root based on known agent config directories."""
    current = Path.cwd()
    for parent in [current, *current.parents]:
        if (parent / ".claude").is_dir() or (parent / ".agents").is_dir() or (parent / ".gemini").is_dir():
            return parent
    return current


def _run_claude_query(
    query: str,
    skill_name: str,
    skill_description: str,
    timeout: int,
    project_root: str,
    model: str | None,
) -> bool:
    unique_id = uuid.uuid4().hex[:8]
    clean_name = f"{skill_name}-skill-{unique_id}"
    project_commands_dir = Path(project_root) / ".claude" / "commands"
    command_file = project_commands_dir / f"{clean_name}.md"

    try:
        project_commands_dir.mkdir(parents=True, exist_ok=True)
        indented_desc = "\n  ".join(skill_description.split("\n"))
        command_content = (
            f"---\n"
            f"description: |\n"
            f"  {indented_desc}\n"
            f"---\n\n"
            f"# {skill_name}\n\n"
            f"This skill handles: {skill_description}\n"
        )
        command_file.write_text(command_content)

        cmd = [
            "claude",
            "-p",
            query,
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
        ]
        if model:
            cmd.extend(["--model", model])

        env = sanitize_env()
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=project_root,
            env=env,
        )

        triggered = False
        start_time = time.time()
        buffer = ""
        pending_tool_name = None
        accumulated_json = ""

        try:
            while time.time() - start_time < timeout:
                if process.poll() is not None:
                    remaining = process.stdout.read()
                    if remaining:
                        buffer += remaining.decode("utf-8", errors="replace")
                    break

                ready, _, _ = select.select([process.stdout], [], [], 1.0)
                if not ready:
                    continue

                chunk = os.read(process.stdout.fileno(), 8192)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if event.get("type") == "stream_event":
                        se = event.get("event", {})
                        se_type = se.get("type", "")
                        if se_type == "content_block_start":
                            cb = se.get("content_block", {})
                            if cb.get("type") == "tool_use":
                                tool_name = cb.get("name", "")
                                if tool_name in ("Skill", "Read"):
                                    pending_tool_name = tool_name
                                    accumulated_json = ""
                                else:
                                    return False
                        elif se_type == "content_block_delta" and pending_tool_name:
                            delta = se.get("delta", {})
                            if delta.get("type") == "input_json_delta":
                                accumulated_json += delta.get("partial_json", "")
                                if clean_name in accumulated_json:
                                    return True
                        elif se_type in ("content_block_stop", "message_stop"):
                            if pending_tool_name:
                                return clean_name in accumulated_json
                            if se_type == "message_stop":
                                return False
                    elif event.get("type") == "assistant":
                        message = event.get("message", {})
                        for content_item in message.get("content", []):
                            if content_item.get("type") != "tool_use":
                                continue
                            tool_name = content_item.get("name", "")
                            tool_input = content_item.get("input", {})
                            if tool_name == "Skill" and clean_name in tool_input.get("skill", ""):
                                triggered = True
                            elif tool_name == "Read" and clean_name in tool_input.get("file_path", ""):
                                triggered = True
                            return triggered
                    elif event.get("type") == "result":
                        return triggered
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()

        return triggered
    finally:
        if command_file.exists():
            command_file.unlink()


def _run_generic_query(
    query: str,
    skill_name: str,
    skill_description: str,
    timeout: int,
    runtime: str,
    model: str | None,
) -> bool:
    clean_name = f"{skill_name}-eval"
    with tempfile.TemporaryDirectory(prefix=f"{runtime}-skill-eval-") as tmpdir:
        project_root = Path(tmpdir)
        skill_dir = project_root / ".agents" / "skills" / clean_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text(
            f"---\nname: {clean_name}\ndescription: {skill_description}\n---\n\n# {skill_name}\n"
        )

        if runtime == "codex":
            cmd = [
                "codex",
                "exec",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "--ephemeral",
                "-C",
                str(project_root),
                (
                    f'User query: "{query}"\n\n'
                    f'Work normally. After your answer, append <used_skill>true</used_skill> '
                    f'if you actually consulted the local skill named "{clean_name}" or read any file '
                    f'from .agents/skills/{clean_name}. Otherwise append <used_skill>false</used_skill>.'
                ),
            ]
            if model:
                cmd[2:2] = ["--model", model]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=project_root,
                env=sanitize_env(),
                timeout=timeout,
            )
            if result.returncode != 0:
                raise RuntimeError(f"codex exec exited {result.returncode}\nstderr: {result.stderr}")
            text = result.stdout
        else:
            cmd = [
                "gemini",
                "-p",
                (
                    f'User query: "{query}"\n\n'
                    f'Work normally. After your answer, append <used_skill>true</used_skill> '
                    f'if you actually consulted the local skill named "{clean_name}" or read any file '
                    f'from .agents/skills/{clean_name}. Otherwise append <used_skill>false</used_skill>.'
                ),
                "--output-format",
                "json",
                "--sandbox",
                "--approval-mode",
                "yolo",
            ]
            if model:
                cmd.extend(["--model", model])
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=project_root,
                env=sanitize_env(),
                timeout=timeout,
            )
            if result.returncode != 0:
                raise RuntimeError(f"gemini -p exited {result.returncode}\nstderr: {result.stderr}")
            try:
                text = json.loads(result.stdout).get("response", "")
            except json.JSONDecodeError:
                text = result.stdout

        match = USED_SKILL_RE.search(text)
        return bool(match and match.group(1).lower() == "true")


def run_single_query(
    query: str,
    skill_name: str,
    skill_description: str,
    timeout: int,
    project_root: str,
    runtime: str,
    model: str | None = None,
) -> bool:
    runtime = detect_runtime(runtime)
    if runtime == "claude":
        return _run_claude_query(query, skill_name, skill_description, timeout, project_root, model)
    return _run_generic_query(query, skill_name, skill_description, timeout, runtime, model)


def run_eval(
    eval_set: list[dict],
    skill_name: str,
    description: str,
    num_workers: int,
    timeout: int,
    project_root: Path,
    runs_per_query: int = 1,
    trigger_threshold: float = 0.5,
    model: str | None = None,
    runtime: str = "auto",
) -> dict:
    results = []

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        future_to_info = {}
        for item in eval_set:
            for run_idx in range(runs_per_query):
                future = executor.submit(
                    run_single_query,
                    item["query"],
                    skill_name,
                    description,
                    timeout,
                    str(project_root),
                    runtime,
                    model,
                )
                future_to_info[future] = (item, run_idx)

        query_triggers: dict[str, list[bool]] = {}
        query_items: dict[str, dict] = {}
        for future in as_completed(future_to_info):
            item, _ = future_to_info[future]
            query = item["query"]
            query_items[query] = item
            query_triggers.setdefault(query, [])
            try:
                query_triggers[query].append(future.result())
            except Exception as exc:
                print(f"Warning: query failed: {exc}", file=sys.stderr)
                query_triggers[query].append(False)

    for query, triggers in query_triggers.items():
        item = query_items[query]
        trigger_rate = sum(triggers) / len(triggers)
        should_trigger = item["should_trigger"]
        did_pass = trigger_rate >= trigger_threshold if should_trigger else trigger_rate < trigger_threshold
        results.append(
            {
                "query": query,
                "should_trigger": should_trigger,
                "trigger_rate": trigger_rate,
                "triggers": sum(triggers),
                "runs": len(triggers),
                "pass": did_pass,
            }
        )

    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    return {
        "runtime": detect_runtime(runtime),
        "skill_name": skill_name,
        "description": description,
        "results": results,
        "summary": {"total": total, "passed": passed, "failed": total - passed},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run trigger evaluation for a skill description")
    parser.add_argument("--eval-set", required=True, help="Path to eval set JSON file")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--description", default=None, help="Override description to test")
    parser.add_argument("--num-workers", type=int, default=10, help="Number of parallel workers")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout per query in seconds")
    parser.add_argument("--runs-per-query", type=int, default=3, help="Number of runs per query")
    parser.add_argument("--trigger-threshold", type=float, default=0.5, help="Trigger rate threshold")
    parser.add_argument("--model", default=None, help="Model to use for the selected CLI backend")
    parser.add_argument("--runtime", choices=["auto", "claude", "codex", "gemini"], default="auto", help="CLI backend to use for evaluation")
    parser.add_argument("--output", default=None, help="Output path for results JSON (default: stdout)")
    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    eval_path = Path(args.eval_set)
    if not eval_path.exists():
        print(f"Error: Eval set not found: {eval_path}", file=sys.stderr)
        sys.exit(1)

    eval_set = json.loads(eval_path.read_text())
    if not isinstance(eval_set, list):
        print("Error: eval set must be a JSON array", file=sys.stderr)
        sys.exit(1)

    skill_name, original_description, _ = parse_skill_md(skill_path)
    results = run_eval(
        eval_set=eval_set,
        skill_name=skill_name,
        description=args.description or original_description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        project_root=find_project_root(),
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        model=args.model,
        runtime=args.runtime,
    )

    output = json.dumps(results, indent=2)
    if args.output:
        Path(args.output).write_text(output)
    else:
        print(output)


if __name__ == "__main__":
    main()
