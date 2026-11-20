"""Shared skill frontmatter and metadata validation for library audit and packaging.

Requires PyYAML so audit and packaging enforce identical YAML parsing and duplicate-key
rejection without maintaining a second frontmatter parser.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML is required. Run with a Python environment containing PyYAML.")

ALLOWED_EXTRA_PROPERTIES = frozenset({"disable-model-invocation"})
_FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently losing entries."""

    def construct_mapping(self, node, deep=False):
        keys = [self.construct_object(key, deep=deep) for key, _ in node.value]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate YAML mapping key")
        return super().construct_mapping(node, deep=deep)


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


def extend_validator_module(module):
    """Apply library-supported frontmatter extensions in-process."""
    module.ALLOWED_PROPERTIES = set(module.ALLOWED_PROPERTIES) | ALLOWED_EXTRA_PROPERTIES
    return module.validate_skill


def load_validator(validator_path: Path):
    """Load a bundled quick_validate.py in-process without mutating files on disk."""
    validator_path = Path(validator_path).resolve()
    scripts_dir = str(validator_path.parent)
    prev_frontmatter = sys.modules.pop("frontmatter", None)
    sys.path.insert(0, scripts_dir)
    try:
        spec = importlib.util.spec_from_file_location("_quick_validate", validator_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        if sys.path and sys.path[0] == scripts_dir:
            sys.path.pop(0)
        sys.modules.pop("frontmatter", None)
        if prev_frontmatter is not None:
            sys.modules["frontmatter"] = prev_frontmatter
    return extend_validator_module(module)


def validate_skill_directory(
    skill_dir: Path,
    *,
    expected_name: str | None = None,
    validate_skill=None,
) -> list[str]:
    """Validate a skill directory's SKILL.md metadata and optional bundled validator."""
    skill_dir = Path(skill_dir).resolve()
    name = expected_name or skill_dir.name
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return ["SKILL.md not found"]

    errors: list[str] = []
    text = skill_md.read_text(encoding="utf-8")
    try:
        metadata = parse_frontmatter_strict(text)
    except ValueError as exc:
        errors.append(str(exc))
    else:
        if metadata.get("name") != name:
            errors.append("frontmatter name mismatch")
        description = metadata.get("description")
        if not isinstance(description, str) or not description.strip():
            errors.append("empty/non-string description")
        if "disable-model-invocation" in metadata and type(metadata["disable-model-invocation"]) is not bool:
            errors.append("disable-model-invocation must be a boolean")

    if validate_skill is not None:
        valid, message = validate_skill(skill_dir)
        if not valid:
            errors.append(message)

    return errors
