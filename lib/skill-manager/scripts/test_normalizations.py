"""Offline regressions for maintained local runtime normalizations."""

import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


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
    def test_argument_summaries_redact_keys_without_mutating_inputs(self):
        for name in SEMANTIC_SKILLS:
            with self.subTest(skill=name):
                module = load_launcher(name)
                arguments = {"query": "graph learning", "api_key_override": "synthetic-secret"}
                common = dict(runtime_mode="vendored", runtime_module=None, arguments=arguments)
                success = module.success_payload(name, result={"count": 3}, **common)
                failure = module.error_payload(name, exc=RuntimeError("request failed"), **common)
                for payload in (success, failure):
                    self.assertNotIn("synthetic-secret", module.dumps_payload(payload))
                    self.assertEqual(payload["arguments"]["api_key_override"], "[REDACTED]")
                    self.assertEqual(payload["arguments"]["query"], "graph learning")
                self.assertEqual(arguments["api_key_override"], "synthetic-secret")
                self.assertEqual(module._public_arguments({"api_key_override": None}), {"api_key_override": None})
                self.assertEqual(module._public_arguments({}), {})

    def test_runtime_receives_original_key_on_success_and_failure(self):
        for name in SEMANTIC_SKILLS:
            for fail in (False, True):
                with self.subTest(skill=name, failure=fail):
                    module = load_launcher(name)
                    received = []

                    async def run_workflow(workflow, **kwargs):
                        received.append(kwargs["api_key_override"])
                        if fail:
                            raise RuntimeError("request failed")
                        return {"count": 3}

                    runtime = SimpleNamespace(run_workflow=run_workflow)
                    with patch.object(module, "load_runtime", return_value=("vendored", runtime)):
                        result = module.launch(name, api_key_override="synthetic-secret")
                    self.assertEqual(received, ["synthetic-secret"])
                    self.assertEqual(result.exit_code, int(fail))
                    self.assertNotIn("synthetic-secret", module.dumps_payload(result.payload))

    def test_notebook_default_output_belongs_to_the_caller(self):
        for in_git in (False, True):
            with self.subTest(in_git=in_git), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                store = root / "shared-library"
                store.mkdir()
                (store / ".git").mkdir()
                skill = store / "jupyter-notebook"
                shutil.copytree(LIBRARY / "jupyter-notebook", skill)
                project = root / "project"
                cwd = project / "nested"
                cwd.mkdir(parents=True)
                if in_git:
                    (project / ".git").mkdir()
                link = project / "skill-link"
                link.symlink_to(skill, target_is_directory=True)
                result = subprocess.run(
                    [sys.executable, "-B", str(link / "scripts/new_notebook.py"), "--title", "Caller output"],
                    cwd=cwd, capture_output=True, text=True,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                expected = (project if in_git else cwd) / "output/jupyter-notebook/caller-output.ipynb"
                notebook = json.loads(expected.read_text())
                self.assertIn("Caller output", notebook["cells"][0]["source"][0])
                self.assertFalse((store / "output").exists())

    def test_entrypoints_work_through_links_from_an_unrelated_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in SEMANTIC_SKILLS:
                with self.subTest(skill=name):
                    link = root / name
                    link.symlink_to(LIBRARY / name, target_is_directory=True)
                    result = subprocess.run(
                        [sys.executable, "-B", str(link / "scripts/run.py"), "--help"],
                        cwd=root, capture_output=True, text=True,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn("--api-key", result.stdout)


if __name__ == "__main__":
    unittest.main()
