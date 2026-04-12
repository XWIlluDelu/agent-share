#!/usr/bin/env python3
"""Codex SessionStart hook helper for planning-with-files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


PLANNING_FILES = ("task_plan.md", "progress.md", "findings.md")
SCRIPT_DIR = Path(__file__).resolve().parent


def load_event() -> dict:
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def run_catchup(cwd: Path) -> str:
    script = SCRIPT_DIR / "session-catchup.py"
    if not script.exists():
        return ""
    try:
        result = subprocess.run(
            [sys.executable, str(script), str(cwd)],
            capture_output=True,
            text=True,
            timeout=12,
        )
    except Exception:
        return ""
    text = (result.stdout or "").strip()
    if not text:
        return ""
    return text[:1600]


def main() -> None:
    event = load_event()
    cwd = Path(event.get("cwd") or ".").resolve()
    existing = [name for name in PLANNING_FILES if (cwd / name).exists()]

    if not existing:
        return

    message_lines = [
        "Planning files detected in this project.",
        f"Read these before substantive work: {', '.join(existing)}.",
    ]

    catchup = run_catchup(cwd)
    if catchup:
        message_lines.append("")
        message_lines.append("Catchup summary:")
        message_lines.append(catchup)

    payload = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "\n".join(message_lines),
        }
    }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
