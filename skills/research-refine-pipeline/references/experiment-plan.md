# Experiment Plan: Claim-Driven Validation Roadmap

Use this bundled workflow when the method thesis is already stable enough to plan execution. Do not widen the paper story here. Translate the existing proposal into the smallest experiment program that can prove the dominant claim.

## Inputs

Prefer these files when they exist:

- `refine-logs/FINAL_PROPOSAL.md`
- `refine-logs/REVIEW_SUMMARY.md`
- `refine-logs/REFINEMENT_REPORT.md`

If they do not exist, ask the user for the final method thesis, dominant contribution, constraints, and must-prove claims before planning.

## Outputs

Write:

- `refine-logs/EXPERIMENT_PLAN.md`
- `refine-logs/EXPERIMENT_TRACKER.md`

## Core Rules

1. One paper, one dominant claim. Keep every run tied to that claim or to one necessary supporting claim.
2. Prefer decisive experiments over exhaustive coverage.
3. Put the highest-risk assumption early in the run order.
4. If the method is intentionally simple, defend that simplicity with deletion checks instead of adding extra components.
5. If a frontier primitive is central, add one necessity test. If it is not central, do not force one.

## Workflow

### Phase 0: Extract the Validation Target

Write a short planning preamble:

- Final method thesis
- Dominant contribution
- Optional supporting contribution
- Must-prove claims
- Explicitly rejected complexity
- Constraints: compute, data, annotation, timeline

If these are fuzzy, stop and tighten the proposal before planning experiments.

### Phase 1: Map Claims to Evidence

For each claim, define:

- the exact claim
- the smallest decisive experiment
- the baseline or ablation needed
- the decisive metric
- the expected directional outcome
- the failure condition that would weaken the claim

Default to 1-3 core experiment blocks.

### Phase 2: Design the Run Order

Order runs by information value:

1. sanity / integration check
2. anchor result
3. novelty isolation
4. simplification or deletion check
5. frontier necessity check if applicable
6. only then broader robustness or scaling work

For each run, specify:

- objective
- dataset or benchmark
- model/config
- metric
- expected runtime or budget
- decision gate

### Phase 3: Plan Ablations and Diagnostics

Keep ablations surgical:

- remove the new mechanism
- replace the claimed mechanism with the closest simpler alternative
- freeze vs train if that distinction matters
- test one critical design choice at a time

Also list:

- highest-risk failure modes
- what artifact or metric would reveal each failure
- what fallback run should happen next

### Phase 4: Write the Deliverables

Write `refine-logs/EXPERIMENT_PLAN.md` using:

```markdown
# Experiment Plan

**Problem**: [problem]
**Method Thesis**: [one sentence]
**Dominant Contribution**: [one sentence]
**Date**: [today]

## Validation Targets
- Claim 1:
- Claim 2:

## Run Order
| Run | Purpose | Dataset / Setup | Metric | Budget | Decision Gate |
|-----|---------|-----------------|--------|--------|---------------|
| 1 | ... | ... | ... | ... | ... |

## Core Experiments
### Run 1: [name]
- Goal:
- Inputs / setup:
- Baselines / ablations:
- Success criterion:
- Failure criterion:
- Next action if failed:

## Ablation Strategy
- [ablation]:
- [ablation]:

## Risk Register
| Risk | How to detect | Mitigation / fallback |
|------|---------------|-----------------------|
| ... | ... | ... |

## Minimum Paper Story
- Anchor result:
- Novelty isolation:
- Simplicity check:
- Frontier necessity check:
```

Write `refine-logs/EXPERIMENT_TRACKER.md` using:

```markdown
# Experiment Tracker

| Run | Status | Owner | Result | Notes | Next Step |
|-----|--------|-------|--------|-------|-----------|
| 1 | pending | agent | - | [goal] | [launch first] |
```

## Presenting Back to the User

Summarize:

- the dominant claim being tested
- the first three runs to launch
- the key decision gates
- the highest-risk assumption

## Anti-Patterns

Avoid:

- turning one claim into a giant benchmark spreadsheet
- adding experiments that imply a broader paper story than the method supports
- using ablations to compensate for a fuzzy thesis
- hiding the highest-risk assumption late in the plan
