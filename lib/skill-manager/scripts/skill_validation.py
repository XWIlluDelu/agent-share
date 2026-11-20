"""Validate shared library metadata for audit and packaging."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML is required. Run with a Python environment containing PyYAML.")

_SKILL_FIELDS = {
    "name", "description", "license", "compatibility", "metadata",
    "allowed-tools", "disable-model-invocation",
}
_SKILL_NAME_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
_FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently losing entries."""

    def construct_mapping(self, node, deep=False):
        mapping = super().construct_mapping(node, deep=deep)
        if len(mapping) != len(node.value):
            raise ValueError("Duplicate YAML mapping key")
        return mapping


def load_yaml(text: str):
    return yaml.load(text, Loader=UniqueLoader)


def parse_frontmatter_strict(text: str) -> dict:
    """Parse SKILL.md YAML frontmatter, rejecting missing blocks and duplicate keys."""
    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError("invalid frontmatter")
    try:
        metadata = load_yaml(match.group(1))
    except yaml.YAMLError as exc:
        raise ValueError(f"invalid frontmatter: {exc}") from exc
    if not isinstance(metadata, dict):
        raise ValueError("invalid frontmatter")
    return metadata


def valid_skill_name(name: object) -> bool:
    return isinstance(name, str) and len(name) <= 64 and _SKILL_NAME_RE.fullmatch(name) is not None


def validate_skill_directory(skill_dir: Path) -> list[str]:
    """Check the portable frontmatter and the library's native invocation flag."""
    skill_dir = Path(skill_dir).resolve()
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return ["SKILL.md not found"]

    try:
        metadata = parse_frontmatter_strict(skill_md.read_text(encoding="utf-8"))
    except ValueError as exc:
        return [str(exc)]

    errors: list[str] = []
    unexpected = metadata.keys() - _SKILL_FIELDS
    if unexpected:
        errors.append(f"Unexpected key(s) in frontmatter: {', '.join(sorted(map(str, unexpected)))}")
    name = metadata.get("name")
    if name != skill_dir.name:
        errors.append("frontmatter name mismatch")
    elif not valid_skill_name(name):
        errors.append("name must be lowercase hyphen-case and at most 64 characters")
    description = metadata.get("description")
    if not isinstance(description, str) or not description.strip():
        errors.append("empty/non-string description")
    elif len(description) > 1024:
        errors.append("description exceeds 1024 characters")
    if "compatibility" in metadata:
        compatibility = metadata["compatibility"]
        if not isinstance(compatibility, str) or not compatibility.strip() or len(compatibility) > 500:
            errors.append("compatibility must be a non-empty string of at most 500 characters")
    if "disable-model-invocation" in metadata and type(metadata["disable-model-invocation"]) is not bool:
        errors.append("disable-model-invocation must be a boolean")
    return errors
