# research-refine templates

All Markdown templates used by `SKILL.md`. Copy from here when writing files under `refine-logs/`.

## Initial proposal (`refine-logs/round-0-initial-proposal.md` or working draft)

```markdown
# Research Proposal: [Title]

## Problem Anchor
- Bottom-line problem:
- Must-solve bottleneck:
- Non-goals:
- Constraints:
- Success condition:

## Technical Gap
[Why current methods fail, why naive bigger systems are not enough, and what mechanism is missing]

## Method Thesis
- One-sentence thesis:
- Why this is the smallest adequate intervention:
- Why this route is timely in the foundation-model era:

## Contribution Focus
- Dominant contribution:
- Optional supporting contribution:
- Explicit non-contributions:

## Proposed Method
### Complexity Budget
- Frozen / reused backbone:
- New trainable components:
- Tempting additions intentionally not used:

### System Overview
[Step-by-step pipeline or ASCII graph]

### Core Mechanism
- Input / output:
- Architecture or policy:
- Training signal / loss:
- Why this is the main novelty:

### Optional Supporting Component
- Only include if truly necessary:
- Input / output:
- Training signal / loss:
- Why it does not create contribution sprawl:

### Modern Primitive Usage
- Which LLM / VLM / Diffusion / RL-era primitive is used:
- Exact role in the pipeline:
- Why it is more natural than an old-school alternative:

### Integration into Base Generator / Downstream Pipeline
[Where the new method attaches, what is frozen, what is trainable, inference order]

### Training Plan
[Stagewise or joint training, losses, data construction, pseudo-labels, schedules]

### Mechanism Contract
- Claim-bearing components and interfaces:
- Observation / data assumptions:
- Training objectives tied to each component:
- Inference sequence:

### Failure Modes and Diagnostics
- [Failure mode]:
- [How to detect]:
- [Fallback or mitigation]:

### Novelty and Elegance Argument
[Closest work, exact difference, why this is a focused mechanism-level contribution rather than a module pile-up]

## Claim-Driven Validation Sketch
### Claim 1: [Main claim]
- Minimal experiment:
- Baselines / ablations:
- Metric:
- Expected evidence:

### Claim 2: [Optional]
- Minimal experiment:
- Baselines / ablations:
- Metric:
- Expected evidence:

## Experiment Handoff Inputs
- Must-prove claims:
- Must-run ablations:
- Critical datasets / metrics:
- Highest-risk assumptions:

## Validation Contract
- Main claim to prove:
- Decisive baseline or ablation:
- Metric:
- Expected evidence:

## Compute & Timeline Estimate
- Estimated GPU-hours:
- Data / annotation cost:
- Timeline:
```

## Score evolution (`refine-logs/score-history.md`)

Create only when multiple scored review rounds were actually used.

```markdown
# Score Evolution

| Round | Problem Fidelity | Method Specificity | Contribution Quality | Frontier Leverage | Feasibility | Validation Focus | Venue Readiness | Overall | Verdict | Main Blocking Issue |
|-------|------------------|--------------------|----------------------|-------------------|-------------|------------------|-----------------|---------|---------|---------------------|
| 1     | X                | X                  | X                    | X                 | X           | X                | X               | X       | REVISE  | [short phrase]      |
```

## Round refinement (`refine-logs/round-N-refinement.md`)

Use only when a round caused substantive method changes worth preserving. Keep it lean.

```markdown
# Round N Refinement

## Problem Anchor
[Copy verbatim from round 0]

## Anchor Check
- Original bottleneck:
- Why the revised method still addresses it:
- Reviewer suggestions rejected as drift:

## Simplicity Check
- Dominant contribution after revision:
- Components removed or merged:
- Reviewer suggestions rejected as unnecessary complexity:
- Why the remaining mechanism is still the smallest adequate route:

## Blocking Issues Addressed
### 1. [Blocking issue]
- Reviewer said:
- Action:
- Reasoning:
- Impact on core method:

### 2. [Optional second issue]
- Reviewer said:
- Action:
- Reasoning:
- Impact on core method:

## Non-blocking Suggestions Deferred or Accepted
- [Suggestion] → [accepted / deferred / rejected] — [why]

## Revised Proposal
[Full updated proposal only if needed; otherwise summarize the changed sections and point to FINAL_PROPOSAL.md]
```

## Review summary (`refine-logs/REVIEW_SUMMARY.md`)

Create when reviewer feedback materially improved the proposal.

```markdown
# Review Summary

**Problem**: [user's problem]
**Initial Approach**: [user's vague approach]
**Date**: [today]
**Rounds Used**: N
**Final Verdict**: [READY / REVISE / RETHINK]
**Final Overall Score**: [X / 10 if scored]

## Problem Anchor
[Verbatim anchor used across rounds]

## Resolution Log

| Round | Blocking Issues | What Changed | Anchor Preserved? | Remaining Risk |
|-------|-----------------|--------------|-------------------|----------------|
| 1     | [top blockers]  | [main fixes] | [yes / partial / no] | [if any] |
| 2     | ...             | ...          | ...               | ...            |

## Key Proposal Upgrades
- [Most important focusing or simplification move]
- [Most important mechanism concretization]
- [Most important modernization or justification for staying simple]

## Remaining Weaknesses
- [Honest unresolved issues]
```

## Final proposal (`refine-logs/FINAL_PROPOSAL.md`)

This is the main deliverable.

```markdown
# Research Proposal: [Title]

[Paste the final refined proposal only]
```

## Refinement report (`refine-logs/REFINEMENT_REPORT.md`)

Optional audit-heavy artifact. Do not create by default.

```markdown
# Refinement Report

**Problem**: [user's problem]
**Initial Approach**: [user's vague approach]
**Date**: [today]
**Rounds**: N / MAX_ROUNDS
**Final Verdict**: [READY / REVISE / RETHINK]
**Final Score**: [X / 10 if scored]

## Problem Anchor
[Verbatim anchor used across all rounds]

## Score Evolution
[Paste the score-history table if it exists]

## Round-by-Round Review Record
| Round | Blocking Issues | Non-blocking Suggestions | What Changed | Result |
|-------|-----------------|--------------------------|--------------|--------|
| 1     | [top issues]    | [optional]               | [main fixes] | [resolved / partial / unresolved] |

## Final Proposal Snapshot
- Canonical clean version lives in `refine-logs/FINAL_PROPOSAL.md`
- Summarize the final thesis in 3-5 bullets here

## Pushback / Drift Log
| Round | Reviewer Said | Author Response | Outcome |
|-------|---------------|-----------------|---------|
| 1     | [criticism]   | [pushback + anchor / evidence] | [accepted / rejected] |

## Remaining Weaknesses
[Honest unresolved issues]

## Raw Reviewer Responses

<details>
<summary>Round 1 Review</summary>

[Full verbatim response from reviewer model]

</details>
```

## Final user-facing summary

Present this summary directly in the reply, not mainly as file pointers.

```markdown
Refinement complete after N round(s).

Final verdict: READY / REVISE / RETHINK
Final score: X/10 [include only if a scored review was used]

## Refined thesis
- [one-sentence method thesis]

## Key upgrades over the starting idea
- [upgrade 1]
- [upgrade 2]
- [upgrade 3]

## Minimal validation blocks
1. [claim-driven block]
2. [claim-driven block]
3. [optional claim-driven block]

## Main remaining risks
- [risk 1]
- [risk 2]

## Supporting files
- Final proposal: `refine-logs/FINAL_PROPOSAL.md`
- Review summary: `refine-logs/REVIEW_SUMMARY.md` [if created]
- Full report: `refine-logs/REFINEMENT_REPORT.md` [only if created]

Suggested next step: `/research-refine-pipeline`
```
