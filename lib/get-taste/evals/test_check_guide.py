"""Check the guide helper and bundled examples; no model or network required."""

import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_guide import check_text


class GuideChecks(unittest.TestCase):
    def test_bibliography_does_not_consume_budget(self):
        prefix = "# Guide\n\nA useful concept.[^one]\n\n## Selected references\n"
        short = check_text(prefix + "[^one]: Author (2024). Title.\n")
        long = check_text(prefix + "[^one]: Author (2024). " + "reference " * 1000)
        self.assertEqual(short["body_words"], 4)
        self.assertEqual(short["body_words"], long["body_words"])
        self.assertEqual(long["reference_entries"], 1)
        self.assertFalse(long["errors"])

    def test_numbering_and_heading_level_are_not_fixed(self):
        for heading in ["## References", "### 9. Selected references", "## 3) Bibliography"]:
            with self.subTest(heading=heading):
                self.assertFalse(check_text("A fact.[^a]\n" + heading + "\n[^a]: Source.")["errors"])

    def test_custom_heading(self):
        text = "A fact.[^a]\n## 8. Sources consulted\n[^a]: Source."
        self.assertTrue(check_text(text)["errors"])
        self.assertFalse(check_text(text, references_heading="Sources consulted")["errors"])

    def test_code_is_not_a_reference_section_or_citation(self):
        text = ("# Guide\n`[^literal]`\n```markdown\n## References\n[^fake]: Example.\n"
                "```\nReal claim.[^real]\n## References\n[^real]: Real source.")
        result = check_text(text)
        self.assertEqual(result["reference_entries"], 1)
        self.assertFalse(result["errors"])

    def test_footnote_errors(self):
        result = check_text("Claim.[^missing]\n## References\n[^a]: One.\n[^a]: Two.")
        self.assertTrue(any("Undefined citations: missing" in x for x in result["errors"]))
        self.assertTrue(any("Duplicate definitions: a" in x for x in result["errors"]))
        self.assertTrue(any("Unreferenced definitions: a" in x for x in result["errors"]))

    def test_frontmatter_comments_and_hyphenated_words(self):
        text = ("---\ntitle: Metadata not counted\n---\n<!-- hidden prose -->\n"
                "# Guide\nHeld-out results.[^a]\n## References\n[^a]: Source.")
        self.assertEqual(check_text(text)["body_words"], 3)

    def test_budget_is_reported_not_approved(self):
        result = check_text("one two three\n## References\n", budget=2)
        self.assertEqual(result["words_over_budget"], 1)
        self.assertFalse(result["errors"])

    def test_missing_or_ambiguous_bibliography(self):
        self.assertTrue(check_text("A guide without references")["errors"])
        result = check_text("# Guide\n## References\n## Bibliography\n")
        self.assertTrue(any("ambiguous" in x for x in result["errors"]))

    def test_definitions_do_not_hide_in_body(self):
        result = check_text("Claim.[^a]\n[^a]: Source.\n## References\n")
        self.assertTrue(any("occur in the body" in x for x in result["errors"]))

    def test_inline_guide_via_stdin(self):
        script = Path(__file__).resolve().parents[1] / "scripts" / "check_guide.py"
        run = subprocess.run(
            [sys.executable, "-B", str(script), "-", "--budget", "3"],
            input="# Guide\nA fact.[^a]\n## References\n[^a]: Source.",
            text=True, capture_output=True, check=True,
        )
        result = json.loads(run.stdout)
        self.assertEqual(result["body_words"], 3)
        self.assertEqual(result["reference_entries"], 1)
        self.assertEqual(result["words_over_budget"], 0)
        self.assertFalse(result["errors"])


class BundledExamples(unittest.TestCase):
    skill = Path(__file__).resolve().parents[1]

    def test_example_guides_have_valid_footnotes(self):
        examples = sorted((self.skill / "examples").glob("*-field-guide.md"))
        self.assertTrue(examples, "No field-guide examples bundled")
        for example in examples:
            with self.subTest(example=example.name):
                result = check_text(example.read_text(encoding="utf-8"))
                self.assertFalse(result["errors"])
                self.assertGreater(result["body_words"], 0)
                self.assertGreater(result["reference_entries"], 0)

    def test_skill_and_example_index_links_are_portable(self):
        for document in [self.skill / "SKILL.md", self.skill / "examples" / "README.md"]:
            links = re.findall(r"\]\(([^)]+)\)", document.read_text(encoding="utf-8"))
            self.assertTrue(links, str(document))
            for link in links:
                if "://" in link or link.startswith("#"):
                    continue
                with self.subTest(document=document.name, link=link):
                    path = Path(link.split("#", 1)[0])
                    self.assertFalse(path.is_absolute())
                    target = (document.parent / path).resolve()
                    self.assertTrue(target.is_relative_to(self.skill))
                    self.assertTrue(target.is_file(), str(target))


if __name__ == "__main__":
    unittest.main()
