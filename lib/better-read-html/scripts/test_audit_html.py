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


def audit_result(
    body: str,
    *args: str,
    source_text: str | None = None,
    files: dict[str, str] | None = None,
) -> tuple[dict, int]:
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        html_file = root / "t.html"
        html_file.write_text(HEAD + body + FOOT, encoding="utf-8")
        for rel, content in (files or {}).items():
            path = root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        argv = [sys.executable, str(SCRIPT), str(html_file), *args]
        if source_text is not None:
            src = root / "src.txt"
            src.write_text(source_text, encoding="utf-8")
            argv += ["--source-text", str(src)]
        proc = subprocess.run(argv, capture_output=True, text=True, check=False)
        return json.loads(proc.stdout), proc.returncode


def audit(body: str, *args: str, source_text: str | None = None, files: dict[str, str] | None = None) -> dict:
    return audit_result(body, *args, source_text=source_text, files=files)[0]


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


def test_local_document_links_are_checked_without_query_or_fragment() -> None:
    good, good_rc = audit_result(
        '<main id="main"><p>body</p><a href="notes/read me.html?q=1#part">notes</a></main>',
        "--strict",
        files={"notes/read me.html": "ok"},
    )
    assert good_rc == 0, good
    assert not good["missing_local_links"], good["missing_local_links"]

    bad, bad_rc = audit_result(
        '<main id="main"><p>body</p><a href="missing.html#part">missing</a></main>',
        "--strict",
    )
    assert bad_rc == 1, bad
    assert bad["missing_local_links"] == ["missing.html#part"], bad["missing_local_links"]


def test_ftp_link_is_external_not_a_missing_local_document() -> None:
    report, rc = audit_result(
        '<main id="main"><p>body</p><a href="ftp://example.org/paper.pdf">source</a></main>',
        "--strict",
    )
    assert rc == 0, report
    assert report["external_links"] == ["ftp://example.org/paper.pdf"], report
    assert not report["missing_local_links"], report


def test_css_local_dependencies_are_checked() -> None:
    body = '<style>.hero{background:url("assets/hero.png?v=1")}</style><main id="main"><p>body</p></main>'
    good, good_rc = audit_result(body, "--strict", files={"assets/hero.png": "image"})
    assert good_rc == 0, good
    assert not good["missing_referenced_assets"], good["missing_referenced_assets"]

    bad, bad_rc = audit_result(body, "--strict")
    assert bad_rc == 1, bad
    assert "assets/hero.png?v=1" in bad["missing_referenced_assets"], bad["missing_referenced_assets"]


def test_css_data_import_fails_strict_as_a_dependency() -> None:
    report, rc = audit_result(
        '<style>@import "data:text/css,body%7Bcolor:red%7D";</style><main id="main"><p>body</p></main>',
        "--strict",
    )
    assert rc == 1, report
    assert any(value.startswith("data:text/css") for value in report["remote_dependencies"]), report

    inline, inline_rc = audit_result(
        '<style>.icon{background:url("data:image/png;base64,AAAA")}</style><main id="main"><p>body</p></main>',
        "--strict",
    )
    assert inline_rc == 0, inline
    assert any(value.startswith("data:image/png") for value in inline["inline_data_assets"]), inline


def test_srcset_object_and_poster_are_audited() -> None:
    body = (
        '<main id="main"><p>body</p>'
        '<img src="assets/a.png" srcset="assets/a.png 1x, https://cdn.example/a.png 2x" alt="">'
        '<video poster="assets/poster.jpg"></video>'
        '<object data="assets/appendix.pdf"></object></main>'
    )
    report, rc = audit_result(
        body,
        "--strict",
        files={"assets/a.png": "a", "assets/poster.jpg": "p", "assets/appendix.pdf": "pdf"},
    )
    assert rc == 1, report
    assert report["remote_dependencies"] == ["https://cdn.example/a.png"], report["remote_dependencies"]
    assert not report["missing_referenced_assets"], report["missing_referenced_assets"]


def test_base_and_meta_refresh_are_strict_navigation_hazards() -> None:
    base, base_rc = audit_result('<base href="https://cdn.example/"><main id="main"><p>body</p></main>', "--strict")
    assert base_rc == 1 and base["base_hrefs"], base
    refresh, refresh_rc = audit_result(
        '<meta http-equiv="refresh" content="0; url=https://example.com/next"><main id="main"><p>body</p></main>',
        "--strict",
    )
    assert refresh_rc == 1 and refresh["navigation_hazards"], refresh


def test_generated_targets_and_executable_links_fail_strict() -> None:
    report, rc = audit_result(
        '<main id="main"><p id="p1">body</p>'
        '<aside data-generated="true" data-target="missing">note</aside>'
        '<a href="javascript:alert(1)">bad</a></main>',
        "--strict",
    )
    assert rc == 1, report
    assert report["unresolved_attribute_refs"] == ["missing"], report["unresolved_attribute_refs"]
    assert report["executable_links"] == ["javascript:alert(1)"], report["executable_links"]


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for test in tests:
        test()
        print(f"ok {test.__name__}")
    print(f"{len(tests)} passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
