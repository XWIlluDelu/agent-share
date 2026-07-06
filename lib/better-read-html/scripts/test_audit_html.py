#!/usr/bin/env python3
"""Regression fixtures for audit_html.py. Run: python3 test_audit_html.py"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("audit_html.py")

HEAD = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>t</title>'
    "<style>:focus-visible{outline:2px solid} :target{background:#eee} "
    ".brh-table-wrap{overflow-x:auto} @media print{a{color:inherit}}</style></head><body>"
)
FOOT = "</body></html>"


def audit(body: str, *args: str, source_text: str | None = None) -> dict:
    with tempfile.TemporaryDirectory() as td:
        html_file = Path(td) / "t.html"
        html_file.write_text(HEAD + body + FOOT, encoding="utf-8")
        argv = [sys.executable, str(SCRIPT), str(html_file), *args]
        if source_text is not None:
            src = Path(td) / "src.txt"
            src.write_text(source_text, encoding="utf-8")
            argv += ["--source-text", str(src)]
        proc = subprocess.run(argv, capture_output=True, text=True, check=False)
        return json.loads(proc.stdout)


def test_selfclosing_void_does_not_leak_noncanonical() -> None:
    report = audit(
        '<main id="main"><p id="p001">canonical one</p>'
        '<aside data-canonical="false"><p>HIDDEN<br/>HIDDEN</p><p>HIDDEN TOO</p></aside>'
        '<p id="p002">canonical two</p></main>',
        source_text="canonical one\ncanonical two\n",
    )
    assert report["source_order_normalized_text_exact_match"] is True, report["first_text_mismatch"]


def test_hero_check_only_fires_on_real_duplicate() -> None:
    clean = audit(
        '<main id="main"><header data-canonical="false"><p class="brh-kicker">Status line</p></header>'
        '<h1 class="brh-doc-title" id="t1">Doc Title</h1><p id="p001">body</p></main>'
    )
    assert not clean["design_warnings"], clean["design_warnings"]
    duplicated = audit(
        '<main id="main"><header data-canonical="false"><h1>Doc Title</h1></header>'
        '<h1 class="brh-doc-title" id="t1">Doc Title</h1><p id="p001">body</p></main>'
    )
    assert any("hero" in w for w in duplicated["design_warnings"]), duplicated["design_warnings"]


def test_unwrapped_table_warns_when_wrap_convention_present() -> None:
    unwrapped = audit('<main id="main"><table><tr><td>x</td></tr></table></main>')
    assert any("brh-table-wrap" in w for w in unwrapped["readability_warnings"]), unwrapped["readability_warnings"]
    wrapped = audit('<main id="main"><div class="brh-table-wrap"><table><tr><td>x</td></tr></table></div></main>')
    assert not wrapped["readability_warnings"], wrapped["readability_warnings"]


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for test in tests:
        test()
        print(f"ok {test.__name__}")
    print(f"{len(tests)} passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
