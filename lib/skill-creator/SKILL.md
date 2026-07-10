---
name: skill-creator
description: Author skills end to end — design capability and triggering, scaffold SKILL.md and resources, validate, evaluate against baselines, iterate, optimize descriptions, and package. Use whenever the user wants to create, review, improve, repair, or benchmark a skill, even without saying "skill." For skills inside a managed .agent-share library, use skill-manager for writes, registry/provenance, materialization, and final audit; use this skill as the authoring and evaluation method.
---

# Skill Creator

The full skill lifecycle: scaffold, write, validate, evaluate, iterate, optimize
triggering, package. This wraps two underlying creator guides —
`openai-skill-creator/` for authoring and `anthropic-skill-creator/` for
evaluation and optimization — bundled here as symlinks so their scripts and
references stay current. Drive both through this skill; never invoke either
directly.

## Produce portable skills

Follow symlinks to the canonical path of this `SKILL.md`, then resolve
`<library-dir>` as the parent of its containing skill directory. Confirm that
`<library-dir>` contains sibling `openai-skill-creator/` and
`anthropic-skill-creator/` directories before running anything. Never derive
bundled script paths from the lexical runtime symlink or the user's current
project. Commands use `python3`; substitute another command only when it is
verified to run Python 3.

The two bundled guides are each written for one vendor (Claude/Anthropic,
Codex/OpenAI). Strip that specificity:

- Read every product, agent, org, or model name in them — Claude, Anthropic,
  Cowork, Claude.ai, Codex, OpenAI, GPT — as the generic "the agent", "the
  platform", or "the model". Do not carry these names into the skill you
  produce: its name, description, and body stay vendor-neutral unless the skill
  is genuinely about that product.
- Skip `openai-skill-creator`'s "Agents metadata" step and `agents/openai.yaml`.
  The scaffold creates that file only when you pass `--interface`; leave it off
  unless the user explicitly targets the OpenAI/Codex platform.
- Treat environment-specific sections (Claude.ai-specific, Cowork-specific) as
  "adapt to the current environment": no subagents → run sequentially; no
  browser or display → write static HTML or review inline.
- The description-optimization loop
  (`anthropic-skill-creator/scripts/run_loop.py`) is one implementation of a
  portable idea that shells out to a specific agent CLI. Use it when that CLI is
  present; otherwise apply its principles by hand (step 8). The script's binding
  is not a reason the capability is vendor-locked.

## Workflow

Find where the user is and jump in. Stages are flexible and skippable — if the
user just wants to "vibe", do that. Before choosing an evaluation route, check
whether independent runs, the required agent CLI, and a browser/display are
available; use the documented sequential or static fallback and report reduced
evidence when they are not.

1. **Capture intent and concrete examples.** What the skill does, when it
   triggers, the output format, and how outputs should be judged. Objectively
   verifiable outputs use assertions; subjective writing/design still uses
   realistic cases, a predefined qualitative rubric or blind comparison, and
   user review, but not forced quantitative assertions. If the conversation
   already contains the workflow, extract it first. See
   `openai-skill-creator/SKILL.md` Step 1 and `anthropic-skill-creator/SKILL.md`
   "Capture Intent".
2. **Plan reusable contents** — scripts, references, assets — and set degrees of
   freedom and progressive-disclosure structure. `openai-skill-creator/SKILL.md`
   Step 2 and its progressive-disclosure section are the canonical write-up.
3. **Scaffold:** `python3
   <library-dir>/openai-skill-creator/scripts/init_skill.py <name> --path <dir>
   [--resources scripts,references,assets]`. Omit `--interface` unless
   explicitly targeting the OpenAI/Codex platform; without it no
   `agents/openai.yaml` is created.
4. **Write SKILL.md.** The `description` is the trigger: state what it does AND
   when to use it, and make it a little pushy to counter under-triggering. Keep
   the body lean (<500 lines) and push detail into `references/`. Anatomy and
   writing patterns: `openai-skill-creator/SKILL.md`.
5. **Validate:** `python3
   <library-dir>/openai-skill-creator/scripts/quick_validate.py <skill-folder>`.
   Treat that bundled check as basic validation: also confirm `name` and
   `description` are non-empty and the skill name matches its folder, as the
   portable Agent Skills contract requires. Do not patch the bundled creator to
   change its policy; enforce wrapper-level requirements here.
6. **Evaluate.** Follow `anthropic-skill-creator/SKILL.md` "Running and
   evaluating test cases": write `evals/evals.json`, spawn with-skill and
   baseline runs in the same turn when independent runs are available, and
   grade objective outputs against assertions
   (`anthropic-skill-creator/agents/grader.md`; schema in
   `anthropic-skill-creator/references/schemas.md`). Aggregate with `(cd
   <library-dir>/anthropic-skill-creator && python3 -m
   scripts.aggregate_benchmark ...)`, and run
   `<library-dir>/anthropic-skill-creator/eval-viewer/generate_review.py` for
   the user before forming your own opinion. Then read `feedback.json`.
7. **Improve and iterate.** Generalize from feedback instead of overfitting,
   keep it lean, explain the why, and bundle any script the test runs kept
   re-writing. See `anthropic-skill-creator/SKILL.md` "Improving the skill".
   Re-run into a new iteration; stop when the user is satisfied or progress
   stalls.
8. **Optimize description triggering.** Build ~20 realistic queries split
   should-trigger / should-not-trigger (favor near-misses over gimmes), hold out
   a test portion, and select the description by held-out score. Automated:
   `(cd <library-dir>/anthropic-skill-creator && python3 -m scripts.run_loop
   ...)` (needs the agent CLI). Without it, run the same loop by hand.
9. **Package:** `(cd <library-dir>/anthropic-skill-creator && python3 -m
   scripts.package_skill <skill-folder> <output-dir>)` when a `.skill` artifact
   is wanted. Always choose an explicit output directory outside the bundled
   creator so packaging cannot write into the official source copy.

## Routing

| Need | Go to |
|---|---|
| Scaffold, structure, naming, degrees of freedom, validate | `openai-skill-creator/` |
| Test cases, grading, benchmarks, viewer, blind compare, description optimization, packaging | `anthropic-skill-creator/` |
| Progressive disclosure, anatomy, description-as-trigger | either; `openai-skill-creator/` is canonical |
