#!/usr/bin/env python3
"""Self-test for panel write-back and graph seams.

Standard library only; leaves nothing behind.
"""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import panel  # noqa: E402

VERBOSE = "-v" in sys.argv
_fail = 0
_pass = 0


def check(cond: bool, label: str) -> None:
    global _fail, _pass
    if cond:
        _pass += 1
        if VERBOSE:
            print(f"  ok   {label}")
    else:
        _fail += 1
        print(f"  FAIL {label}")


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="docdoki-panel-test-"))
    try:
        run(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{_pass} passed, {_fail} failed")
    return 1 if _fail else 0


def run(tmp: Path) -> None:
    root = tmp / "unit"
    spec = write(root / "docdoki/specs/a.md", """---
purpose: old
progress: not-started
after:
  - old-a
covers: [old-c]
---
# Alpha

## Goal

- first
- duplicate
- duplicate

## Notes

- duplicate
""")

    print("frontmatter write-back")
    crlf = "---\r\npurpose: old\r\nprogress: not-started\r\n---\r\n# Title\r\n"
    updated = panel.set_fm_scalar(crlf, "purpose", "new\nline")
    check(updated.count("---") == 2, "CRLF frontmatter is updated, not duplicated")
    check("purpose: new line" in updated, "scalar frontmatter values stay inline")
    check("progress: not-started" in updated, "unrelated frontmatter survives")
    fm, body = panel.split_frontmatter_raw("---\na: b\n---x\n# Body\n")
    check(fm is None and body.startswith("---\na: b"), "frontmatter delimiter must be a line by itself")

    print("path containment")
    outside = write(tmp / "unit-extra/hack.md", "---\nprogress: not-started\n---\n# Hack\n")
    ok, msg = panel.apply_edit(root, {"path": "../unit-extra/hack.md", "field": "progress", "to": "done"})
    check(not ok and "bad path" in msg, "sibling prefix path is rejected")
    check("done" not in outside.read_text(encoding="utf-8"), "rejected path is not written")

    print("field patches")
    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "content", "to": "one\ntwo"})
    text = spec.read_text(encoding="utf-8")
    check(ok and "purpose: one two" in text, "content writes inline purpose")

    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "after", "to": "b, c"})
    text = spec.read_text(encoding="utf-8")
    check(ok and "after: [b, c]" in text and "  - old-a" not in text, "list fields replace old block lists")

    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "covers", "to": "src/{a,b}/**, tests/**"})
    text = spec.read_text(encoding="utf-8")
    check(ok and "covers: [src/{a,b}/**, tests/**]" in text, "brace-glob covers keep braces inline")
    g = panel.build_graph(root / "docdoki")
    check(g["nodes"][0]["covers"] == ["src/{a,b}/**", "tests/**"], "brace-glob covers parse without splitting braces")

    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "claim", "i": 2, "to": "third"})
    lines = spec.read_text(encoding="utf-8").splitlines()
    check(ok, "claim edit succeeds by index")
    check(lines.count("- duplicate") == 2 and "- third" in lines, "claim edit changes the indexed Goal bullet only")
    notes_i = lines.index("## Notes")
    check(lines[notes_i + 2] == "- duplicate", "claim edit does not touch non-Goal bullets")

    before = spec.read_text(encoding="utf-8")
    ok, msg = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "section", "section": "Missing", "to": "x"})
    check(not ok and msg == "section not found", "missing section is reported")
    check(spec.read_text(encoding="utf-8") == before, "missing section does not rewrite file")

    batch_before = spec.read_text(encoding="utf-8")
    results = panel.apply_edits(root, [
        {"path": "docdoki/specs/a.md", "field": "progress", "to": "done"},
        {"path": "docdoki/specs/a.md", "field": "section", "section": "Missing", "to": "x"},
    ])
    check(results == [(False, "not written: batch failed"), (False, "section not found")], "failed batches report no writes")
    check(spec.read_text(encoding="utf-8") == batch_before, "failed batches are atomic")

    print("graph payload")
    graph = panel.build_graph(root / "docdoki")
    check("edges" not in graph, "graph payload has no static edge snapshot")
    check(all("sclass" not in n for n in graph["nodes"]), "nodes omit dead sclass payload")


if __name__ == "__main__":
    raise SystemExit(main())
