"""Exercise the local packaging entry point with an independent skill fixture."""

import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

import yaml


SCRIPT = Path(__file__).resolve().with_name("package_skill.py")
LIBRARY = SCRIPT.parents[2]


class PackageSkillTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.skill = self.root / "demo-skill"
        self.skill.mkdir()
        self.output = self.root / "dist"
        self.archive = self.output / "demo-skill.skill"
        self.metadata = self.skill / "SKILL.md"
        self.metadata.write_text(
            "---\nname: demo-skill\ndescription: Demonstrate packaging.\n"
            "disable-model-invocation: true\n---\n\n# Demo skill\n",
            encoding="utf-8",
        )

    def run_packager(self, output, script=SCRIPT):
        return subprocess.run(
            [sys.executable, "-B", str(script), str(self.skill), str(output)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_package_preserves_explicit_invocation(self):
        result = self.run_packager(self.output)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        with zipfile.ZipFile(self.archive) as archive:
            skill_text = archive.read("demo-skill/SKILL.md").decode("utf-8")
        metadata = skill_text.split("---", 2)[1]
        self.assertIs(yaml.safe_load(metadata)["disable-model-invocation"], True)

    def test_invalid_skill_does_not_produce_archive(self):
        original = self.metadata.read_text(encoding="utf-8")
        self.metadata.write_text(
            original.replace("name: demo-skill", "name: wrong-name"), encoding="utf-8"
        )
        result = self.run_packager(self.output)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertFalse(self.archive.exists())

    def test_output_cannot_pollute_bundled_creator(self):
        wrapper = self.root / "skill-creator"
        script = wrapper / "scripts/package_skill.py"
        script.parent.mkdir(parents=True)
        shutil.copyfile(SCRIPT, script)
        bundled = wrapper / "anthropic-skill-creator"
        bundled.mkdir()
        (bundled / "scripts").symlink_to(
            LIBRARY / "anthropic-skill-creator/scripts", target_is_directory=True
        )
        (self.root / "skill-manager").symlink_to(LIBRARY / "skill-manager", target_is_directory=True)

        result = self.run_packager(bundled, script=script)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertFalse((bundled / self.archive.name).exists())


if __name__ == "__main__":
    unittest.main()
