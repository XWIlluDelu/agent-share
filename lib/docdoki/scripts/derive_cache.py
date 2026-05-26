#!/usr/bin/env python3
"""Rebuild .docdoki/cache.json from docs/challenge/*.md.

Usage:
    derive_cache.py [--challenge-dir docs/challenge] [--cache .docdoki/cache.json]
                    [--repo-root PATH]

Behavior:
    - Scans every .md under the challenge directory in chronological order
      (by filename — the YYMMDD_NN_rand prefix sorts naturally).
    - For each spec id that appears in a verdict=pass section, records the
      latest such report as that spec's alignment anchor.
    - The anchor SHA is the *introducing commit* of the report file, found via
      `git log -1 --format=%H -- <path>`. This is the SHA that survives rebase
      / squash / cherry-pick (because the report file follows git history). It
      also defeats the pre-commit-challenge false-stale scenario: an
      uncommitted report has no introducing commit and is not yet an anchor.
    - Writes the JSON index. Safe to run any time; cache is fully derivable.

The cache schema:
    {
      "schema_version": 2,
      "alignment_anchors": {
        "<spec-id>": {
          "latest_pass_report": "docs/challenge/...",
          "anchor_commit": "<sha>",          # introducing commit; missing if uncommitted
          "diagnostic_run_rev": "<sha>"      # what HEAD was when the run started
        },
        ...
      },
      "pending_pass_reports": ["docs/challenge/..."]   # pass reports not yet committed
    }

Output:
    On success, prints "wrote <path>: <N> anchors (<K> pending)" to stdout.
    On parse errors in any report, prints a warning to stderr but continues
    (a bad report shouldn't break the whole cache).
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# Minimal frontmatter parser for our limited needs. Avoids a PyYAML dependency.
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
KV_RE = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$")


def parse_frontmatter(text: str) -> dict:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    out: dict = {}
    current_list: list | None = None
    for raw_line in m.group(1).splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        # List item under previous key.
        if line.startswith("  - ") or (line.startswith("- ") and current_list is not None):
            value = line.lstrip("- ").strip()
            current_list.append(value)
            continue
        kv = KV_RE.match(line)
        if kv:
            key, val = kv.group(1), kv.group(2).strip()
            if val == "":
                current_list = []
                out[key] = current_list
            else:
                current_list = None
                if val.startswith("[") and val.endswith("]"):
                    items = [v.strip().strip('"').strip("'") for v in val[1:-1].split(",")]
                    out[key] = [v for v in items if v]
                else:
                    out[key] = val.strip('"').strip("'")
    return out


# Section header per the report schema: "## <spec-id>"
SECTION_RE = re.compile(r"^## (\S+)\s*$", re.MULTILINE)
VERDICT_RE = re.compile(r"^verdict:\s*(pass|fail|uncertain)\s*$", re.MULTILINE)


def extract_sections(body: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    matches = list(SECTION_RE.finditer(body))
    for i, m in enumerate(matches):
        spec_id = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        sections.append((spec_id, body[start:end]))
    return sections


def introducing_commit(repo_root: Path, path: Path) -> str | None:
    """Return the SHA of the commit that introduced `path`, or None if the
    file is uncommitted / git is unavailable.
    """
    try:
        rel = path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return None
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%H", "--", str(rel)],
            cwd=repo_root, capture_output=True, text=True, check=True,
        )
        sha = out.stdout.strip()
        return sha or None
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def derive(challenge_dir: Path, repo_root: Path) -> dict:
    anchors: dict[str, dict] = {}
    pending: list[str] = []
    if not challenge_dir.exists():
        return {"schema_version": 2, "alignment_anchors": {}, "pending_pass_reports": []}

    files = sorted(p for p in challenge_dir.iterdir() if p.suffix == ".md")
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
            fm = parse_frontmatter(text)
            fm_match = FRONTMATTER_RE.match(text)
            body = text[fm_match.end():] if fm_match else text
            diagnostic_rev = fm.get("git_rev", "")
            anchor_commit = introducing_commit(repo_root, path)
            for spec_id, section in extract_sections(body):
                verdict_match = VERDICT_RE.search(section)
                if not verdict_match:
                    continue
                if verdict_match.group(1) != "pass":
                    continue
                if anchor_commit is None:
                    # Uncommitted pass report — record as pending, do not anchor.
                    pending_entry = str(path)
                    if pending_entry not in pending:
                        pending.append(pending_entry)
                    continue
                # files are sorted, so later overwrites win → correct semantics
                anchors[spec_id] = {
                    "latest_pass_report": str(path),
                    "anchor_commit": anchor_commit,
                    "diagnostic_run_rev": diagnostic_rev,
                }
        except Exception as exc:
            print(f"warning: failed to parse {path}: {exc}", file=sys.stderr)
            continue

    return {
        "schema_version": 2,
        "alignment_anchors": anchors,
        "pending_pass_reports": pending,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--challenge-dir", type=Path, default=Path("docs/challenge"))
    parser.add_argument("--cache", type=Path, default=Path(".docdoki/cache.json"))
    parser.add_argument("--repo-root", type=Path, default=Path("."),
                        help="Repo root (used to resolve relative paths and run git).")
    args = parser.parse_args()

    cache = derive(args.challenge_dir, args.repo_root)
    args.cache.parent.mkdir(parents=True, exist_ok=True)
    args.cache.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")
    print(
        f"wrote {args.cache}: {len(cache['alignment_anchors'])} anchors "
        f"({len(cache['pending_pass_reports'])} pending)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
