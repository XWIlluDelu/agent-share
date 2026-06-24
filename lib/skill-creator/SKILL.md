---
name: skill-creator
description: Author skills end to end — scaffold a new skill, write its SKILL.md and bundled scripts/references/assets, validate it, run test-case evaluations and benchmarks, iterate on feedback, optimize the description so it triggers reliably, and package the result. Use whenever the user wants to create a skill, turn a workflow or conversation into a skill, review or improve an existing skill, fix one that won't trigger, or benchmark a skill — even if they don't say the word "skill". Produces portable, vendor-neutral skills.
---

# Skill Creator

The full skill lifecycle: scaffold, write, validate, evaluate, iterate, optimize triggering, package. This wraps two underlying creator guides — `openai-skill-creator/` for authoring and `anthropic-skill-creator/` for evaluation and optimization — bundled here as symlinks so their scripts and references stay current. Drive both through this skill; never invoke either directly.

## Produce portable skills

The two bundled guides are each written for one vendor (Claude/Anthropic, Codex/OpenAI). Strip that specificity:

- Read every product, agent, org, or model name in them — Claude, Anthropic, Cowork, Claude.ai, Codex, OpenAI, GPT — as the generic "the agent", "the platform", or "the model". Do not carry these names into the skill you produce: its name, description, and body stay vendor-neutral unless the skill is genuinely about that product.
- Skip steps whose only output is vendor UI metadata: `openai-skill-creator`'s "Agents metadata" step, `agents/openai.yaml`, and `generate_openai_yaml.py`. Generate that file only when the user explicitly targets that platform.
- Treat environment-specific sections (Claude.ai-specific, Cowork-specific) as "adapt to the current environment": no subagents → run sequentially; no browser or display → write static HTML or review inline.
- The description-optimization loop (`anthropic-skill-creator/scripts/run_loop.py`) is one implementation of a portable idea that shells out to a specific agent CLI. Use it when that CLI is present; otherwise apply its principles by hand (step 8). The script's binding is not a reason the capability is vendor-locked.

## Workflow

Find where the user is and jump in. Stages are flexible and skippable — if the user just wants to "vibe", do that.

1. **Capture intent and concrete examples.** What the skill does, when it triggers, the output format, and whether outputs are objectively verifiable (worth test cases) or subjective like writing/design (skip them). If the conversation already contains the workflow, extract it first. See `openai-skill-creator/SKILL.md` Step 1 and `anthropic-skill-creator/SKILL.md` "Capture Intent".
2. **Plan reusable contents** — scripts, references, assets — and set degrees of freedom and progressive-disclosure structure. `openai-skill-creator/SKILL.md` Step 2 and its progressive-disclosure section are the canonical write-up.
3. **Scaffold:** `openai-skill-creator/scripts/init_skill.py <name> --path <dir> [--resources scripts,references,assets]`. Omit the `--interface`/openai.yaml UI metadata per the portability rule.
4. **Write SKILL.md.** The `description` is the trigger: state what it does AND when to use it, and make it a little pushy to counter under-triggering. Keep the body lean (<500 lines) and push detail into `references/`. Anatomy and writing patterns: `openai-skill-creator/SKILL.md`.
5. **Validate:** `openai-skill-creator/scripts/quick_validate.py <skill-folder>`.
6. **Evaluate** (verifiable outputs). Follow `anthropic-skill-creator/SKILL.md` "Running and evaluating test cases": write `evals/evals.json`, spawn with-skill and baseline runs in the same turn, grade against assertions (`anthropic-skill-creator/agents/grader.md`; schema in `anthropic-skill-creator/references/schemas.md`), aggregate with `python -m scripts.aggregate_benchmark` run from the bundled `anthropic-skill-creator/` directory, and open `anthropic-skill-creator/eval-viewer/generate_review.py` for the user before forming your own opinion. Then read `feedback.json`.
7. **Improve and iterate.** Generalize from feedback instead of overfitting, keep it lean, explain the why, and bundle any script the test runs kept re-writing. See `anthropic-skill-creator/SKILL.md` "Improving the skill". Re-run into a new iteration; stop when the user is satisfied or progress stalls.
8. **Optimize description triggering.** Build ~20 realistic queries split should-trigger / should-not-trigger (favor near-misses over gimmes), hold out a test portion, and select the description by held-out score. Automated: `run_loop.py` from `anthropic-skill-creator/` (needs the agent CLI). Without it, run the same loop by hand.
9. **Package:** `python -m scripts.package_skill <skill-folder>` from `anthropic-skill-creator/` when a `.skill` artifact is wanted.

## Routing

| Need | Go to |
|---|---|
| Scaffold, structure, naming, degrees of freedom, validate | `openai-skill-creator/` |
| Test cases, grading, benchmarks, viewer, blind compare, description optimization, packaging | `anthropic-skill-creator/` |
| Progressive disclosure, anatomy, description-as-trigger | either; `openai-skill-creator/` is canonical |
