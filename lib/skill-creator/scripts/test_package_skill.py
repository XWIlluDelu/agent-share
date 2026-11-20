#!/usr/bin/env python3
"""Tests for skill-creator's library-aware packaging wrapper."""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SCRIPT = SCRIPTS_DIR / "package_skill.py"
LIBRARY = SCRIPTS_DIR.parents[1]


class PackageSkillTests(unittest.TestCase):
    def run_packager(self, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-B", str(SCRIPT), *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_packages_paper_triage_preserving_disable_model_invocation(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td)
            proc = self.run_packager(str(LIBRARY / "paper-triage"), str(out_dir))
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            archive = out_dir / "paper-triage.skill"
            self.assertTrue(archive.is_file())
            with zipfile.ZipFile(archive) as zf:
                skill_md = zf.read("paper-triage/SKILL.md").decode("utf-8")
                self.assertIn("disable-model-invocation: true", skill_md)

    def test_rejects_non_boolean_disable_model_invocation_and_unknown_keys(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            out_dir = root / "dist"
            skill = root / "demo-skill"
            skill.mkdir()

            (skill / "SKILL.md").write_text(
                '---\nname: demo-skill\ndescription: Test.\ndisable-model-invocation: "true"\n---\n# Demo\n',
                encoding="utf-8",
            )
            bad_bool = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(bad_bool.returncode, 1)
            self.assertIn("must be a boolean", bad_bool.stdout)

            (skill / "SKILL.md").write_text(
                "---\nname: demo-skill\ndescription: Test.\ndisable-model-invocation: false\ndisable-model-invocation: true\n---\n# Demo\n",
                encoding="utf-8",
            )
            dup_key = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(dup_key.returncode, 1)
            self.assertIn("Duplicate YAML mapping key", dup_key.stdout)

            (skill / "SKILL.md").write_text(
                "---\nname: demo-skill\ndescription: Test.\nmetadata: {owner: alice, owner: bob}\n---\n# Demo\n",
                encoding="utf-8",
            )
            dup_flow = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(dup_flow.returncode, 1)
            self.assertIn("Duplicate YAML mapping key", dup_flow.stdout)

            (skill / "SKILL.md").write_text(
                "---\nname: demo-skill\ndescription: 123\n---\n# Demo\n",
                encoding="utf-8",
            )
            non_str_desc = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(non_str_desc.returncode, 1)
            self.assertIn("empty/non-string description", non_str_desc.stdout)

            (skill / "SKILL.md").write_text(
                "---\nname: demo-skill\ndescription: Test.\nunexpected-field: true\n---\n# Demo\n",
                encoding="utf-8",
            )
            bad_key = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(bad_key.returncode, 1)
            self.assertIn("Unexpected key(s)", bad_key.stdout)

    def test_enforces_name_matches_folder_and_nonempty_description(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            out_dir = root / "dist"
            skill = root / "demo-skill"
            skill.mkdir()

            (skill / "SKILL.md").write_text(
                "---\nname: other-name\ndescription: Test.\n---\n# Demo\n",
                encoding="utf-8",
            )
            mismatch = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(mismatch.returncode, 1)
            self.assertIn("frontmatter name mismatch", mismatch.stdout)

            (skill / "SKILL.md").write_text(
                "---\nname: demo-skill\ndescription: ''\n---\n# Demo\n",
                encoding="utf-8",
            )
            empty_desc = self.run_packager(str(skill), str(out_dir))
            self.assertEqual(empty_desc.returncode, 1)
            self.assertIn("empty/non-string description", empty_desc.stdout)

    def test_refuses_output_inside_bundled_creators(self) -> None:
        proc = self.run_packager(
            str(LIBRARY / "paper-triage"),
            str(LIBRARY / "anthropic-skill-creator"),
        )
        self.assertEqual(proc.returncode, 1)
        self.assertIn("must be outside bundled creator", proc.stderr)


if __name__ == "__main__":
    unittest.main()
