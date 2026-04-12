---
name: research-refine
description: 'Turn a vague research direction into a problem-anchored, elegant, frontier-aware, implementation-oriented method plan via iterative external-model review. Use when the research problem is visible but the technical route is still fuzzy, and the goal is one focused paper-worthy mechanism rather than a bloated proposal. Triggers: refine my approach, 帮我细化方案, decompose this problem, 打磨 idea, refine research plan, 细化研究方案, method-first proposal, external review loop. For the end-to-end method + experiment roadmap use research-refine-pipeline.'
allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, web-search, web-fetch, Agent
---

# Research Refine: Problem-Anchored, Elegant, Frontier-Aware Plan Refinement

Refine and concretize: **$ARGUMENTS**

## Overview

Turn a vague direction into a **problem → focused method → minimal validation** document that is concrete enough to implement, elegant enough to feel paper-worthy, and current enough to resonate in the foundation-model era.

Four principles dominate:

1. **Do not lose the original problem.** Freeze an immutable **Problem Anchor** and reuse it in every round.
2. **The smallest adequate mechanism wins.** Prefer the minimal intervention that directly fixes the bottleneck.
3. **One paper, one dominant contribution.** One sharp thesis plus at most one supporting contribution.
4. **Modern leverage is a prior, not a decoration.** Use LLM / VLM / Diffusion / RL / distillation / inference-time scaling concretely when they naturally fit the bottleneck; not as buzzwords.

```
User input (PROBLEM + vague APPROACH)
  → Phase 0: Freeze Problem Anchor
  → Phase 1: Scan grounding papers → identify technical gap → choose sharpest route → write focused proposal
  → Phase 2: External review for fidelity, specificity, contribution quality, frontier leverage
  → Phase 3: Anchor + simplicity check → revise method → rewrite full proposal
  → Phase 4: Re-evaluate in same reviewer thread
  → Repeat 3–4 until OVERALL >= 9 or MAX_ROUNDS
  → Phase 5: Save full history to refine-logs/
  → Optional: /research-refine-pipeline to extend into a detailed experiment roadmap
```

## Constants

- **REVIEWER_MODEL = `gpt-5.4`** — default; override via argument or any logged-in coding CLI / external backend.
- **MAX_ROUNDS = 5**
- **SCORE_THRESHOLD = 9**
- **OUTPUT_DIR = `refine-logs/`**
- **MAX_LOCAL_PAPERS = 15**
- **MAX_CORE_EXPERIMENTS = 3** — default cap inside this skill.
- **MAX_PRIMARY_CLAIMS = 2** — one dominant + one supporting.
- **MAX_NEW_TRAINABLE_COMPONENTS = 2** — exceed only if the paper breaks otherwise.

Override via argument if needed, e.g. `/research-refine "problem | approach" -- max rounds: 3, threshold: 9`.

## References

All templates and reviewer prompts live under `references/`. Read them when executing a phase:

- `references/templates.md` — initial proposal, score-history table, round refinement, REVIEW_SUMMARY, FINAL_PROPOSAL, REFINEMENT_REPORT, and final user summary.
- `references/reviewer_prompts.md` — round-1 review prompt, round-N re-eval prompt, and the `reviewer_call.py` invocation.

Do **not** inline these templates in new files; copy from `references/` so they stay canonical.

## Output Structure

```
refine-logs/
├── round-0-initial-proposal.md
├── round-1-review.md
├── round-1-refinement.md
├── round-2-review.md
├── round-2-refinement.md
├── ...
├── REVIEW_SUMMARY.md
├── FINAL_PROPOSAL.md
├── REFINEMENT_REPORT.md
└── score-history.md
```

Every `round-N-refinement.md` must contain a **full anchored proposal**, not just incremental fixes.

## Workflow

### Phase 0: Freeze the Problem Anchor

Extract the immutable bottom-line problem. Copy this anchor verbatim into every proposal and every refinement round. Write:

- **Bottom-line problem**
- **Must-solve bottleneck**
- **Non-goals**
- **Constraints** — compute, data, time, tooling, venue, deployment
- **Success condition**

If later reviewer feedback would change the problem being solved, flag it as **drift** and push back or adapt carefully.

### Phase 1: Build the Initial Proposal

**1.1 Scan grounding material.** Check `papers/` and `literature/` first; read only what answers: what do current methods use, where do they fail for this problem, which foundation-model-era techniques are actually relevant, what training/representation/interface is reusable, and what distinguishes a real method from a renamed high-level idea. Search online for top-venue/arXiv work only if local material is insufficient.

**1.2 Identify the technical gap.** Make the gap operational:
1. Current pipeline failure point.
2. Why naive fixes are insufficient (more data, more context, more prompting, memory bank, module stacking).
3. Smallest adequate intervention that could plausibly fix the bottleneck.
4. Frontier-native alternative if a modern primitive matches the bottleneck better.
5. Core technical claim that could survive top-venue scrutiny.
6. Minimum evidence needed to defend that claim.

**1.3 Choose the sharpest route.** Compare Route A (elegant minimal) vs. Route B (frontier-native) when both are plausible; decide which produces the stronger paper under the stated constraints with the cleaner novelty and no contribution sprawl. If both are weak, rethink framing rather than combining them.

**1.4 Concretize the method.** The proposal must answer "how would we actually build this?" Prefer detail over broad experimentation and reuse over invention. Cover: one-sentence method thesis; contribution focus; complexity budget; system graph; representation design; training recipe; inference path; why the mechanism stays small; exact role of any frontier primitive; failure handling; novelty and elegance argument. If the method is still only "add a module" or "use a planner", it is not concrete enough.

**1.5 Design minimal claim-driven validation.** For each core claim define the smallest strong experiment (claim / baseline or ablation / decisive metric / expected direction). Ensure one block directly supports the Problem Anchor; include a simplification-or-deletion check if complexity risk exists; include a necessity check if a frontier primitive is central. Default to **1–3 core experiment blocks**; leave the full execution roadmap to `/research-refine-pipeline`.

**1.6 Write `round-0-initial-proposal.md`** using the initial-proposal template in `references/templates.md`.

### Phase 2: External Method Review (Round 1)

Send the full proposal to the external reviewer using the round-1 prompt in `references/reviewer_prompts.md`. Prefer the `reviewer_call.py` invocation there (it prefers logged-in CLIs like `codex exec` / `claude -p` / `gemini -p` and falls back to `THIRD_PARTY_API_*`, `OPENAI_*`, or `GEMINI_*` keys). If neither CLI nor API backend is available, use any MCP or subagent; if truly none, run a strict self-review and label it a fallback.

Use high reasoning effort (`--reasoning-effort xhigh`).

**CRITICAL:** Persist reviewer continuity by reusing `refine-logs/reviewer-thread.json` across rounds. Save the FULL raw response verbatim in `refine-logs/round-1-review.md` inside a `<details>` block.

### Phase 3: Parse Feedback and Revise

**3.1 Parse the review.** Extract the 7 dimensions, overall score, verdict, drift warning, simplification/modernization opportunities, and ranked action items. Update `refine-logs/score-history.md` (table template in `references/templates.md`).

**STOP CONDITION:** if overall score >= SCORE_THRESHOLD, verdict is READY, and no unresolved drift warning → skip to Phase 5.

**3.2 Revise with an anchor check and a simplicity check.** Before changing anything:

1. Copy the Problem Anchor verbatim.
2. **Anchor Check** — original bottleneck, whether the current method still solves it, which reviewer suggestions would cause drift if followed blindly.
3. **Simplicity Check** — dominant contribution now, components that can be removed/merged/frozen, reviewer suggestions that add unnecessary complexity, and whether a central frontier primitive still has a crisp role.

Then process reviewer feedback:
- **Valid** → sharpen the mechanism, simplify, or modernize when the paper improves.
- **Debatable** → revise, but explain reasoning with evidence.
- **Wrong / drifting / over-complicating** → push back with evidence from local papers and the Problem Anchor.

Bias revisions toward: sharper central contribution, fewer moving parts, cleaner reuse of strong existing backbones, more natural frontier leverage when it improves the paper, leaner claim-driven experiments. Do not add parallel contributions just to chase score — first ask whether the same gain can come from a better interface, distillation signal, reward model, or inference policy on top of an existing backbone.

Save `refine-logs/round-N-refinement.md` using the round-refinement template in `references/templates.md`.

### Phase 4: Re-evaluation (Round 2+)

Send the revised proposal back to the external reviewer **in the same conversation state** (reuse `refine-logs/reviewer-thread.json`) with the round-N re-eval prompt in `references/reviewer_prompts.md`. Save review to `refine-logs/round-N-review.md`.

Return to Phase 3 until overall score >= SCORE_THRESHOLD and verdict is READY with no unresolved drift, or MAX_ROUNDS is reached.

### Phase 5: Final Report and Logs

Produce, using the corresponding templates in `references/templates.md`:

1. `refine-logs/REVIEW_SUMMARY.md` — high-level round-by-round resolution log.
2. `refine-logs/FINAL_PROPOSAL.md` — clean final version only; no review chatter, no round history. Write the best current version even if verdict is not READY.
3. `refine-logs/REFINEMENT_REPORT.md` — full score evolution, round-by-round review record, method evolution highlights, pushback/drift log, remaining weaknesses, and raw reviewer responses in `<details>` blocks.
4. Finalize `refine-logs/score-history.md` with the complete evolution table.
5. Present the final user-facing summary (template in `references/templates.md`).

## Key Rules

- **Anchor first, every round.** Always carry forward the same Problem Anchor.
- **One paper, one dominant contribution.** Avoid parallel contributions unless the paper truly needs them.
- **The smallest adequate mechanism wins.** Bigger is not automatically better.
- **Prefer reuse over invention.** Start from strong existing backbones; add only what the bottleneck requires.
- **Modern techniques are a prior, not a decoration.**
- **Minimal experiments** inside this skill — only prove the core claims; hand execution off to `/research-refine-pipeline`.
- **Review the mechanism, not the parts count.** A long module list is not novelty.
- **Pushback is encouraged** when reviewer feedback causes drift or unnecessary complexity.
- **Use high reasoning effort** on every external reviewer call.
- **Reuse the reviewer thread** (`refine-logs/reviewer-thread.json` or equivalent) across rounds.
- **Do not fabricate results.** Describe expected evidence and planned experiments only.
- **Be specific about compute and data assumptions.** Vague "we'll train a model" is not enough.
- **Document everything.** Save every raw review, every anchor check, every simplicity check, every major method change.

## Composing with Other Skills

```
/research-refine-pipeline       -> one-shot refine + experiment planning
/idea-creator "direction"       -> candidate ideas
/research-refine "PROBLEM: ... | APPROACH: ..."  <- you are here
/run-experiment                 -> execute the chosen method
/auto-review-loop               -> iterate on results and paper
```

Typical flow: `/idea-creator` → `/research-refine` → `/research-refine-pipeline` (for experiment roadmap) → `/run-experiment` → later result-driven loops. This skill also works standalone if the problem is already known and only the method needs to become concrete.
