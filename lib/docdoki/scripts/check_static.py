#!/usr/bin/env python3
"""Static lint over the docs/ tree and .docdoki/staging/ contents.

Usage:
    check_static.py [--root .] [--json]

Behavior:
    - Strictly read-only.
    - Reports errors (exit code 1) and warnings (exit code 0) to stdout.
    - With --json, emits structured JSON.

Checks:
    1. Markdown frontmatter parses where required (specs, staging files).
    2. Internal links [text](path) resolve to existing files.
    3. Chore IDs in chores.md are unique within the file. Placeholders
       `chore-??????` are flagged informationally.
    4. Spec frontmatter has id, type, status, and non-empty covers.paths.
       Spec IDs are unique across docs/spec/.
    5. Staging files have all required frontmatter fields and target_doc
       resolves to a path under docs/.
    6. At most one active_*.md exists under docs/todo/.
    7. docs/challenge/ filenames match <YYMMDD>_<NN>_<rand>.md pattern.
    8. docs/todo/archive/ filenames match <description>_<YYMMDD>.md pattern.

Standard library only.
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ----- Constants -----

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
KV_RE = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$")
CHORE_ID_RE = re.compile(r"\[chore-([a-z2-7?]{6})\]")
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
CHALLENGE_FILENAME_RE = re.compile(r"^(\d{6})_(\d{2})_([a-z2-7]{4})\.md$")
ARCHIVE_FILENAME_RE = re.compile(r"^.+_(\d{6})\.md$")
ACTIVE_FILENAME_RE = re.compile(r"^active_.+\.md$")
SPEC_REQUIRED_FIELDS = ("id", "type", "status")
STAGING_REQUIRED_FIELDS = (
    "source", "target_doc", "created_at_rev", "created_on_branch", "base_content_sha256",
)


# ----- Data types -----

@dataclass
class Issue:
    level: str  # "error" or "warning"
    path: str
    message: str

    def render(self) -> str:
        return f"{self.level.upper():7} {self.path}: {self.message}"


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)

    def error(self, path: Path | str, msg: str) -> None:
        self.issues.append(Issue("error", str(path), msg))

    def warn(self, path: Path | str, msg: str) -> None:
        self.issues.append(Issue("warning", str(path), msg))

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.level == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.level == "warning")


# ----- Frontmatter -----

def parse_frontmatter(text: str) -> dict:
    """Recursive descent parser sufficient for the docdoki frontmatter
    shapes: scalars, inline lists, block lists, and nested dicts (one
    extra level, for covers.paths).
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    lines = [line for line in m.group(1).splitlines() if line.strip()]
    parsed, _ = _parse_dict(lines, 0, 0)
    return parsed


def _line_indent(line: str) -> int:
    return len(line) - len(line.lstrip())


def _parse_block(lines: list[str], start: int, indent: int):
    """Dispatch on first significant line at `indent`."""
    if start >= len(lines):
        return {}, start
    line = lines[start]
    line_indent = _line_indent(line)
    if line_indent != indent:
        return {}, start
    if line.lstrip().startswith("- "):
        return _parse_list(lines, start, indent)
    return _parse_dict(lines, start, indent)


def _parse_dict(lines: list[str], start: int, indent: int):
    result: dict = {}
    i = start
    while i < len(lines):
        line = lines[i]
        line_indent = _line_indent(line)
        if line_indent < indent:
            break
        if line_indent > indent:
            i += 1
            continue
        stripped = line.lstrip()
        if stripped.startswith("- "):
            break
        kv = KV_RE.match(stripped)
        if not kv:
            i += 1
            continue
        key, val = kv.group(1), kv.group(2).strip()
        if val == "":
            sub, i = _parse_block(lines, i + 1, indent + 2)
            result[key] = sub
        elif val.startswith("[") and val.endswith("]"):
            items = [v.strip().strip('"').strip("'") for v in val[1:-1].split(",")]
            result[key] = [v for v in items if v]
            i += 1
        else:
            result[key] = val.strip('"').strip("'")
            i += 1
    return result, i


def _parse_list(lines: list[str], start: int, indent: int):
    result: list = []
    i = start
    while i < len(lines):
        line = lines[i]
        line_indent = _line_indent(line)
        if line_indent < indent:
            break
        if line_indent > indent:
            i += 1
            continue
        stripped = line.lstrip()
        if not stripped.startswith("- "):
            break
        result.append(stripped[2:].strip())
        i += 1
    return result, i


# ----- Checks -----

def check_chores(root: Path, report: Report) -> None:
    chores = root / "docs" / "chores.md"
    if not chores.exists():
        return
    text = chores.read_text(encoding="utf-8")
    ids: dict[str, list[int]] = {}
    placeholders = 0
    for lineno, line in enumerate(text.splitlines(), 1):
        for m in CHORE_ID_RE.finditer(line):
            ident = m.group(1)
            if "?" in ident:
                placeholders += 1
                continue
            ids.setdefault(ident, []).append(lineno)
    for ident, locations in ids.items():
        if len(locations) > 1:
            report.error(
                chores,
                f"duplicate chore ID 'chore-{ident}' at lines {locations}",
            )
    if placeholders:
        report.warn(
            chores,
            f"{placeholders} chore-?????? placeholder(s) present; next `go` or `garden` will assign real IDs",
        )


def check_spec_frontmatter(spec_dir: Path, report: Report) -> None:
    if not spec_dir.exists():
        return
    seen_ids: dict[str, Path] = {}
    for spec in spec_dir.rglob("*.md"):
        text = spec.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        if not fm:
            report.error(spec, "missing frontmatter")
            continue
        for field_name in SPEC_REQUIRED_FIELDS:
            if field_name not in fm:
                report.error(spec, f"frontmatter missing required field: {field_name}")

        # Global ID uniqueness across docs/spec/.
        spec_id = fm.get("id")
        if isinstance(spec_id, str) and spec_id:
            prior = seen_ids.get(spec_id)
            if prior is not None:
                report.error(spec, f"duplicate spec id '{spec_id}' (also in {prior})")
            else:
                seen_ids[spec_id] = spec

        # covers must exist and contain a non-empty paths list.
        covers = fm.get("covers")
        if covers is None:
            report.error(spec, "frontmatter missing required field: covers")
            continue
        # parse_frontmatter renders nested mappings as a list-of-strings under
        # the parent key when the YAML has a "key:" line followed by indented
        # sub-keys; that limitation is acceptable here because the next file
        # read fills the structure if the spec is well-formed. We accept two
        # shapes: (a) covers is a list directly (legacy/inline), (b) covers
        # is a dict and covers.paths is a list. Either must have a non-empty
        # paths collection.
        paths = None
        if isinstance(covers, dict):
            paths = covers.get("paths")
        elif isinstance(covers, list) and covers:
            # Treat the list as the paths.
            paths = covers
        if not isinstance(paths, list) or len(paths) == 0:
            report.error(
                spec,
                "covers.paths must be a non-empty list (otherwise challenge cannot dispatch)",
            )


def check_internal_links(docs_dir: Path, report: Report) -> None:
    if not docs_dir.exists():
        return
    for md in docs_dir.rglob("*.md"):
        text = md.read_text(encoding="utf-8")
        for m in LINK_RE.finditer(text):
            link = m.group(2).split("#")[0].strip()
            if not link or link.startswith(("http://", "https://", "mailto:")):
                continue
            target = (md.parent / link).resolve()
            try:
                target.relative_to(docs_dir.parent.resolve())
            except ValueError:
                # outside repo; skip
                continue
            if not target.exists():
                report.error(md, f"broken link: {link!r}")


def check_active_singleton(todo_dir: Path, report: Report) -> None:
    if not todo_dir.exists():
        return
    active = [p for p in todo_dir.iterdir() if ACTIVE_FILENAME_RE.match(p.name)]
    if len(active) > 1:
        names = ", ".join(p.name for p in active)
        report.error(todo_dir, f"more than one active_*.md found: {names}")


def check_challenge_naming(challenge_dir: Path, report: Report) -> None:
    if not challenge_dir.exists():
        return
    for f in challenge_dir.iterdir():
        if f.is_dir():
            continue
        if f.suffix != ".md":
            continue
        if not CHALLENGE_FILENAME_RE.match(f.name):
            report.error(f, "filename does not match <YYMMDD>_<NN>_<rand>.md")


def check_archive_naming(archive_dir: Path, report: Report) -> None:
    if not archive_dir.exists():
        return
    for f in archive_dir.iterdir():
        if f.is_dir():
            continue
        if f.suffix != ".md":
            continue
        if not ARCHIVE_FILENAME_RE.match(f.name):
            report.warn(f, "filename does not match <description>_<YYMMDD>.md")


def check_staging(staging_dir: Path, root: Path, report: Report) -> None:
    if not staging_dir.exists():
        return
    docs_root = (root / "docs").resolve()
    for stage in staging_dir.rglob("*.md"):
        text = stage.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        if not fm:
            report.error(stage, "staging file missing frontmatter")
            continue
        for field_name in STAGING_REQUIRED_FIELDS:
            if field_name not in fm:
                report.error(stage, f"staging frontmatter missing: {field_name}")
        target = fm.get("target_doc")
        if isinstance(target, str):
            # Confine target_doc to docs/. Reject absolute paths and any
            # resolved path outside <root>/docs/.
            if target.startswith("/"):
                report.error(stage, f"target_doc must not be absolute: {target!r}")
                continue
            target_path = (root / target).resolve()
            try:
                target_path.relative_to(docs_root)
            except ValueError:
                report.error(stage, f"target_doc escapes docs/: {target!r}")
                continue
            if not target_path.exists():
                # New-file staging is allowed only if base_content_sha256 is null/missing.
                base_sha = fm.get("base_content_sha256")
                if base_sha not in (None, "", "null"):
                    report.error(
                        stage,
                        "base_content_sha256 set but target_doc does not exist "
                        "(new-file staging must use null)",
                    )
                if not target_path.parent.exists():
                    report.error(stage, f"target_doc parent missing: {target}")


# ----- Main -----

def run_checks(root: Path) -> Report:
    report = Report()
    docs = root / "docs"
    if not docs.exists():
        report.warn(root, "docs/ not found; nothing to check")
        return report

    check_chores(root, report)
    check_spec_frontmatter(docs / "spec", report)
    check_internal_links(docs, report)
    check_active_singleton(docs / "todo", report)
    check_challenge_naming(docs / "challenge", report)
    check_archive_naming(docs / "todo" / "archive", report)
    check_staging(root / ".docdoki" / "staging", root, report)

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    report = run_checks(args.root.resolve())

    if args.json:
        payload = {
            "status": "failure" if report.error_count else "success",
            "errors": report.error_count,
            "warnings": report.warning_count,
            "issues": [
                {"level": i.level, "path": i.path, "message": i.message}
                for i in report.issues
            ],
        }
        print(json.dumps(payload, indent=2))
    else:
        for issue in report.issues:
            print(issue.render())
        print(f"\n{report.error_count} error(s), {report.warning_count} warning(s)")

    return 1 if report.error_count else 0


if __name__ == "__main__":
    sys.exit(main())
