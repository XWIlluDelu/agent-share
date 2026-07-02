#!/usr/bin/env python3
"""Check DocDoki's path-based private-document boundary."""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

WIKI_LINK = re.compile(r"\[\[([^\]#|]+)(?:[#|][^\]]*)?\]\]")
MARKDOWN_LINK = re.compile(r"\]\(([^)\s]+)(?:\s+[^)]*)?\)")
RELATIVE_PRIVATE_PATH = re.compile(r"(?<![\w/.-])((?:(?:\.\.?)/)*private/[^\s`'\"\)\]]+)")
FRONTMATTER = re.compile(r"^---\n(.*?)\n---(?:\n|$)", re.S)


def git(unit: Path, *args: str, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(unit), *args],
        text=True,
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def after_refs(text: str) -> list[str]:
    match = FRONTMATTER.match(text.replace("\r\n", "\n"))
    if not match:
        return []
    lines = match.group(1).splitlines()
    refs: list[str] = []
    for index, raw in enumerate(lines):
        if not raw.startswith("after:"):
            continue
        value = raw.partition(":")[2].strip()
        if value.startswith("[") and value.endswith("]"):
            refs.extend(item.strip().strip("\"'") for item in value[1:-1].split(",") if item.strip())
        elif not value:
            for child in lines[index + 1:]:
                item = re.match(r"\s+-\s+(.+?)\s*$", child)
                if item:
                    refs.append(item.group(1).strip().strip("\"'"))
                elif child and not child.startswith(" "):
                    break
        break
    return refs


def docs(dd: Path) -> tuple[list[Path], list[Path]]:
    private_root = dd / "private"
    private = sorted(private_root.rglob("*.md")) if private_root.is_dir() else []
    public = sorted(
        path for path in dd.rglob("*.md")
        if private_root not in path.parents
    )
    return public, private


def check(unit: Path) -> list[str]:
    unit = unit.resolve()
    dd = unit / "docdoki"
    if not dd.is_dir():
        return [f"missing DocDoki library: {dd}"]

    errors: list[str] = []
    public, private = docs(dd)
    all_docs = public + private

    by_stem: dict[str, Path] = {}
    for path in all_docs:
        prior = by_stem.get(path.stem)
        if prior is not None:
            errors.append(
                f"duplicate document stem {path.stem!r}: "
                f"{prior.relative_to(unit)} and {path.relative_to(unit)}"
            )
        else:
            by_stem[path.stem] = path

    private_root = dd / "private"
    private_stems = {path.stem for path in private}
    for path in public:
        text = path.read_text(encoding="utf-8")
        targets = [target.strip() for target in WIKI_LINK.findall(text)]
        targets.extend(after_refs(text))
        for target in targets:
            normalized = target.replace("\\", "/").strip()
            stem = normalized.rsplit("/", 1)[-1]
            if stem in private_stems or normalized.startswith(("private/", "docdoki/private/")):
                errors.append(
                    f"public document references private document {target!r}: "
                    f"{path.relative_to(unit)}"
                )
        path_targets = list(MARKDOWN_LINK.findall(text))
        path_targets.extend(RELATIVE_PRIVATE_PATH.findall(text))
        for href in path_targets:
            if "://" in href or href.startswith(("#", "mailto:")):
                continue
            target = (path.parent / href.split("#", 1)[0]).resolve()
            try:
                target.relative_to(private_root.resolve())
            except ValueError:
                continue
            errors.append(f"public document contains a private path: {path.relative_to(unit)}")
        if "docdoki/private/" in text:
            errors.append(f"public document contains a private path: {path.relative_to(unit)}")

    top = git(unit, "rev-parse", "--show-toplevel")
    if top.returncode:
        errors.append("unit is not inside a Git repository")
        return errors
    git_root = Path(top.stdout.strip()).resolve()
    try:
        private_rel = (dd / "private").relative_to(git_root)
    except ValueError:
        errors.append("docdoki/private is outside the Git worktree")
        return errors

    tracked = git(git_root, "ls-files", "--", private_rel.as_posix())
    if tracked.returncode:
        errors.append(f"cannot inspect tracked private files: {tracked.stderr.strip()}")
    elif tracked.stdout.strip():
        for rel in tracked.stdout.splitlines():
            errors.append(f"private document is tracked by public Git history: {rel}")

    private_root = dd / "private"
    private_paths = sorted(
        path for path in private_root.rglob("*")
        if path.is_file() or path.is_symlink()
    ) if private_root.is_dir() else []
    probes = [private_root / ".docdoki-private-probe", *private_paths]
    rels = [path.relative_to(git_root).as_posix() for path in probes]
    ignored = git(
        git_root,
        "check-ignore", "--no-index", "-z", "--stdin",
        input_text="\0".join(rels) + "\0",
    )
    ignored_rels = {rel for rel in ignored.stdout.split("\0") if rel}
    for rel in rels:
        if rel not in ignored_rels:
            errors.append(f"private path is not ignored by Git: {rel}")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", help="unit root containing docdoki/")
    args = parser.parse_args(argv)
    errors = check(Path(args.root))
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    print("DocDoki private boundary: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
