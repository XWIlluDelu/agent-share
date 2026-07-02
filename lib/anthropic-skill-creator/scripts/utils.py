"""Shared utilities for skill-creator scripts."""

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
    """Parse SKILL.md frontmatter without pyyaml.

    Returns (top_level_keys, name, description) where top_level_keys maps each
    top-level key to its raw single-line value (or "" for block scalars).
    Returns None if no frontmatter block is found.
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


def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:"):].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:"):].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (frontmatter_lines[i].startswith("  ") or frontmatter_lines[i].startswith("\t")):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    return name, description, content
