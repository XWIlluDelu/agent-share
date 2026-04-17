---
name: anthropic-skill-creator
description: Cross-agent skill creation and iterative improvement workflow with evals, benchmarks, review loops, packaging, and optional trigger-description optimization. Use when users want to create a new skill, improve an existing skill, benchmark skill behavior, compare with-skill vs baseline runs, or refine triggering quality with a rigorous evaluation process.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## The Process

1. Decide what you want the skill to do and roughly how it should do it
2. Write a draft of the skill
3. Create a few test prompts and run the current agent with access to the skill on them
4. Help the user evaluate results both qualitatively and quantitatively
5. Rewrite the skill based on feedback
6. Repeat until satisfied
7. Expand the test set and try again at larger scale

Figure out where the user is in this process and jump in to help them progress. The order is flexible — if the user says "I don't need evaluations, just vibe with me", do that instead.

## Communicating with the User

Skill creator users vary widely in technical familiarity. Pay attention to context cues:
- "evaluation" and "benchmark" are borderline, but OK
- "JSON" and "assertion" need serious cues before using without explanation

Brief explanations are welcome when in doubt.

---

## Creating a Skill

### Capture Intent

If the current conversation already contains a workflow to capture, extract answers from it first — the tools used, sequence of steps, corrections made, input/output formats observed. Then ask the user to fill gaps and confirm before proceeding.

1. What should this skill enable the agent to do?
2. When should this skill trigger? (user phrases/contexts)
3. What's the expected output format?
4. Do we need test cases? Skills with objectively verifiable outputs benefit from them; skills with subjective outputs often don't.

### Interview and Research

Proactively ask about edge cases, input/output formats, example files, success criteria, and dependencies. Wait to write test prompts until this is settled. Check available MCPs — research in parallel via subagents if useful.

### Write the SKILL.md

Fill in: `name`, `description` (primary triggering mechanism — explicit, a little pushy, not a keyword dump), `compatibility` (optional), and the skill body.

For the Skill Writing Guide (anatomy, progressive disclosure, writing patterns, test case format), see [references/skill_writing_guide.md](references/skill_writing_guide.md).

---

## Running and Evaluating Test Cases

For the complete 5-step evaluation workflow (spawn runs, draft assertions, capture timing, grade and aggregate, launch viewer, read feedback), see [references/eval_workflow.md](references/eval_workflow.md).

**Summary**: Spawn all runs (with-skill AND baseline) in the same turn. Grade assertions once runs complete. Use `aggregate_benchmark` and `generate_review.py` to present results to the user. Read `feedback.json` when the user is done reviewing.

---

## Improving the Skill

This is the heart of the loop. After the user reviews results:

1. **Generalize from feedback** — design for a million uses, not just the current examples. Avoid overfitting or oppressively narrow constraints.
2. **Keep the prompt lean** — remove things not pulling their weight. Read transcripts to identify unproductive patterns.
3. **Explain the why** — LLMs are smart; when given good reasoning they go beyond rote instructions. Avoid ALWAYS/NEVER in all-caps; reframe to explain *why* the thing matters.
4. **Bundle repeated work** — if all test cases independently wrote the same helper script, put it in `scripts/`.

Iterate: improve → rerun → review → repeat. Stop when the user is happy, feedback is empty, or you're not making meaningful progress.

---

## Advanced: Blind Comparison

For rigorous comparison between two skill versions, use the blind comparison system. Read `agents/comparator.md` and `agents/analyzer.md` for details. An independent agent evaluates two outputs without knowing which is which, then analyzes why the winner won. Optional — the human review loop is usually sufficient.

---

## Description Optimization

For the full 4-step description optimization workflow (generate eval queries, review with user, run the optimization loop, apply the result), see [references/description_optimization.md](references/description_optimization.md).

The `run_loop.py` script handles the full loop automatically: 60/40 train/test split, 3 runs per query, up to 5 iterations, returns `best_description` by test score.

---

## Single-Agent Mode

Without subagents: run test cases yourself one at a time (you wrote the skill, so this is a sanity check, not a rigorous eval). Skip baseline runs, browser reviewer, and quantitative benchmarking. Focus on qualitative user feedback.

## Reference Files

- `agents/grader.md` — How to evaluate assertions against outputs
- `agents/comparator.md` — How to do blind A/B comparison
- `agents/analyzer.md` — How to analyze why one version won
- `references/schemas.md` — JSON structures for evals.json, grading.json, benchmark.json
- [references/skill_writing_guide.md](references/skill_writing_guide.md) — Anatomy, progressive disclosure, writing patterns
- [references/eval_workflow.md](references/eval_workflow.md) — 5-step evaluation workflow
- [references/description_optimization.md](references/description_optimization.md) — 4-step description optimization

---

## Core Loop (Reminder)

1. Figure out what the skill is about
2. Draft or edit the skill
3. Run the current agent on test prompts
4. Evaluate outputs (qualitative + quantitative)
5. Repeat until you and the user are satisfied
6. Package and return the final skill
