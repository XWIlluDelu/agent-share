---
name: chaos
description: "Claim-led multi-agent deliberation for high-value ambiguous or risky judgment. Use when the user asks for CHAOS, council, multi-agent debate, structured disagreement, adversarial review, claim audit, minority report, stress-test, or evidence-standard synthesis; also use for important research/design/architecture/document-interpretation decisions needing independent dissent. Avoid simple lookup, deterministic calculation, routine low-stakes edits, raw brainstorming before pruning, or tightly coupled work better solved by direct verification."
---

# CHAOS

Use CHAOS to make an important judgment survive independent search and adversarial criticism. The parent remains judge and final writer; agents advise.

## Gate

Before launching agents, ask whether direct verification would answer better than plural deliberation. If yes, use Skip/direct and do not run CHAOS machinery.

## Mode chooser

| Mode | Use when |
|---|---|
| Skip/direct | Single-source verification, deterministic calculation, routine low-stakes work, raw ideation, or tightly coupled work better solved by direct test. |
| Claim audit | One answer, plan, document, claim set, or diff needs claim-led stress testing. |
| Adversarial review | One proposal needs focused refutation before decision. |
| Council | Broad ambiguous decision needs independent same-question first positions. |
| Review loop | Artifact needs parent-controlled writing plus fresh independent review. |
| Deep deliberation | High-stakes research/design needs multiple evidence routes and consistency checks. |

For full recipes and stop rules, read [references/protocols.md](references/protocols.md). Before choosing models, read [MODEL_USAGE.md](MODEL_USAGE.md); project-local `MODEL_USAGE.md` overrides this default.

## Core workflow

1. **Frame.** Define question, scope, non-goals, evidence standard, success criterion, selected mode, allowed tools/models, stop rule, decision owner, run status, planned perspectives, and failed perspectives. Cost is not a constraint: when CHAOS fits, launch every suitable flagship model in `MODEL_USAGE.md` in parallel unless the user narrows the run, a model/route is unavailable, off-modality, unsafe, not independent, or direct verification is stronger.
2. **Separate.** Collect independent first positions before agents see peer answers. In Council and Deep runs, every first-position adviser answers the same full frame. Perspectives are lenses or evidence emphases, not exclusive topic assignments; topic-sharded research is scouting only.
3. **Externalize.** Convert positions into claims, assumptions, evidence, confidence basis, uncertainty, and risks.
4. **Cross-examine.** Critique specific claims using `claim → evidence → consequence → requested change`.
5. **Revise.** Defend, narrow, correct, merge, concede, withdraw, or preserve dissent.
6. **Synthesize.** The parent normalizes claims and writes the final answer against the frame. Agreement counts are never truth.
7. **Record.** For nontrivial runs, keep a claim ledger. Save substantial outputs, verify files exist, retry one failed perspective once with a smaller prompt, or record the degraded perspective. Code claims require locatable evidence: `file:line`, diff hunk, test output, command output, or stable permalink.

## Output contract

Return: decision or answer; surviving claims with support; changed/narrowed/rejected/merged/withdrawn claims; live objections or minority report; uncertainty and validation still needed; failed/degraded perspectives; and why the synthesis follows from the frame. If the evidence standard is unmet, return `unresolved after exhaustive available review`, `needs direct test`, `needs external expertise`, or `insufficient evidence`. Use [references/artifact-schemas.md](references/artifact-schemas.md) for durable artifact shapes.

## References and final check

Use references by need: [references/orchestration.md](references/orchestration.md) before multi-agent launch, artifact handling, failure handling, or review-loop coordination; [references/evaluation-rubric.md](references/evaluation-rubric.md) before final synthesis; [references/philosophy.md](references/philosophy.md) only when modifying the skill or resolving protocol-design ambiguity.

Before finishing, confirm: frame explicit; every Council/Deep first-position adviser answered the whole frame; no scouting/topic shard counted as first position; ledger present when nontrivial; critiques targeted claims; revisions visible; parent synthesis not majority rule; dissent and validation gaps recorded.
