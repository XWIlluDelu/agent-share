#!/usr/bin/env python3
"""Codex Stop hook helper for planning-with-files."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PLANNING_FILES = ("task_plan.md", "progress.md", "findings.md")


def load_event() -> dict:
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def main() -> None:
    event = load_event()
    cwd = Path(event.get("cwd") or ".").resolve()
    existing = [name for name in PLANNING_FILES if (cwd / name).exists()]
    if not existing:
        return

    payload = {
        "continue": True,
        "systemMessage": (
            "Before ending the turn, make sure planning files are synced: "
            + ", ".join(existing)
            + "."
        ),
    }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
