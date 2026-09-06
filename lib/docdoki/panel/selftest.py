#!/usr/bin/env python3
"""Backend regressions in temporary libraries. --serve supplies the browser test."""
from __future__ import annotations

import json
import signal
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

import documents
import graph
import panel
import storage

A = "docdoki/specs/a.md"
B = "docdoki/specs/b.md"


def write(root, path, text):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8", newline="") as stream:
        stream.write(text)
    return target


def fixture(root):
    write(root, "docdoki/northstar.md", "# Northstar\n\nIntroduction before sections.\n\n## Mission\nKeep exports local.\n")
    write(root, "docdoki/spec_abstract.md", """# Project overview

Introduction before headings remains visible.

## Design map

| Contract | Design |
| --- | --- |
| [[a]] | Local export only |
| [[b]] | Validate before delivery |

## Capabilities and gaps

CSV output exists. Atomic publication is not implemented yet.

## Current work

[[follow-export]] holds the current work and checks. See [[evidence]] for details.

## Human decisions

Decide whether to support network filesystems.
""")
    write(root, A, """---
purpose: Local export without network delivery.
covers: ['src/{a,b}/**', 'tests/**']
---
# Export

An introduction that is not a section.

## Goal

- Do not send rows
  to any remote service.

## Example

````md
## Goal
- This is code, not a contract.
````

## Checks

| Case | Expected |
| --- | --- |
| Failure | Destination unchanged |

## Non-goals

Never upload data. See [[evidence#Details]] and [validation](b.md).

## Repeated

First section.

## Repeated

Second section.
""")
    write(root, B, "---\npurpose: Validate local rows.\nafter: ['a']\nprogress: done\n---\n# Validation\n\n## Goal\n\n- Validate types.\n")
    write(root, "docdoki/stages/follow-export.md", "# Atomic export\n\n## Current state\n\nAtomic publication is not implemented in [[a]].\n\n## Next actions\n\n- [ ] Add failure checks.\n")
    write(root, "docdoki/notes/evidence.md", "# Evidence\n\n## Details\n\nA useful observation with a [spec link](../specs/a.md).\n")
    write(root, "docdoki/stages/archive/follow-old.md", "# Previous work\n\nArchived knowledge remains reachable.\n")
    write(root, "docdoki/private/specs/local.md", "---\npurpose: Private calibration.\nafter: [a]\n---\n# Local\n\n## Goal\n\n- Keep calibration local.\n")
    write(root, "docdoki/private/stages/follow-local.md", "# Local work\n\n## Current state\nPrivate inspection of [[local]].\n")


class PanelTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="docdoki-panel-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        fixture(self.root)

    def source(self, path=A):
        return documents.read_source(self.root / path)

    def edit(self, path=A, old=None, new=None):
        before = self.source(path) if old is None else old
        return {"path": path, "field": "source", "from": before, "to": new if new is not None else before + "\nA new constraint.\n"}

    def test_yaml_lists_and_scalars(self):
        for source, expected in [("after: ['a', 'b']", ["a", "b"]),
                                 ('after: ["a", "b"]', ["a", "b"]),
                                 ("after:\n- a\n- 'b'", ["a", "b"]),
                                 ("after:\n  - a\n  - 'b'", ["a", "b"])]:
            self.assertEqual(documents.parse_frontmatter(source)["after"], expected)
        self.assertEqual(documents.parse_frontmatter("purpose: 'It''s local' # comment")["purpose"], "It's local")
        self.assertEqual(documents.parse_frontmatter('covers: ["src/{a,b}/**", "tests/**"]')["covers"], ["src/{a,b}/**", "tests/**"])
        for value in ("Auth: token #1", "true", "123", "say \"hello\""):
            self.assertEqual(documents.parse_frontmatter("purpose: " + json.dumps(value))["purpose"], value)

    def test_unsupported_yaml_is_explicit(self):
        for source in ("purpose: >\n  folded", "after: [a,,b]", "after: [a", "after: [a]\nafter: [b]", "mapping:\n  nested: value"):
            with self.subTest(source=source), self.assertRaises(documents.FormatError):
                documents.parse_frontmatter(source)
        write(self.root, A, "---\npurpose: >\n  folded\n---\n# Still readable\n")
        model = graph.build_graph(self.root / "docdoki")
        self.assertIn("# Still readable", model["documents"][A]["source"])
        self.assertTrue(any(d["code"] == "format" for d in model["diagnostics"]))

    def test_full_source_preserves_markdown_structure(self):
        old = self.source()
        new = old.replace("Do not send rows\n  to any remote service.", "Never transmit records\n  outside this machine.").replace("Second section.", "Second section revised.")
        result = storage.apply_edits(self.root, [self.edit(new=new)])
        self.assertTrue(result["ok"], result)
        self.assertEqual(self.source(), new)
        self.assertIn("## Goal\n- This is code, not a contract.\n````", self.source())
        self.assertIn("First section.", self.source())
        self.assertEqual(result["documents"][A]["source"], self.source())
        self.assertEqual(result["receipt"][0]["from"], old)
        self.assertTrue(storage.apply_edits(self.root, [self.edit()])["ok"])

    def test_fragments_are_rejected(self):
        for field in ("claim", "section", "content", "title"):
            before = self.source()
            result = storage.apply_edits(self.root, [{**self.edit(), "field": field}])
            self.assertFalse(result["ok"])
            self.assertEqual(self.source(), before)

    def test_crlf_and_after_patch(self):
        original = "---\r\npurpose: local\r\nafter:\r\n  - a\r\n# keep this comment\r\n  - b\r\ncovers: ['src/**']\r\n---\r\n\r\n# Title\r\n\r\nBody.\r\n"
        result = documents.set_after(original, ["c"])
        self.assertEqual(documents.split_frontmatter(result)[0]["after"], ["c"])
        self.assertIn("# keep this comment\r\n", result)
        self.assertTrue(result.endswith("---\r\n\r\n# Title\r\n\r\nBody.\r\n"))
        self.assertIn("covers: ['src/**']", result)
        self.assertEqual(documents.h1("```md\n# Fake\n```\n# Real\n"), "Real")

    def test_stale_and_failed_batches_preserve_files(self):
        before = self.source()
        stale = storage.apply_edits(self.root, [self.edit(old="old snapshot")])
        self.assertFalse(stale["ok"])
        self.assertIn("conflict", stale["error"])
        failed = storage.apply_edits(self.root, [self.edit(), self.edit(B, old="stale")])
        self.assertFalse(failed["ok"])
        self.assertEqual(self.source(), before)

    def test_write_failure_rolls_back(self):
        before = {path: self.source(path) for path in (A, B)}
        real = storage.atomic_write
        count = 0
        def fail_second(path, text):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError("injected failure")
            real(path, text)
        with patch.object(storage, "atomic_write", fail_second):
            result = storage.apply_edits(self.root, [self.edit(A), self.edit(B)])
        self.assertFalse(result["ok"])
        self.assertIn("rollback completed", result["error"])
        self.assertEqual(before, {path: self.source(path) for path in (A, B)})
        self.assertEqual(len(result["recovery"]), 2)

    def test_mid_save_external_write_survives(self):
        old_a, old_b = self.source(A), self.source(B)
        external = old_b + "\nExternal obligation.\n"
        real = storage.atomic_write
        def modify_other(path, text):
            real(path, text)
            if path == self.root / A:
                write(self.root, B, external)
        with patch.object(storage, "atomic_write", modify_other):
            result = storage.apply_edits(self.root, [self.edit(A), self.edit(B)])
        self.assertFalse(result["ok"])
        self.assertEqual(self.source(A), old_a)
        self.assertEqual(self.source(B), external)

    def test_rollback_does_not_overwrite_newer_content(self):
        real = storage.atomic_write
        def fail_with_newer(path, text):
            if path == self.root / B:
                write(self.root, A, "# External replacement\n")
                raise OSError("injected failure")
            real(path, text)
        with patch.object(storage, "atomic_write", fail_with_newer):
            result = storage.apply_edits(self.root, [self.edit(A), self.edit(B)])
        self.assertFalse(result["ok"])
        self.assertIn("rollback incomplete", result["error"])
        self.assertEqual(self.source(), "# External replacement\n")

    def test_path_and_private_boundary(self):
        outside = write(self.root, "outside.md", "# Outside\n")
        for raw in ("../outside.md", str(outside), "docdoki/../outside.md", "outside.md"):
            self.assertFalse(storage.apply_edits(self.root, [self.edit(path=raw, old="", new="x")])["ok"])
        (self.root / "docdoki/specs/link.md").symlink_to(outside)
        self.assertFalse(storage.apply_edits(self.root, [self.edit(path="docdoki/specs/link.md")])["ok"])
        for extra in ("See [[local]].", "See [local](../private/specs/local.md).", "Read `../private/specs/local.md`."):
            self.assertFalse(storage.apply_edits(self.root, [self.edit(new=self.source() + extra)])["ok"])
        private = "docdoki/private/specs/local.md"
        result = storage.apply_edits(self.root, [self.edit(private)])
        self.assertTrue(result["ok"], result)
        self.assertTrue(result["receipt"][0]["private"])
        self.assertTrue(storage.apply_edits(self.root, [self.edit(new=self.source().replace("tests/**", "src/private/**"))])["ok"])

    def test_graph_diagnostics_and_cycles(self):
        for items, code in [(["missing"], "missing-edge"), (["a"], "self-edge"), (["b", "b"], "duplicate-edge"), (["b"], "cycle"), (["local"], "private-edge")]:
            with self.subTest(items=items):
                model = graph.build_graph(self.root / "docdoki", {A: documents.set_after(self.source(), items)})
                self.assertTrue(any(d["code"] == code for d in model["diagnostics"]))
                result = storage.apply_edits(self.root, [self.edit(new=documents.set_after(self.source(), items))])
                self.assertFalse(result["ok"])
        model = graph.build_graph(self.root / "docdoki", {A: self.source().replace("purpose:", "after: a\npurpose:")})
        self.assertTrue(any(d["code"] == "after-type" for d in model["diagnostics"]))

    def test_linear_shared_ancestor_graph(self):
        nodes = [{"path": str(i), "stem": str(i), "private": False,
                  "after": [str(j) for j in (i - 1, i - 2) if j >= 0]} for i in range(3000)]
        start = time.monotonic()
        self.assertEqual(graph.analyze(nodes), [])
        self.assertEqual(nodes[-1]["col"], 3000)
        self.assertLess(time.monotonic() - start, 2)

    def test_reading_payload_and_previews(self):
        model = graph.build_graph(self.root / "docdoki")
        self.assertIsNone(next(n for n in model["nodes"] if n["path"] == A)["progress"])
        self.assertIn("## Non-goals", model["documents"][A]["body"])
        self.assertTrue(any(d["private"] for d in model["documents"].values()))
        self.assertNotIn("docdoki/notes/evidence.md", model["documents"])
        self.assertTrue(any(d["archived"] for d in model["catalog"]))
        before = self.source(B)
        preview = storage.preview(self.root, [], {"path": B, "items": []})
        self.assertEqual(next(n for n in preview["nodes"] if n["path"] == B)["col"], 1)
        self.assertEqual(self.source(B), before)

    def test_preview_uses_client_snapshot_not_mixed_disk_versions(self):
        base = {A: self.source(A), B: self.source(B)}
        write(self.root, B, base[B].replace("Validate local rows.", "External rewrite."))
        model = storage.preview(self.root, [self.edit(A)], base=base)
        self.assertEqual(model["documents"][B]["source"], base[B])
        self.assertIn("External rewrite", self.source(B))

    def test_http_security_and_storage_baselines(self):
        server = panel.make_server(self.root / "docdoki", token="test-token")
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(lambda: (server.shutdown(), server.server_close(), thread.join()))
        url = f"http://127.0.0.1:{server.server_address[1]}"
        with urllib.request.urlopen(url) as response:
            page = response.read().decode()
            self.assertIn("no-store", response.headers["Cache-Control"])
            self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
            self.assertIn('SAVE_TOKEN="test-token"', page)
        headers = {"Content-Type": "application/json", "X-DocDoki-Token": "test-token", "Origin": url}
        payload = json.dumps({"edits": [self.edit()]}).encode()
        for changes, expected in [({"X-DocDoki-Token": ""}, 403), ({"Origin": "https://evil.example"}, 403),
                                  ({"Host": "evil.example"}, 403), ({"Content-Type": "text/plain"}, 415)]:
            with self.subTest(changes=changes), self.assertRaises(urllib.error.HTTPError) as raised:
                urllib.request.urlopen(urllib.request.Request(url + "/save", data=payload, headers={**headers, **changes}))
            self.assertEqual(raised.exception.code, expected)
            raised.exception.close()
        with self.assertRaises(urllib.error.HTTPError) as raised:
            urllib.request.urlopen(url + "/snapshot")
        raised.exception.close()
        result = json.loads(urllib.request.urlopen(urllib.request.Request(url + "/save", data=payload, headers=headers)).read())
        self.assertTrue(result["ok"])
        self.assertEqual(result["documents"][A]["source"], self.source())
        replay = json.loads(urllib.request.urlopen(urllib.request.Request(url + "/save", data=payload, headers=headers)).read())
        self.assertFalse(replay["ok"])

    def test_script_data_cannot_escape(self):
        write(self.root, A, self.source() + '\n</script><script>window.injected=true</script>\n')
        rendered = panel.render(self.root / "docdoki", "token")
        self.assertNotIn('</script><script>window.injected=true', rendered)
        self.assertIn('\\u003c/script>', rendered)


def serve_fixture():
    with tempfile.TemporaryDirectory(prefix="docdoki-panel-browser-") as tmp:
        root = Path(tmp)
        fixture(root)
        server = panel.make_server(root / "docdoki")
        def stop(*_):
            raise KeyboardInterrupt
        signal.signal(signal.SIGTERM, stop)
        print(json.dumps({"url": f"http://127.0.0.1:{server.server_address[1]}", "root": str(root)}), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()


if __name__ == "__main__":
    if "--serve" in sys.argv:
        serve_fixture()
    else:
        unittest.main()
