"""Minimal YAML frontmatter parser for SKILL.md.

Skill frontmatter is simple enough that pulling in pyyaml is not justified,
and pyyaml is not always installed. This parser extracts only what the
skill-creator scripts need: the set of top-level keys, plus the `name` and
`description` values. It is not a general YAML parser.
"""

from __future__ import annotations

import re
from pathlib import Path

_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
_KEY_RE = re.compile(r"^([A-Za-z][\w-]*):[ \t]*(.*)$")
_BLOCK_INDICATORS = {">", "|", ">-", "|-"}


def _strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
        return value[1:-1]
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, str], str, str] | None:
    """Parse SKILL.md frontmatter.

    Returns (top_level_keys, name, description) where top_level_keys maps each
    top-level key to its raw single-line value (or "" for block scalars / empty
    values). Returns None if no frontmatter block is found.
    """
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return None
    lines = match.group(1).split("\n")

    top: dict[str, str] = {}
    name = ""
    description = ""
    i = 0
    while i < len(lines):
        line = lines[i]
        m = _KEY_RE.match(line)
        if not m:
            i += 1
            continue
        key, rest = m.group(1), m.group(2)
        top[key] = rest
        if key == "name":
            name = _strip_quotes(rest)
        elif key == "description":
            value = _strip_quotes(rest)
            if value in _BLOCK_INDICATORS:
                parts: list[str] = []
                i += 1
                while i < len(lines) and (lines[i].startswith("  ") or lines[i].startswith("\t")):
                    parts.append(lines[i].strip())
                    i += 1
                description = " ".join(parts)
                continue
            description = value
        i += 1

    return top, name, description


def parse_frontmatter_file(path: Path) -> tuple[dict[str, str], str, str]:
    """Read and parse a SKILL.md frontmatter. Raises FileNotFoundError if missing."""
    return parse_frontmatter(Path(path).read_text())  # type: ignore[return-value]
