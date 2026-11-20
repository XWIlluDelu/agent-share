"""Offline regressions for maintained local runtime normalizations."""

import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


LIBRARY = Path(__file__).resolve().parents[2]
SEMANTIC_SKILLS = ("paper-triage", "expand-references", "trace-citations")


def load_launcher(name):
    path = LIBRARY / name / "scripts/_shared/launcher.py"
    module_name = "test_launcher_" + name.replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class NormalizationTests(unittest.TestCase):
    def test_argument_summaries_do_not_expose_api_keys(self):
        api_key = "synthetic-secret"
        for name in SEMANTIC_SKILLS:
            with self.subTest(skill=name):
                module = load_launcher(name)
                common = dict(runtime_mode="vendored", runtime_module=None)
                success = module.success_payload(
                    name,
                    arguments={"api_key_override": api_key},
                    result={"count": 3},
                    **common,
                )
                failure = module.error_payload(
                    name,
                    arguments={"api_key_override": api_key},
                    exc=RuntimeError("request failed"),
                    **common,
                )
                for payload in (success, failure):
                    self.assertNotIn(api_key, module.dumps_payload(payload))

    def test_notebook_default_output_belongs_to_the_caller(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp)
            subprocess.run(["git", "init", "-q", str(project)], check=True)
            cwd = project / "nested"
            cwd.mkdir()
            link = project / "skill-link"
            link.symlink_to(LIBRARY / "jupyter-notebook", target_is_directory=True)
            result = subprocess.run(
                [sys.executable, "-B", str(link / "scripts/new_notebook.py"), "--title", "Caller output"],
                cwd=cwd, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            notebooks = list((project / "output/jupyter-notebook").glob("*.ipynb"))
            self.assertEqual(len(notebooks), 1)


if __name__ == "__main__":
    unittest.main()
