#!/usr/bin/env python3
"""Backend and HTTP regressions in temporary libraries. --serve supplies the browser test."""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
for d in (HERE, SCRIPTS):
    if str(d) not in sys.path:
        sys.path.insert(0, str(d))

import docdoki_lib as lib
import graph
import panel
import storage

A = "docdoki/specs/a.md"
B = "docdoki/specs/b.md"
P = "docdoki/specs/proposed-cache.md"


def write(root: Path, rel: str, text: str) -> Path:
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8", newline="") as stream:
        stream.write(text)
    return target


def fixture(root: Path) -> None:
    write(
        root,
        "docdoki/northstar.md",
        "# Northstar\n\n## Mission\n\nKeep CSV exports local and failure-safe.\n\n## Units\n\n- [Child Analysis](../child/docdoki/northstar.md) — statistical child unit.\n",
    )
    write(
        root,
        "docdoki/overview.md",
        "# Project overview\n\n## Architecture\n\nRows flow through [[b]] into [[a]].\n\n## Open decisions\n\n- Decide whether to support network filesystems.\n",
    )
    write(
        root,
        A,
        """---
purpose: >-
  Local export without
  network delivery.
area: IO
status: decided
progress: in-progress
covers: ['src/{a,b}/**', 'tests/**']
---
# Export

An introduction that is not a section.

## Goal

- Do not send rows
  to any remote service.

## Checks

| Case | Expected |
| --- | --- |
| Failure | Destination unchanged |

## Non-goals

Never upload data. See [[evidence#Details]] and [validation](b.md).
""",
    )
    write(
        root,
        B,
        "---\npurpose: Validate local rows.\narea: IO\nafter: ['a']\nprogress: done\n---\n# Validation\n\n## Goal\n\n- Validate types.\n",
    )
    write(
        root,
        P,
        "---\npurpose: Optional disk cache for parsed rows.\narea: Performance\nstatus: proposed\nprogress: not-started\ncovers: []\n---\n# Row cache\n\n## Goal\n\n- Cache parsed rows locally.\n",
    )
    write(
        root,
        "docdoki/work/atomic-export.md",
        "---\nspecs: [a]\nscope: [src/export.py]\nstatus: blocked\n---\n# Atomic export\n\n## Objective\n\nFinish failure-safe publication for [[a]].\n\n## Current state\n\n- Working: writes new CSV files.\n- Broken/Blocked: direct write truncates destination on failure.\n\n## Next actions\n\n- [x] Inspect current writer.\n- [ ] Write sibling temp file and rename.\n",
    )
    write(
        root,
        "docdoki/notes/evidence.md",
        "---\npurpose: Filesystem rename behavior.\nrelates: [a]\n---\n# Evidence\n\n## Details\n\nUniqueSearchTokenEXDEV observation with a [spec link](../specs/a.md).\n",
    )
    write(root, "docdoki/work/archive/2026-09-01-initial.md", "# Previous work\n\nArchived knowledge.\n")
    write(
        root,
        "docdoki/private/specs/local.md",
        "---\npurpose: Private calibration.\nafter: [a]\n---\n# Local\n\n## Goal\n\n- Keep calibration local.\n",
    )
    write(
        root,
        "docdoki/private/work/local-work.md",
        "---\nspecs: [local]\nstatus: active\n---\n# Local work\n\n## Objective\n\nPrivate inspection of [[local]].\n",
    )
    # Linked child unit
    write(
        root,
        "child/docdoki/northstar.md",
        "---\nparent: ../../docdoki/northstar.md\n---\n# Child Northstar\n\n## Mission\n\nRun statistical checks.\n",
    )
    write(root, "child/docdoki/overview.md", "# Child overview\n\nChild unit overview.\n")


class LauncherTest(unittest.TestCase):
    def test_resolves_docdoki_home_and_binds_own_unit(self):
        with tempfile.TemporaryDirectory(prefix="docdoki-launcher-test-") as tmp:
            base = Path(tmp)
            fake_skill = base / "custom-skill"
            write(fake_skill, "panel/panel.py", "import json, sys\nprint(json.dumps(sys.argv[1:]))\n")
            unit = base / "project/child"
            source = (SCRIPTS / "panel_launcher.py").read_text()
            launcher = write(unit, "docdoki/panel.py", source)
            result = subprocess.run(
                [sys.executable, "-B", str(launcher), "--no-open"],
                cwd=base,
                env={**os.environ, "DOCDOKI_HOME": str(fake_skill)},
                capture_output=True,
                text=True,
                check=True,
                timeout=10,
            )
            self.assertEqual(json.loads(result.stdout), [str(unit), "--no-open"])


class PanelTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="docdoki-panel-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        fixture(self.root)

    def source(self, path=A):
        return lib.read_source(self.root / path)

    def edit(self, path=A, old=None, new=None):
        before = self.source(path) if old is None else old
        return {"path": path, "field": "source", "from": before, "to": new if new is not None else before + "\nA new constraint.\n"}

    def test_steering_graph_payload_and_backlinks(self):
        model = graph.build_graph(self.root / "docdoki")
        self.assertEqual(model["meta"]["overviewPath"], "docdoki/overview.md")
        self.assertIn("Keep CSV exports local", model["meta"]["mission"])
        self.assertEqual(len(model["meta"]["units"]), 1)
        self.assertEqual(model["meta"]["units"][0]["relation"], "child")

        # Open Decisions aggregates overview decisions, proposed specs, and blocked work
        kinds = {d["kind"] for d in model["decisions"]}
        self.assertEqual(kinds, {"decision", "proposed", "blocked"})

        # Folded YAML purpose parsed cleanly on spec A
        node_a = next(n for n in model["nodes"] if n["path"] == A)
        self.assertEqual(node_a["content"], "Local export without network delivery.")
        self.assertEqual(node_a["area"], "IO")
        self.assertEqual(len(node_a["activeWork"]), 1)
        self.assertEqual(node_a["activeWork"][0]["stem"], "atomic-export")

        # Rich active work card metadata
        work = next(w for w in model["work"] if w["stem"] == "atomic-export")
        self.assertEqual(work["tasks"], {"done": 1, "total": 2})
        self.assertEqual(work["status"], "blocked")
        self.assertEqual(work["specs"], ["a"])

        # Backlinks include unopened note evidence.md!
        self.assertNotIn("docdoki/notes/evidence.md", model["documents"])
        self.assertIn("docdoki/notes/evidence.md", model["backlinks"][A])

    def test_legacy_spec_abstract_and_stages_still_load(self):
        with tempfile.TemporaryDirectory(prefix="docdoki-legacy-") as tmp:
            legacy = Path(tmp)
            write(legacy, "docdoki/northstar.md", "# Northstar\n")
            write(legacy, "docdoki/spec_abstract.md", "# Abstract\n\n## Human decisions\n\n- Keep legacy working.\n")
            write(legacy, "docdoki/specs/x.md", "---\npurpose: X\n---\n# X\n")
            write(legacy, "docdoki/stages/follow-x-2026-09-01.md", "# Legacy stage\n\n## Objective\n\nWork on [[x]].\n")
            model = graph.build_graph(legacy / "docdoki")
            self.assertEqual(model["meta"]["overviewPath"], "docdoki/spec_abstract.md")
            self.assertEqual(len(model["work"]), 1)
            self.assertEqual(model["work"][0]["specs"], ["x"])
            self.assertEqual(len(model["decisions"]), 1)

    def test_full_library_search_includes_unopened_notes_and_overrides(self):
        hits = graph.search_library(self.root / "docdoki", "UniqueSearchTokenEXDEV")
        self.assertEqual([h["path"] for h in hits], ["docdoki/notes/evidence.md"])
        draft_hits = graph.search_library(
            self.root / "docdoki",
            "DraftOnlyKeyword",
            overrides={A: self.source(A) + "\nDraftOnlyKeyword\n"},
        )
        self.assertEqual([h["path"] for h in draft_hits], [A])

    def test_transform_card_fields_and_dependencies(self):
        res = storage.transform(self.root, {}, card={"path": A, "field": "progress", "value": "blocked"})
        self.assertTrue(res["ok"])
        self.assertIn('progress: "blocked"', res["source"])
        self.assertEqual(self.source(A), lib.read_source(self.root / A))  # read-only

        res_status = storage.transform(self.root, {}, card={"path": P, "field": "status", "value": "decided"})
        self.assertTrue(res_status["ok"])
        self.assertEqual(next(n for n in res_status["graph"]["nodes"] if n["path"] == P)["status"], "decided")

        res_dep = storage.transform(self.root, {}, after={"path": B, "op": "remove", "stem": "a"})
        self.assertEqual(next(n for n in res_dep["graph"]["nodes"] if n["path"] == B)["col"], 1)

        with self.assertRaises(ValueError):
            storage.transform(self.root, {}, after={"path": A, "op": "add", "stem": "b"})  # cycle
        with self.assertRaises(ValueError):
            storage.transform(self.root, {}, after={"path": A, "op": "add", "stem": "local"})  # private edge

    def test_create_document_validation(self):
        created = storage.create_document(
            self.root, "spec", "quoted-spec", "Quoted Spec", area="IO: local", purpose='User\'s "export": safe'
        )
        self.assertTrue(created["ok"])
        self.assertEqual(created["document"]["fm"]["area"], "IO: local")
        self.assertEqual(created["document"]["fm"]["purpose"], 'User\'s "export": safe')

        created_note = storage.create_document(self.root, "note", "new-gotcha", "New Gotcha", purpose="A tip")
        self.assertTrue(created_note["ok"])
        self.assertEqual(created_note["path"], "docdoki/notes/new-gotcha.md")
        self.assertTrue((self.root / created_note["path"]).is_file())

        with self.assertRaisesRegex(ValueError, "already exists"):
            storage.create_document(self.root, "spec", "new-gotcha", "Duplicate Stem")
        with self.assertRaisesRegex(ValueError, "kebab-case"):
            storage.create_document(self.root, "spec", "../escape", "Bad")

    def test_save_optimistic_conflict_rollback_and_privacy(self):
        old_a, old_b = self.source(A), self.source(B)
        self.assertFalse(storage.apply_edits(self.root, [self.edit(old="stale")])["ok"])
        self.assertFalse(storage.apply_edits(self.root, [self.edit(new=old_a + "\nSee [[local]].\n")])["ok"])

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
        self.assertEqual(self.source(A), old_a)
        self.assertEqual(self.source(B), old_b)

    def test_http_security_multi_unit_and_endpoints(self):
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
        for bad, code in [({"X-DocDoki-Token": ""}, 403), ({"Origin": "https://evil.example"}, 403), ({"Content-Type": "text/plain"}, 415)]:
            with self.assertRaises(urllib.error.HTTPError) as raised:
                urllib.request.urlopen(urllib.request.Request(url + "/save", data=payload, headers={**headers, **bad}))
            self.assertEqual(raised.exception.code, code)
            raised.exception.close()

        # Linked child unit works and full unit tree is exposed; unknown unit rejected
        with urllib.request.urlopen(url + "/?unit=child") as resp:
            body = resp.read().decode()
            self.assertIn("Child Northstar", body)
            self.assertIn('"unitTree"', body)
        with self.assertRaises(urllib.error.HTTPError) as raised:
            urllib.request.urlopen(url + "/?unit=../../etc")
        self.assertEqual(raised.exception.code, 400)
        raised.exception.close()

        # Search endpoint finds unopened note
        search_res = json.loads(
            urllib.request.urlopen(
                urllib.request.Request(url + "/search", data=json.dumps({"q": "UniqueSearchTokenEXDEV"}).encode(), headers=headers)
            ).read()
        )
        self.assertEqual(len(search_res["results"]), 1)

        # Save + replay conflict
        res = json.loads(urllib.request.urlopen(urllib.request.Request(url + "/save", data=payload, headers=headers)).read())
        self.assertTrue(res["ok"])
        replay = json.loads(urllib.request.urlopen(urllib.request.Request(url + "/save", data=payload, headers=headers)).read())
        self.assertFalse(replay["ok"])

    def test_script_data_cannot_escape(self):
        write(self.root, A, self.source() + "\n</script><script>window.injected=true</script>\n")
        rendered = panel.render(self.root / "docdoki", "token")
        self.assertNotIn("</script><script>window.injected=true", rendered)
        self.assertIn("\\u003c/script>", rendered)

    def test_linear_shared_ancestor_graph(self):
        nodes = [{"path": str(i), "stem": str(i), "private": False, "after": [str(j) for j in (i - 1, i - 2) if j >= 0]} for i in range(2000)]
        start = time.monotonic()
        self.assertEqual(lib.analyze_spec_graph(nodes), [])
        self.assertEqual(nodes[-1]["col"], 2000)
        self.assertLess(time.monotonic() - start, 2)


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
