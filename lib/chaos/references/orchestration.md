# CHAOS orchestration

## Independence

Full CHAOS needs real independent agent runs. If independent agents are unavailable, say so and run a degraded single-agent claim audit. Do not simulate internal voices and label them independent.

Give independent agents the same frame, evidence standard, output schema, and constraints. In Council and Deep runs, every first-position agent answers the whole frame; diversity comes from lens, evidence route, assumptions, failure mode, method, or model family, not exclusive topic ownership. Do not show peer answers before first positions are complete. Use fresh context or another isolation method when available.

## Role assignment

Assign task-specific duties, not theatrical personas. Valid duties include external evidence search, local artifact inspection, quantitative check, assumption challenge, stakeholder criterion, adversarial review, consistency check, implementation plan, validation, and risk audit. Each role must state its diversity axis. Topic-sharded research is valid only as scouting or evidence appendix; it cannot replace same-question first positions.

## Prompt contract

Ask advisory agents for compact artifacts:

- position memo: answer to the whole framed question, diversity axis, claims, evidence, assumptions, uncertainty, risks, confidence basis;
- critique: `claim → evidence → consequence → requested change`;
- revision: defended, narrowed, corrected, merged, withdrawn, unresolved, or dissent.

## Parent synthesis

The parent builds the ledger, normalizes duplicate claims, weighs evidence against the frame, and writes the final answer. Agreement counts, confidence, seniority, or special-role labels do not decide. If the user names a human decision owner, the parent still prepares the synthesis for that owner rather than hiding judgment inside agent outputs.

## Single-writer rule

Parallelize reading, research, critique, and validation across all suitable flagship advisers. Serialize implementation and final writing unless writers are isolated. In review loops, use one writer, then all useful fresh reviewers, then parent-synthesized fixes, then one follow-up writer if authorized.

## Artifact handling

For nontrivial runs, save substantial outputs to files and verify they exist before relying on them. Suggested names:

- `chaos-frame.md`
- `chaos-positions/<perspective>-position.md`
- `chaos-ledger.md`
- `chaos-critiques.md`
- `chaos-revisions.md`
- `chaos-receipt.md`
- `chaos-minority-report.md`

Use equivalent names when the workspace demands it. Preserve minority reports and failed perspectives even when the final decision proceeds.

## Failure handling

If an advisory run fails, times out, refuses, or produces unusable output:

1. Record the perspective, failure reason, and affected diversity axis.
2. Retry once with a clearer or smaller prompt if the perspective is decision-relevant and the failure may be recoverable.
3. If still missing, continue with remaining evidence only when safe.
4. Mark the run degraded and list reduced coverage in the decision receipt.
5. Never fabricate the missing perspective.

If available parallel coverage still fails to meet the evidence standard, stop with `unresolved after exhaustive available review`, `needs direct test`, `needs external expertise`, or `insufficient evidence`.

## Saved chains and automation

Saved chains, custom agents, validators, or scripts are optional future optimizations. They must not force consensus, replace parent synthesis, hide missing artifacts, or weaken independent first positions.
