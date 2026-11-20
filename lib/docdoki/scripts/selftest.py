#!/usr/bin/env python3
"""Self-test for DocDoki's shared library, validator, privacy boundary, and lookup."""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from docdoki_lib import (
    FormatError,
    find_for_path,
    glob_match,
    parse_frontmatter,
    render_spec_index,
    set_card_field,
    validate_library,
)


def check_privacy(unit: Path) -> list[str]:
    return validate_library(unit, privacy_only=True)[0]

_pass = 0
_fail = 0


def assert_true(value: bool, label: str) -> None:
    global _pass, _fail
    if value:
        _pass += 1
    else:
        _fail += 1
        print(f"FAIL: {label}")


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def run(*args: str, cwd: Path) -> None:
    subprocess.run(args, cwd=cwd, check=True, stdout=subprocess.DEVNULL)


def main() -> int:
    # 1. Glob matching
    assert_true(glob_match("src/a/foo.py", "src/{a,b}/**"), "brace + ** glob matches")
    assert_true(not glob_match("src/c/foo.py", "src/{a,b}/**"), "brace + ** glob excludes other")
    assert_true(glob_match("src/export.py", "src/*.py"), "single-segment * matches")
    assert_true(not glob_match("src/sub/export.py", "src/*.py"), "single-segment * stops at /")
    assert_true(glob_match(".github/workflows/ci.yml", ".github/**"), "dotdir glob preserves leading dot")
    assert_true(not glob_match("github/workflows/ci.yml", ".github/**"), "dotdir glob does not match non-dotdir")

    # 2. YAML block & folded scalars
    fm = parse_frontmatter("purpose: >-\n  Local CSV export\n  with failure safety.\narea: Core\n")
    assert_true(fm["purpose"] == "Local CSV export with failure safety.", "folded >- scalar parses")
    fm_lit = parse_frontmatter("purpose: |-\n  Line 1\n  Line 2\n")
    assert_true(fm_lit["purpose"] == "Line 1\nLine 2", "literal |- scalar parses")
    updated = set_card_field("---\npurpose: >-\n  Old line 1\n  Old line 2\narea: Core\n---\n# Export\n", "purpose", "New summary")
    assert_true(parse_frontmatter(updated.split("---\n")[1])["purpose"] == "New summary", "set_card_field replaces folded scalar cleanly")
    assert_true("area: Core" in updated and "Old line 2" not in updated, "set_card_field removes old folded lines")

    # 3. Full library & privacy validation
    tmp = Path(tempfile.mkdtemp(prefix="docdoki-validate-test-"))
    try:
        unit = tmp / "unit"
        unit.mkdir()
        run("git", "init", "-q", cwd=unit)
        write(unit / ".gitignore", "/docdoki/private/\n")
        write(unit / "src/export.py", "def export(): pass\n")
        write(unit / "src/validate.py", "def validate(): pass\n")
        write(unit / "docdoki/northstar.md", "# Northstar\n\n## Mission\n\nLocal CSV tools.\n")
        write(unit / "docdoki/overview.md", "# Overview\n\n## Open decisions\n\n- Decide LF policy.\n")
        public = write(
            unit / "docdoki/specs/export.md",
            "---\npurpose: >-\n  Local export with\n  atomic publication.\narea: IO\nstatus: decided\nprogress: in-progress\ncovers:\n  - src/export.py\n  - src/private/**\n---\n# Export\n\n## Goal\n\n- Publish atomically.\n",
        )
        write(
            unit / "docdoki/specs/validate.md",
            "---\npurpose: Validate rows.\narea: IO\nafter: [export]\nprogress: done\ncovers: [src/validate.py, src/missing.py]\n---\n# Validation\n\n## Goal\n\n- Check types.\n",
        )
        write(
            unit / "docdoki/work/atomic-export.md",
            "---\nspecs: [export]\nscope: [src/export.py]\nstatus: active\n---\n# Atomic export\n\n## Objective\n\nFinish [[export]].\n",
        )
        write(
            unit / "docdoki/notes/fs-gotchas.md",
            "---\npurpose: Atomic rename notes\nrelates: [export]\ncovers: [src/export.py]\n---\n# FS gotchas\n\nLink to [[export]].\n",
        )
        write(
            unit / "docdoki/private/notes/compute.md",
            "---\npurpose: local compute\n---\n# Compute\n",
        )

        errors, warnings = validate_library(unit)
        assert_true(errors == [], f"valid library has no errors (got {errors})")
        assert_true(
            any("covers globs matching no files" in w and "src/missing.py" in w and "src/validate.py" not in w for w in warnings),
            f"done spec with partial unmatched covers warns only on unmatched globs (got {warnings})",
        )
        assert_true(check_privacy(unit) == [], "privacy_only passes on valid library")

        # --for lookup
        matches = find_for_path(unit, "src/export.py")
        assert_true([s["stem"] for s in matches["specs"]] == ["export"], "--for matches spec by covers")
        assert_true([w["stem"] for w in matches["work"]] == ["atomic-export"], "--for matches active work")
        assert_true([n["stem"] for n in matches["notes"]] == ["fs-gotchas"], "--for matches note by relates/covers")

        # --index output
        index_md = render_spec_index(unit)
        assert_true("| IO | [[export]] | in-progress |" in index_md, "--index renders area/spec/state")
        assert_true("compute" not in index_md, "--index excludes private docs")

        # Broken wiki-link (prose vs code)
        public.write_text(public.read_text() + "\n```\n[[not-a-link]]\n```\n", encoding="utf-8")
        assert_true(validate_library(unit)[0] == [], "wiki-link inside fenced code is ignored")
        public.write_text(public.read_text() + "\nSee [[missing-doc]].\n", encoding="utf-8")
        assert_true(any("broken wiki-link [[missing-doc]]" in e for e in validate_library(unit)[0]), "broken prose wiki-link fails")
        public.write_text(public.read_text().replace("\nSee [[missing-doc]].\n", ""), encoding="utf-8")

        # Broken specs reference in active work fails; archived work historical refs are tolerated
        bad_work = write(unit / "docdoki/work/bad.md", "---\nspecs: [nonexistent]\n---\n# Bad\n")
        assert_true(any("broken specs reference" in e for e in validate_library(unit)[0]), "broken work specs ref fails")
        bad_work.unlink()
        old_work = write(unit / "docdoki/work/archive/2026-01-01-old.md", "---\nspecs: [retired-spec]\n---\n# Old\n")
        assert_true(validate_library(unit)[0] == [], "archived work historical specs ref does not fail validation")
        old_work.unlink()

        # Privacy boundary regressions
        public.write_text(public.read_text() + "\nSee [[compute]].\n", encoding="utf-8")
        assert_true(any("reference a private document" in e for e in check_privacy(unit)), "public wiki-link to private fails")
        public.write_text(public.read_text().replace("\nSee [[compute]].\n", ""), encoding="utf-8")

        public.write_text(public.read_text().replace("---\n", "---\nafter: [compute]\n", 1), encoding="utf-8")
        assert_true(any("reference a private document" in e for e in check_privacy(unit)), "public after ref to private fails")
        public.write_text(public.read_text().replace("after: [compute]\n", ""), encoding="utf-8")

        duplicate = write(unit / "docdoki/private/specs/export.md", "---\npurpose: dup\n---\n# Dup\n")
        assert_true(any("duplicate document stem" in e for e in check_privacy(unit)), "duplicate public/private stem fails")
        duplicate.unlink()

        run("git", "add", "-f", "docdoki/private/notes/compute.md", cwd=unit)
        assert_true(any("tracked by public Git history" in e for e in check_privacy(unit)), "tracked private file fails")
        run("git", "rm", "--cached", "-q", "docdoki/private/notes/compute.md", cwd=unit)

        (unit / ".gitignore").write_text("", encoding="utf-8")
        assert_true(any("not ignored by Git" in e for e in check_privacy(unit)), "missing gitignore rule fails")
        (unit / ".gitignore").write_text("/docdoki/private/\n", encoding="utf-8")

        public.write_text(public.read_text() + "\n[priv](../private/notes/compute.md)\n", encoding="utf-8")
        assert_true(any("private path" in e for e in check_privacy(unit)), "public Markdown link to private fails")
        public.write_text(public.read_text().replace("\n[priv](../private/notes/compute.md)\n", "") + "\nRead `../private/notes/compute.md`.\n", encoding="utf-8")
        assert_true(any("private path" in e for e in check_privacy(unit)), "plain relative private path fails")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"{_pass} passed, {_fail} failed")
    return 1 if _fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
