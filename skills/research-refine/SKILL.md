---
name: research-refine
description: 'Turn a vague research direction into a problem-anchored, elegant, frontier-aware, implementation-oriented method plan via iterative external-model review. Use when the research problem is visible but the technical route is still fuzzy, and the goal is one focused paper-worthy mechanism plus a clean refined proposal, not a bloated process artifact stack. Triggers: refine my approach, 帮我细化方案, decompose this problem, 打磨 idea, refine research plan, 细化研究方案, method-first proposal, external review loop. For the end-to-end method + experiment roadmap use research-refine-pipeline.'
allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, web-search, web-fetch, Agent
---

# Research Refine: Problem-Anchored, Elegant, Frontier-Aware Proposal Refinement

Refine and concretize: **$ARGUMENTS**

## Overview

Turn a vague direction into a **problem → focused method → minimal validation** proposal that is concrete enough to implement, elegant enough to feel paper-worthy, and current enough to resonate in the foundation-model era.

This skill is **proposal-first by default**. The main deliverable is a **clean refined proposal** the user can immediately read, critique, or hand off to experiment planning. Reviewer logs and round-by-round artifacts are supporting material, not the center of the workflow.

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
  → Phase 3: Revise against blocking issues while preserving anchor and simplicity
  → Repeat 2–3 until no blocking weakness remains or MAX_ROUNDS
  → Phase 4: Deliver clean refined proposal first; save only the audit trail that was actually useful
  → Optional: /research-refine-pipeline to extend into a detailed experiment roadmap
```

## Constants

- **REVIEWER_MODEL = `gpt-5.4`** — default; override via argument or any logged-in coding CLI / external backend.
- **MAX_ROUNDS = 5**
- **OUTPUT_DIR = `refine-logs/`**
- **MAX_LOCAL_PAPERS = 15**
- **MAX_CORE_EXPERIMENTS = 3** — default cap inside this skill.
- **MAX_PRIMARY_CLAIMS = 2** — one dominant + one supporting.
- **MAX_NEW_TRAINABLE_COMPONENTS = 2** — exceed only if the paper breaks otherwise.

Override via argument if needed, e.g. `/research-refine "problem | approach" -- max rounds: 3`.

## References

All templates and reviewer prompts live under `references/`. Read them when executing a phase:

- `references/templates.md` — initial proposal, score-history table, round refinement, REVIEW_SUMMARY, FINAL_PROPOSAL, optional REFINEMENT_REPORT, and final user summary.
- `references/reviewer_prompts.md` — round-1 review prompt, round-N re-eval prompt, and the `reviewer_call.py` invocation.

Do **not** inline these templates in new files; copy from `references/` so they stay canonical.

## Deliverables

### Default deliverable mode

Always prioritize these outputs:

1. **A clean refined proposal** — the main artifact. Present it to the user directly and save it as `refine-logs/FINAL_PROPOSAL.md`.
2. **A short refinement summary** — 3–5 key upgrades relative to the starting idea, the 1–3 minimal validation blocks, and the main unresolved risks.
3. **A concise review summary** — only if reviewer feedback materially changed the proposal.

### Lightweight audit trail

Keep only the support files that are genuinely useful:

- `refine-logs/FINAL_PROPOSAL.md` — required.
- `refine-logs/REVIEW_SUMMARY.md` — create when the reviewer loop added meaningful signal.
- `refine-logs/reviewer-thread.json` — create when using an external reviewer and always reuse it across rounds.
- `refine-logs/score-history.md` — create when an external reviewer was used for more than one scored round.

### Audit-heavy mode (optional)

Only create these if the user asks for a full trail, the iteration is genuinely complex, or you need them to stay organized:

- `refine-logs/round-0-initial-proposal.md`
- `refine-logs/round-N-review.md`
- `refine-logs/round-N-refinement.md`
- `refine-logs/REFINEMENT_REPORT.md`

Do not let artifact production crowd out proposal quality.

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

**1.4 Concretize the method.** The proposal must answer "how would we actually build this?" Prefer detail over broad experimentation and reuse over invention. Cover: one-sentence method thesis; contribution focus; complexity budget; system graph; representation design; training recipe; inference path; why the mechanism stays small; exact role of any frontier primitive; failure handling; novelty and elegance argument. For the dominant mechanism, explicitly pin down: `(1)` component interfaces (input / output / attach point / frozen vs trainable), `(2)` observation or data model, `(3)` training signal or loss, `(4)` inference path, and `(5)` claim-to-validation mapping. If the method is still only "add a module" or "use a planner", it is not concrete enough.

**1.5 Design minimal claim-driven validation.** For each core claim define the smallest strong experiment (claim / baseline or ablation / decisive metric / expected direction). Ensure one block directly supports the Problem Anchor; include a simplification-or-deletion check if complexity risk exists; include a necessity check if a frontier primitive is central. Default to **1–3 core experiment blocks**; leave the full execution roadmap to `/research-refine-pipeline`.

**1.6 Write the first full proposal draft** using the initial-proposal template in `references/templates.md`. If reviewer iteration is likely, save it as `refine-logs/round-0-initial-proposal.md`; otherwise you may refine directly toward `FINAL_PROPOSAL.md`.

### Phase 2: External Method Review

Send the full proposal to the external reviewer using the relevant prompt in `references/reviewer_prompts.md`. Prefer the `reviewer_call.py` invocation there (it prefers logged-in CLIs like `codex exec` / `claude -p` / `gemini -p` and falls back to `THIRD_PARTY_API_*`, `OPENAI_*`, or `GEMINI_*` keys). If neither CLI nor API backend is available, use any MCP or subagent; if truly none, run a strict self-review and label it a fallback.

Use high reasoning effort (`--reasoning-effort xhigh`).

**CRITICAL:** Persist reviewer continuity by reusing `refine-logs/reviewer-thread.json` across rounds.

Ask the reviewer for:
- 7 dimension scores + overall
- verdict
- drift warning
- **blocking issues**
- **non-blocking suggestions**
- simplification opportunities
- modernization opportunities

Save the raw response only when it materially helps later rounds or the user wants the audit trail.

### Phase 3: Parse Feedback and Revise

**3.1 Parse the review.** Extract the 7 dimensions, overall score, verdict, drift warning, blocking issues, non-blocking suggestions, simplification opportunities, and modernization opportunities. Update `refine-logs/score-history.md` only if it helps track a multi-round external review.

**STOP CONDITION:** stop when all of the following are true:
- the Problem Anchor is preserved,
- no blocking weakness remains,
- the dominant mechanism is concrete enough to implement,
- the contribution is focused enough to feel paper-worthy,
- additional rounds would mostly chase score rather than improve the mechanism.

A proposal is **not** concrete enough to stop unless the dominant mechanism has all of these pinned down in the proposal itself:
- interfaces for each claim-bearing component,
- observation or data model,
- training signal or loss,
- inference path,
- claim-to-validation mapping.

Scores are **diagnostic signals**, not the optimization target. Do not add modules, auxiliary contributions, or experiment bloat just to raise a number.

**3.2 Revise with an anchor check and a simplicity check.** Before changing anything:

1. Copy the Problem Anchor verbatim.
2. **Anchor Check** — original bottleneck, whether the current method still solves it, which reviewer suggestions would cause drift if followed blindly.
3. **Simplicity Check** — dominant contribution now, components that can be removed/merged/frozen, reviewer suggestions that add unnecessary complexity, and whether a central frontier primitive still has a crisp role.

Then process reviewer feedback:
- **Blocking + valid** → fix directly at the method level.
- **Non-blocking + useful** → incorporate only if the proposal stays sharper or cleaner.
- **Wrong / drifting / over-complicating** → push back with evidence from local papers and the Problem Anchor.

Bias revisions toward: sharper central contribution, fewer moving parts, cleaner reuse of strong existing backbones, more natural frontier leverage when it improves the paper, leaner claim-driven experiments. Do not add parallel contributions just to chase score — first ask whether the same gain can come from a better interface, distillation signal, reward model, or inference policy on top of an existing backbone.

When a revision round is worth preserving, save `refine-logs/round-N-refinement.md` using the round-refinement template in `references/templates.md`. If the review only causes light edits, update the working proposal directly instead of generating another heavy artifact.

### Phase 4: Finalize and Present

Produce the final deliverables using the corresponding templates in `references/templates.md`:

1. `refine-logs/FINAL_PROPOSAL.md` — clean final version only; no review chatter, no round history. Write the best current version even if verdict is not READY.
2. `refine-logs/REVIEW_SUMMARY.md` — concise round-by-round resolution log, only if the reviewer loop added meaningful value.
3. `refine-logs/score-history.md` — only if multiple scored reviewer rounds were used and the history is informative.
4. `refine-logs/REFINEMENT_REPORT.md` — optional audit-heavy report; do not create by default.
5. Present the final user-facing summary **in the reply itself**: refined thesis, key upgrades, minimal validation blocks, and remaining risks. File links are supporting references, not the primary deliverable.

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
- **Document the decisions that matter.** Keep enough trail to preserve reviewer continuity and explain major method changes, but do not generate logs for their own sake.

## Composing with Other Skills

```
/research-refine-pipeline       -> one-shot refine + experiment planning
/idea-creator "direction"       -> candidate ideas
/research-refine "PROBLEM: ... | APPROACH: ..."  <- you are here
/run-experiment                 -> execute the chosen method
/auto-review-loop               -> iterate on results and paper
```

Typical flow: `/idea-creator` → `/research-refine` → `/research-refine-pipeline` (for experiment roadmap) → `/run-experiment` → later result-driven loops. This skill also works standalone if the problem is already known and only the method needs to become concrete.
