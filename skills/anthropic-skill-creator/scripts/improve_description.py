#!/usr/bin/env python3
"""Improve a skill description based on eval results."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PARENT_DIR = SCRIPT_DIR.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

from scripts.runtime_cli import run_text_prompt
from scripts.utils import parse_skill_md


def improve_description(
    skill_name: str,
    skill_content: str,
    current_description: str,
    eval_results: dict,
    history: list[dict],
    model: str | None,
    runtime: str,
    test_results: dict | None = None,
    log_dir: Path | None = None,
    iteration: int | None = None,
) -> str:
    failed_triggers = [r for r in eval_results["results"] if r["should_trigger"] and not r["pass"]]
    false_triggers = [r for r in eval_results["results"] if not r["should_trigger"] and not r["pass"]]

    train_score = f"{eval_results['summary']['passed']}/{eval_results['summary']['total']}"
    scores_summary = f"Train: {train_score}"
    if test_results:
        test_score = f"{test_results['summary']['passed']}/{test_results['summary']['total']}"
        scores_summary = f"{scores_summary}, Test: {test_score}"

    prompt = f"""You are optimizing a skill description for a local agent skill called "{skill_name}".

A skill has a title and description that the agent sees when deciding whether to use it. If the agent chooses it, the agent then reads SKILL.md and any referenced resources.

The description is the main trigger surface. Your goal is to write a description that triggers for relevant queries and does not trigger for irrelevant ones.

Current description:
<current_description>
{current_description}
</current_description>

Current scores: {scores_summary}
"""
    if failed_triggers:
        prompt += "FAILED TO TRIGGER:\n"
        for r in failed_triggers:
            prompt += f'  - "{r["query"]}" (triggered {r["triggers"]}/{r["runs"]} times)\n'
        prompt += "\n"

    if false_triggers:
        prompt += "FALSE TRIGGERS:\n"
        for r in false_triggers:
            prompt += f'  - "{r["query"]}" (triggered {r["triggers"]}/{r["runs"]} times)\n'
        prompt += "\n"

    if history:
        prompt += "PREVIOUS ATTEMPTS (do not repeat them mechanically; change structure if needed):\n"
        for h in history:
            train_s = f"{h.get('train_passed', h.get('passed', 0))}/{h.get('train_total', h.get('total', 0))}"
            prompt += f'- {train_s}: "{h["description"]}"\n'
        prompt += "\n"

    prompt += f"""
Skill content:
<skill_content>
{skill_content}
</skill_content>

Write a better description. Generalize from the failures instead of listing specific prompts. Keep it under roughly 100-200 words and definitely under 1024 characters.

Guidelines:
- Phrase it in the imperative: "Use this skill for ..."
- Focus on user intent, not internal implementation.
- Make it distinctive enough to win against adjacent skills.
- Be concise.

Respond with only the new description inside <new_description> tags.
"""

    text = run_text_prompt(prompt, runtime=runtime, model=model)
    match = re.search(r"<new_description>(.*?)</new_description>", text, re.DOTALL)
    description = match.group(1).strip().strip('"') if match else text.strip().strip('"')

    transcript = {
        "runtime": runtime,
        "iteration": iteration,
        "prompt": prompt,
        "response": text,
        "parsed_description": description,
        "char_count": len(description),
        "over_limit": len(description) > 1024,
    }

    if len(description) > 1024:
        shorten_prompt = (
            f"{prompt}\n\n"
            f'The previous attempt was {len(description)} characters, which is over the 1024 character limit:\n"{description}"\n\n'
            "Rewrite it to stay under 1024 characters while preserving the strongest trigger cues. "
            "Respond only with <new_description>...</new_description>."
        )
        shorten_text = run_text_prompt(shorten_prompt, runtime=runtime, model=model)
        match = re.search(r"<new_description>(.*?)</new_description>", shorten_text, re.DOTALL)
        shortened = match.group(1).strip().strip('"') if match else shorten_text.strip().strip('"')
        transcript["rewrite_prompt"] = shorten_prompt
        transcript["rewrite_response"] = shorten_text
        transcript["rewrite_description"] = shortened
        transcript["rewrite_char_count"] = len(shortened)
        description = shortened

    transcript["final_description"] = description
    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        (log_dir / f"improve_iter_{iteration or 'unknown'}.json").write_text(json.dumps(transcript, indent=2))

    return description


def main() -> None:
    parser = argparse.ArgumentParser(description="Improve a skill description based on eval results")
    parser.add_argument("--eval-results", required=True, help="Path to eval results JSON")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--history", default=None, help="Path to history JSON")
    parser.add_argument("--model", default=None, help="Model for the selected CLI backend")
    parser.add_argument("--runtime", choices=["auto", "claude", "codex", "gemini"], default="auto", help="CLI backend to use for description rewriting")
    parser.add_argument("--verbose", action="store_true", help="Print progress to stderr")
    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    eval_results = json.loads(Path(args.eval_results).read_text())
    history = json.loads(Path(args.history).read_text()) if args.history else []
    name, _, content = parse_skill_md(skill_path)
    current_description = eval_results["description"]

    if args.verbose:
        print(f"Current: {current_description}", file=sys.stderr)

    new_description = improve_description(
        skill_name=name,
        skill_content=content,
        current_description=current_description,
        eval_results=eval_results,
        history=history,
        model=args.model,
        runtime=args.runtime,
    )

    if args.verbose:
        print(f"Improved: {new_description}", file=sys.stderr)

    output = {
        "description": new_description,
        "history": history
        + [
            {
                "description": current_description,
                "passed": eval_results["summary"]["passed"],
                "failed": eval_results["summary"]["failed"],
                "total": eval_results["summary"]["total"],
                "results": eval_results["results"],
            }
        ],
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
