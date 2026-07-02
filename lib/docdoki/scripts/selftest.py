#!/usr/bin/env python3
"""Self-test for the DocDoki private-boundary checker."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from check_privacy import check

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
    tmp = Path(tempfile.mkdtemp(prefix="docdoki-private-test-"))
    try:
        unit = tmp / "unit"
        unit.mkdir()
        run("git", "init", "-q", cwd=unit)
        write(unit / ".gitignore", "/docdoki/private/\n")
        public = write(unit / "docdoki/specs/public.md", "---\npurpose: public\ncovers: [src/private/**]\n---\n# Public\n\n## Goal\n\n- Public contract.\n")
        private = write(unit / "docdoki/private/notes/compute.md", "---\npurpose: local compute\n---\n# Compute\n")

        assert_true(check(unit) == [], "valid private subtree passes")

        public.write_text(public.read_text() + "\nSee [[compute]].\n", encoding="utf-8")
        errors = check(unit)
        assert_true(any("references private document" in error for error in errors), "public wiki-link to private fails")
        public.write_text(public.read_text().replace("\nSee [[compute]].\n", ""), encoding="utf-8")

        public.write_text(public.read_text().replace("---\n", "---\nafter: [compute]\n", 1), encoding="utf-8")
        errors = check(unit)
        assert_true(any("references private document" in error for error in errors), "public after dependency on private fails")
        public.write_text(public.read_text().replace("after: [compute]\n", ""), encoding="utf-8")

        public.write_text(public.read_text() + "\nSee [[private/notes/compute]].\n", encoding="utf-8")
        errors = check(unit)
        assert_true(any("references private document" in error for error in errors), "path-qualified private wiki-link fails")
        public.write_text(public.read_text().replace("\nSee [[private/notes/compute]].\n", ""), encoding="utf-8")

        duplicate = write(unit / "docdoki/private/specs/public.md", "---\npurpose: duplicate\n---\n# Duplicate\n")
        errors = check(unit)
        assert_true(any("duplicate document stem" in error for error in errors), "duplicate public/private stem fails")
        duplicate.unlink()

        run("git", "add", "-f", "docdoki/private/notes/compute.md", cwd=unit)
        errors = check(unit)
        assert_true(any("tracked by public Git history" in error for error in errors), "tracked private document fails")
        run("git", "rm", "--cached", "-q", "docdoki/private/notes/compute.md", cwd=unit)

        (unit / ".gitignore").write_text("/docdoki/private/*\n!/docdoki/private/leak.txt\n", encoding="utf-8")
        write(unit / "docdoki/private/leak.txt", "leak\n")
        errors = check(unit)
        assert_true(any("leak.txt" in error and "not ignored by Git" in error for error in errors),
                    "unignored non-Markdown private file fails")

        (unit / ".gitignore").write_text("", encoding="utf-8")
        errors = check(unit)
        assert_true(any("not ignored by Git" in error for error in errors), "missing ignore rule fails")

        public.write_text(public.read_text() + "\n[private](../private/notes/compute.md)\n", encoding="utf-8")
        assert_true(any("private path" in error for error in check(unit)), "public Markdown link to private fails")
        public.write_text(public.read_text().replace("\n[private](../private/notes/compute.md)\n", "") +
                          "\nRead `../private/notes/compute.md`.\n", encoding="utf-8")
        assert_true(any("private path" in error for error in check(unit)), "plain relative private path fails")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"{_pass} passed, {_fail} failed")
    return 1 if _fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
