#!/usr/bin/env python3
"""Compute the canonical staging path for a (target_doc, source) pair.

Usage:
    staging_path.py <target_doc> <source>

    target_doc:   path under docs/, e.g. docs/spec/auth.md or just spec/auth.md
    source:       one of polish, challenge, garden

Output:
    Prints the staging path to stdout, one line, suitable for command
    substitution.

Examples:
    staging_path.py docs/spec/auth.md challenge
        -> .docdoki/staging/spec/auth.md.challenge.md

    staging_path.py northstar.md polish
        -> .docdoki/staging/northstar.md.polish.md
"""

import argparse
import sys
from pathlib import Path, PurePosixPath

VALID_SOURCES = {"polish", "challenge", "garden"}
STAGING_ROOT = PurePosixPath(".docdoki/staging")


def compute_staging_path(target_doc: str, source: str) -> str:
    if source not in VALID_SOURCES:
        raise ValueError(
            f"source must be one of {sorted(VALID_SOURCES)}, got {source!r}"
        )
    if "\x00" in target_doc:
        raise ValueError("target_doc must not contain NUL bytes")

    raw = PurePosixPath(target_doc.replace("\\", "/"))
    if raw.is_absolute():
        raise ValueError(f"target_doc must not be absolute: {target_doc!r}")
    # Reject any `..` segment, whether or not it survives normalization.
    if any(p == ".." for p in raw.parts):
        raise ValueError(f"target_doc must not contain `..` segments: {target_doc!r}")

    # Drop leading "." segments (e.g. "./docs/spec/auth.md") and an optional
    # leading "docs" so the staging suffix carries the path inside docs/.
    parts = [p for p in raw.parts if p != "."]
    if parts and parts[0] == "docs":
        parts = parts[1:]
    if not parts:
        raise ValueError(f"target_doc must point to a file under docs/, got {target_doc!r}")

    rel = PurePosixPath(*parts)
    return str(STAGING_ROOT / f"{rel}.{source}.md")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("target_doc")
    parser.add_argument("source", choices=sorted(VALID_SOURCES))
    args = parser.parse_args()

    try:
        print(compute_staging_path(args.target_doc, args.source))
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
