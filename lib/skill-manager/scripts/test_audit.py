"""Deterministic audit checks using disposable local repositories; no network."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import audit


LIBRARY = Path(__file__).resolve().parents[2]


def skill_text(name):
    return f"---\nname: {name}\ndescription: A test skill.\n---\n\n# Test\n"


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ("demo", "openai-skill-creator"):
            path = self.root / "lib" / name
            path.mkdir(parents=True)
            (path / "SKILL.md").write_text(skill_text(name))
        scripts = self.root / "lib/openai-skill-creator/scripts"
        scripts.mkdir()
        for name in ("quick_validate.py", "frontmatter.py"):
            shutil.copy2(LIBRARY / "openai-skill-creator/scripts" / name, scripts / name)
        (self.root / "agents-fragments").mkdir()
        (self.root / "skills").mkdir()
        (self.root / "skills/demo").symlink_to("../lib/demo")
        self.demo = {"name": "demo", "pack": "always-on", "source_repo": "custom", "source_path": "lib/demo"}
        self.manifest = {
            "source_repos": {"custom": {"type": "custom", "path": "."}},
            "skills": [self.demo, {"name": "openai-skill-creator", "pack": "agent-dev", "source_repo": "custom", "source_path": "lib/openai-skill-creator"}],
        }
        self.save()

    def save(self):
        (self.root / "manifest.yaml").write_text(audit.yaml.safe_dump(self.manifest))

    def check(self, **kwargs):
        return audit.audit(self.root, **kwargs)

    def error(self, text, **kwargs):
        errors, _, _ = self.check(**kwargs)
        self.assertIn(text, "\n".join(errors))

    def source(self):
        repo = self.root / "sources/example"
        repo.mkdir(parents=True)
        self.git(repo, "init", "-q")
        self.git(repo, "config", "user.name", "Audit Test")
        self.git(repo, "config", "user.email", "audit@example.invalid")
        self.git(repo, "config", "commit.gpgsign", "false")
        self.git(repo, "remote", "add", "origin", "https://example.invalid/skills.git")
        shutil.copytree(self.root / "lib/demo", repo / "demo")
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-qm", "fixture")
        self.manifest["source_repos"]["example"] = {"url": "https://example.invalid/skills.git"}
        self.demo.update(source_repo="example", source_path="demo", source_commit=self.git(repo, "rev-parse", "HEAD").strip())
        self.save()
        return repo

    @staticmethod
    def git(repo, *args):
        return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.PIPE, text=True)

    def test_default_needs_no_sources(self):
        errors, reviews, count = self.check()
        self.assertEqual((errors, reviews, count), ([], [], 2))

    def test_duplicate_yaml_keys(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            audit.load_yaml("skills: []\nskills: []\n")

    def test_duplicate_names(self):
        self.manifest["skills"].append(dict(self.demo))
        self.save()
        self.error("Duplicate skill name")

    def test_frontmatter_name_and_description(self):
        (self.root / "lib/demo/SKILL.md").write_text("---\nname: wrong\ndescription: ''\n---\n")
        self.error("frontmatter name mismatch")
        self.error("empty/non-string description")

    def test_native_invocation_flag_is_preserved_and_typed(self):
        path = self.root / "lib/demo/SKILL.md"
        path.write_text(skill_text("demo").replace("description:", "disable-model-invocation: true\ndescription:"))
        before = path.read_bytes()
        self.assertEqual(self.check()[0], [])
        self.assertEqual(path.read_bytes(), before)
        path.write_text(path.read_text().replace("invocation: true", 'invocation: "true"'))
        self.error("disable-model-invocation must be a boolean")

    def test_unknown_frontmatter_remains_an_error(self):
        path = self.root / "lib/demo/SKILL.md"
        path.write_text(skill_text("demo").replace("description:", "unexpected-field: true\ndescription:"))
        self.error("Unexpected key(s)")

    def test_git_metadata_is_not_skill_content(self):
        path = self.root / "lib/demo/.git"
        path.mkdir()
        (path / "config").write_text("do not import me")
        self.error("repository internals in skill")

    def test_exact_always_on_target(self):
        link = self.root / "skills/demo"
        link.unlink()
        link.symlink_to("../lib/openai-skill-creator")
        self.error("expected -> ../lib/demo")

    def test_unregistered_entries(self):
        (self.root / "skills/extra").symlink_to("../lib/demo")
        (self.root / "lib/extra").mkdir()
        self.error("does not match pack: always-on")
        self.error("Unregistered lib entry")

    def test_broken_inner_link(self):
        (self.root / "lib/demo/broken").symlink_to("missing")
        self.error("broken, absolute, or library-escaping link")

    def test_escaping_source_path(self):
        self.demo["source_path"] = "../outside"
        self.save()
        self.error("source_path must stay inside")

    def test_pinned_commit_not_cache_head(self):
        repo = self.source()
        (repo / "demo/SKILL.md").write_text(skill_text("demo") + "new upstream\n")
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-qm", "newer cache")
        self.assertEqual(self.check(sources=True)[:2], ([], []))

    def test_missing_clone_only_fails_source_check(self):
        repo = self.source()
        shutil.rmtree(repo)
        self.assertEqual(self.check()[0], [])
        self.error("cannot inspect pinned source", sources=True)

    def test_invalid_pin(self):
        self.source()
        self.demo["source_commit"] = "main"
        self.save()
        self.error("missing/invalid full source_commit")

    def test_diff_requires_notes_and_checks_executable_bit(self):
        self.source()
        path = self.root / "lib/demo/SKILL.md"
        path.chmod(path.stat().st_mode | 0o111)
        self.error("local differences have no normalization notes", sources=True)
        self.demo["notes"] = "Test executable normalization."
        self.save()
        errors, reviews, _ = self.check(sources=True)
        self.assertEqual(errors, [])
        self.assertEqual(reviews, ["demo: SKILL.md"])

    def test_source_link_targets_are_compared(self):
        repo = self.source()
        (repo / "demo/ref").symlink_to("SKILL.md")
        self.git(repo, "add", ".")
        self.git(repo, "commit", "-qm", "link")
        self.demo["source_commit"] = self.git(repo, "rev-parse", "HEAD").strip()
        self.save()
        (self.root / "lib/demo/ref").symlink_to("../openai-skill-creator/SKILL.md")
        self.error("local differences have no normalization notes", sources=True)
        self.assertEqual(self.check(sources=True)[1], ["demo: ref"])

    def test_dirty_source_is_reported(self):
        repo = self.source()
        (repo / "untracked").write_text("keep me")
        self.error("source checkout is dirty", sources=True)

    def test_runtime_owned_payload_is_preserved(self):
        runtime = self.root / "runtime"
        runtime.mkdir()
        owned = runtime / ".system"
        owned.mkdir()
        (owned / "private").write_text("owned")
        (runtime / "demo").symlink_to("../skills/demo")
        self.assertEqual(self.check(runtimes=[runtime])[0], [])
        self.assertEqual((owned / "private").read_text(), "owned")
        (runtime / "demo").unlink()
        (runtime / "demo").mkdir()
        self.error("expected relative skill link", runtimes=[runtime])

    def test_source_audit_writes_nothing(self):
        self.source()

        def snapshot():
            return {
                str(p.relative_to(self.root)): (p.lstat().st_mode, p.lstat().st_mtime_ns,
                    os.readlink(p) if p.is_symlink() else p.read_bytes() if p.is_file() else None)
                for p in self.root.rglob("*")
            }

        before = snapshot()
        self.assertEqual(self.check(sources=True)[0], [])
        self.assertEqual(snapshot(), before)
        self.assertEqual(self.check(sources=True)[0], [])
        self.assertEqual(snapshot(), before)


if __name__ == "__main__":
    unittest.main()
