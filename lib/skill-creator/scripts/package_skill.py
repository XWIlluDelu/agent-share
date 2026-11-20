#!/usr/bin/env python3
"""Package a skill via bundled anthropic-skill-creator using shared library metadata validation.

Shares SKILL.md frontmatter rules with skill-manager/scripts/audit.py via
skill-manager/scripts/skill_validation.py, preserving boolean `disable-model-invocation`
without modifying upstream creator files, and refusing output inside bundled creators.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

sys.dont_write_bytecode = True


def _load_shared_validation(library_dir: Path):
    scripts_dir = (library_dir / "skill-manager/scripts").resolve()
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    return importlib.import_module("skill_validation")


def _load_packager(anthropic_dir: Path):
    anthropic_str = str(anthropic_dir)
    if anthropic_str not in sys.path:
        sys.path.insert(0, anthropic_str)
    return importlib.import_module("scripts.package_skill")


def package_skill(skill_path: str | Path, output_dir: str | Path | None = None) -> Path | None:
    skill_creator_dir = Path(__file__).resolve().parent.parent
    library_dir = skill_creator_dir.parent
    anthropic_dir = (skill_creator_dir / "anthropic-skill-creator").resolve()
    openai_dir = (skill_creator_dir / "openai-skill-creator").resolve()
    if not anthropic_dir.is_dir():
        print(f"Error: bundled anthropic-skill-creator not found at {anthropic_dir}", file=sys.stderr)
        return None

    target_output = Path(output_dir).resolve() if output_dir else Path.cwd().resolve()
    for bundled in (anthropic_dir, openai_dir):
        if bundled.is_dir() and target_output.is_relative_to(bundled):
            print(
                f"Error: output directory {target_output} must be outside bundled creator {bundled}",
                file=sys.stderr,
            )
            return None

    shared = _load_shared_validation(library_dir)
    package_mod = _load_packager(anthropic_dir)
    orig_validate = package_mod.validate_skill

    def validate_for_package(path: str | Path) -> tuple[bool, str]:
        errors = shared.validate_skill_directory(Path(path))
        return (False, "; ".join(errors)) if errors else (True, "Skill is valid!")

    package_mod.validate_skill = validate_for_package
    try:
        return package_mod.package_skill(skill_path, target_output)
    finally:
        package_mod.validate_skill = orig_validate


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args or len(args) > 2 or args[0] in {"-h", "--help"}:
        print("Usage: python3 package_skill.py <skill-folder> [output-dir]")
        return 0 if args and args[0] in {"-h", "--help"} else 1

    skill_path = args[0]
    output_dir = args[1] if len(args) > 1 else None
    result = package_skill(skill_path, output_dir)
    return 0 if result is not None else 1


if __name__ == "__main__":
    raise SystemExit(main())
