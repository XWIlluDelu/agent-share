#!/usr/bin/env python3
"""Optional project-local panel launcher. Copy to <unit>/docdoki/panel.py if desired.

Prefer launching directly without copying into the library:
    python3 /path/to/docdoki/panel/panel.py /path/to/unit

When copied into <unit>/docdoki/panel.py, this launcher opens its own unit
regardless of working directory and resolves DocDoki from DOCDOKI_HOME or
~/.agent-share/lib/docdoki.
"""
import os
import sys
from pathlib import Path


def resolve_panel() -> Path:
    candidates = []
    if env_home := os.environ.get("DOCDOKI_HOME"):
        candidates.append(Path(env_home).expanduser() / "panel/panel.py")
    candidates.append(Path.home() / ".agent-share/lib/docdoki/panel/panel.py")
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    searched = ", ".join(str(c) for c in candidates)
    raise SystemExit(f"DocDoki panel not found (checked: {searched}). Set DOCDOKI_HOME.")


if __name__ == "__main__":
    unit = Path(__file__).resolve().parent.parent
    panel = resolve_panel()
    os.execv(sys.executable, [
        sys.executable, "-B", str(panel), str(unit), *sys.argv[1:],
    ])
