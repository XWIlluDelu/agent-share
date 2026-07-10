#!/usr/bin/env python3
"""Self-test for panel write-back and graph seams.

Standard library only; leaves nothing behind.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import threading
import urllib.error
import urllib.request
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
    check('purpose: "new line"' in updated, "scalar frontmatter values stay inline and YAML-safe")
    check("progress: not-started" in updated, "unrelated frontmatter survives")
    fm, body = panel.split_frontmatter_raw("---\na: b\n---x\n# Body\n")
    check(fm is None and body.startswith("---\na: b"), "frontmatter delimiter must be a line by itself")

    print("path containment")
    outside = write(tmp / "unit-extra/hack.md", "---\nprogress: not-started\n---\n# Hack\n")
    ok, msg = panel.apply_edit(root, {"path": "../unit-extra/hack.md", "field": "progress", "from": "not-started", "to": "done"})
    check(not ok and "bad path" in msg, "sibling prefix path is rejected")
    check("done" not in outside.read_text(encoding="utf-8"), "rejected path is not written")

    print("field patches")
    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "content", "from": "old", "to": "one\ntwo"})
    text = spec.read_text(encoding="utf-8")
    check(ok and 'purpose: "one two"' in text, "content writes an inline YAML-safe purpose")

    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "after", "from": "old-a", "to": "b, c"})
    text = spec.read_text(encoding="utf-8")
    check(ok and 'after: ["b", "c"]' in text and "  - old-a" not in text, "list fields replace old block lists")

    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "covers", "from": "old-c", "to": "src/{a,b}/**, tests/**"})
    text = spec.read_text(encoding="utf-8")
    check(ok and 'covers: ["src/{a,b}/**", "tests/**"]' in text, "brace-glob covers are quoted as valid YAML")
    g = panel.build_graph(root / "docdoki")
    check(g["nodes"][0]["covers"] == ["src/{a,b}/**", "tests/**"], "brace-glob covers parse without splitting braces")

    ok, _ = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "claim", "i": 2, "from": "duplicate", "to": "third"})
    lines = spec.read_text(encoding="utf-8").splitlines()
    check(ok, "claim edit succeeds by index")
    check(lines.count("- duplicate") == 2 and "- third" in lines, "claim edit changes the indexed Goal bullet only")
    notes_i = lines.index("## Notes")
    check(lines[notes_i + 2] == "- duplicate", "claim edit does not touch non-Goal bullets")

    before = spec.read_text(encoding="utf-8")
    ok, msg = panel.apply_edit(root, {"path": "docdoki/specs/a.md", "field": "section", "section": "Missing", "from": "", "to": "x"})
    check(not ok and msg == "section not found", "missing section is reported")
    check(spec.read_text(encoding="utf-8") == before, "missing section does not rewrite file")

    batch_before = spec.read_text(encoding="utf-8")
    results = panel.apply_edits(root, [
        {"path": "docdoki/specs/a.md", "field": "progress", "from": "not-started", "to": "done"},
        {"path": "docdoki/specs/a.md", "field": "section", "section": "Missing", "from": "", "to": "x"},
    ])
    check(results == [(False, "not written: batch failed"), (False, "section not found")], "failed batches report no writes")
    check(spec.read_text(encoding="utf-8") == batch_before, "failed batches are atomic")

    other = spec.with_name("b.md")
    other.write_text("---\npurpose: old\nprogress: not-started\n---\n# B\n", encoding="utf-8")
    originals = {spec: spec.read_text(encoding="utf-8"), other: other.read_text(encoding="utf-8")}
    real_atomic_write = panel.atomic_write
    writes = 0

    def fail_second_write(path, text):
        nonlocal writes
        writes += 1
        if writes == 2:
            raise OSError("injected replacement failure")
        real_atomic_write(path, text)

    panel.atomic_write = fail_second_write
    try:
        results = panel.apply_edits(root, [
            {"path": "docdoki/specs/a.md", "field": "progress", "from": "not-started", "to": "done"},
            {"path": "docdoki/specs/b.md", "field": "content", "from": "old", "to": "new"},
        ])
    finally:
        panel.atomic_write = real_atomic_write
    check(all(not ok and "rolled back" in msg for ok, msg in results), "write failure reports rollback")
    check(all(path.read_text(encoding="utf-8") == text for path, text in originals.items()),
          "write failure rolls back completed replacements")

    external = "---\npurpose: external\nprogress: not-started\n---\n# B\n"
    changed_other = False

    def change_other_after_first_write(path, text):
        nonlocal changed_other
        real_atomic_write(path, text)
        if path == spec and not changed_other:
            changed_other = True
            other.write_text(external, encoding="utf-8")

    panel.atomic_write = change_other_after_first_write
    try:
        results = panel.apply_edits(root, [
            {"path": "docdoki/specs/a.md", "field": "progress", "from": "not-started", "to": "done"},
            {"path": "docdoki/specs/b.md", "field": "content", "from": "old", "to": "new"},
        ])
    finally:
        panel.atomic_write = real_atomic_write
    check(all(not ok and "conflict:" in msg for ok, msg in results),
          "mid-save external change is reported as a conflict")
    check(spec.read_text(encoding="utf-8") == originals[spec], "mid-save conflict rolls back earlier replacement")
    check(other.read_text(encoding="utf-8") == external, "mid-save conflict preserves the external change")

    print("YAML-safe values and stale writes")
    for value in ('Auth: token #1', '[literal, text]', 'true', '123', '2026-07-10', 'say "hello"'):
        encoded = panel.set_fm_scalar("---\npurpose: old\n---\n# A\n", "purpose", value)
        parsed, _ = panel.split_frontmatter(encoded)
        check(parsed.get("purpose") == value, f"scalar round-trips: {value}")
    parsed, _ = panel.split_frontmatter('---\ncovers: ["src/{a,b}/**", "tests/**"]\n---\n# A\n')
    check(parsed.get("covers") == ["src/{a,b}/**", "tests/**"], "quoted brace-glob list round-trips")

    stale_before = spec.read_text(encoding="utf-8")
    ok, msg = panel.apply_edit(root, {
        "path": "docdoki/specs/a.md", "field": "content", "from": "old panel value", "to": "stale edit",
    })
    check(not ok and msg.startswith("conflict:"), "stale field edit is rejected")
    check(spec.read_text(encoding="utf-8") == stale_before, "stale edit leaves the file unchanged")

    print("save request authentication")
    token = "secret"
    origin = "http://127.0.0.1:8765"
    good_headers = {"Host": "127.0.0.1:8765", "Content-Type": "application/json", "X-DocDoki-Token": token, "Origin": origin}
    check(panel.save_request_error(good_headers, token, origin) is None, "same-origin tokenized JSON save is accepted")
    check(panel.save_request_error({"Host": "127.0.0.1:8765", "Content-Type": "text/plain", "X-DocDoki-Token": token}, token, origin)[0] == 415,
          "simple cross-origin content type is rejected")
    check(panel.save_request_error({"Host": "127.0.0.1:8765", "Content-Type": "application/json"}, token, origin)[0] == 403,
          "missing save token is rejected")
    check(panel.save_request_error({**good_headers, "Host": "evil.example:8765"}, token, origin)[0] == 403,
          "DNS-rebinding host is rejected")
    check(panel.save_request_error({**good_headers, "Origin": "https://evil.example"}, token, origin)[0] == 403,
          "cross-origin save is rejected")
    check('const SAVE_TOKEN="secret"' in panel.render(root / "docdoki", "secret"), "rendered panel carries the process token")

    print("HTTP save integration")
    panel.Handler.dd = root / "docdoki"
    panel.Handler.save_token = token
    server = panel.ThreadingHTTPServer(("127.0.0.1", 0), panel.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    payload = json.dumps({"edits": [
        {"path": "docdoki/specs/a.md", "field": "content", "from": "one two", "to": "saved over HTTP"},
    ]}).encode()
    try:
        page = urllib.request.urlopen(base + "/").read().decode()
        check('const SAVE_TOKEN="secret"' in page, "GET renders the active save token")
        try:
            urllib.request.urlopen(urllib.request.Request(
                base + "/save", data=payload, headers={"Content-Type": "application/json"},
            ))
            missing_token_status = 200
        except urllib.error.HTTPError as ex:
            missing_token_status = ex.code
        check(missing_token_status == 403, "HTTP save without token is rejected")
        request = urllib.request.Request(base + "/save", data=payload, headers={
            "Content-Type": "application/json", "X-DocDoki-Token": token, "Origin": base,
        })
        result = json.loads(urllib.request.urlopen(request).read())
        check(result["ok"] and panel.split_frontmatter(spec.read_text(encoding="utf-8"))[0]["purpose"] == "saved over HTTP",
              "tokenized same-origin HTTP save writes the addressed field")
        stale = json.loads(urllib.request.urlopen(request).read())
        check(not stale["ok"], "replayed stale HTTP save is rejected")
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

    print("graph payload")
    graph = panel.build_graph(root / "docdoki")
    check("edges" not in graph, "graph payload has no static edge snapshot")
    check(all("sclass" not in n for n in graph["nodes"]), "nodes omit dead sclass payload")


if __name__ == "__main__":
    raise SystemExit(main())
