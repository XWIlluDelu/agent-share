#!/usr/bin/env python3
"""Project-local entrypoint. Copy to <unit>/docdoki/panel.py.

The Panel implementation stays in ~/.agent-share/lib/docdoki/panel/.
This entrypoint always opens its own unit, regardless of the working directory.
"""
import os
import sys
from pathlib import Path


if __name__ == "__main__":
    unit = Path(__file__).resolve().parent.parent
    panel = Path.home() / ".agent-share/lib/docdoki/panel/panel.py"
    os.execv(sys.executable, [
        sys.executable, "-B", str(panel), str(unit), *sys.argv[1:],
    ])
