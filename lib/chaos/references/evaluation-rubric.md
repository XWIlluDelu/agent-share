# CHAOS evaluation rubric

## Evidence hierarchy

Prefer direct tests, observations, primary sources, calculations, and inspected artifacts over indirect summaries. For code or implementation claims, prefer `file:line`, diff hunks, command output, test output, logs, or stable permalinks. Explicit reasoning can support inferences but must not override stronger direct evidence. Unsupported confidence has no decision weight.

## Confidence handling

Record confidence only with basis: evidence quality, method fit, agreement with direct observations, and known uncertainty. Challenge confidence changes during critique. Treat confidence as calibration metadata, not authority.

## Diversity check

A perspective is diverse only if it changes at least one operational axis: source path, method, assumptions, evidence standard, failure mode, stakeholder criterion, verification technique, or model family. Persona labels, tone changes, or roleplay without different work do not count.

## Anti-patterns

- Majority vote, threshold consensus, or unanimity as truth.
- Forced consensus that erases minority objections.
- Swarm/chatroom dynamics without claim IDs, evidence, or parent synthesis.
- Persona theater instead of operational diversity.
- Topic sharding masquerading as Council: one model writes theory, another applications, another critique, without each first-position adviser answering the whole frame.
- Eloquent unsupported claims outranking tests, sources, or inspected artifacts.
- Deference to weak agents, confident agents, or special roles.
- Repeated rounds after no new evidence or useful narrowing appears.
- Hidden judge responsibility or advisory agents self-accepting final claims.
- Context contamination before independent first positions.

## Synthesis rubric

Judge the final answer by: fit to the frame; quality and directness of evidence; claim survival under critique; severity of unresolved risks; feasibility of remaining validation; breadth of available independent coverage; and whether dissent is preserved clearly enough for a later reviewer to act on it.

## Process metrics

Useful diagnostics: number of unique first hypotheses, changed/narrowed claims, minority-correct adoption, wrong-majority reversal, unresolved-risk severity, and claims moved from unsupported to tested. Metrics are not proof of correctness.

## Failure outcomes

Use explicit failure states instead of false certainty:

- `unresolved after exhaustive available review`
- `needs direct test`
- `needs external expertise`
- `insufficient evidence`
- `degraded: independent agents unavailable`
- `degraded: planned perspective failed`

## Scenario checks

| Scenario | Expected behavior |
|---|---|
| Simple lookup or deterministic calculation | Skip CHAOS; verify directly. |
| Raw divergent brainstorming | Skip CHAOS until ideas need pruning, feasibility testing, or risk review. |
| Tightly coupled implementation or verification | Skip CHAOS unless independent reading or review can add value; use direct verification or a one-writer review loop. |
| Existing plan, document, or claim audit | Extract claims, create ledger, target critiques to claim IDs, record changed/withdrawn/surviving claims. |
| Broad design or research decision | Collect same-question independent first positions with real diversity axes; use topic-sharded research only as scouting; preserve minority report. |
| Majority pressure | Do not cite agreement count as truth; address or preserve the strongest minority objection. |
| Software or web review | Require locatable artifact evidence for implementation claims. |
| Document understanding dispute | Separate text evidence, interpretation, assumptions, and uncertainty. |
| Exhausted useful coverage | Return an explicit failure state rather than forced consensus. |
| Persona-theater prompt | Convert style roles into operational duties or reject them as fake diversity. |
| Failed agent | Retry once with a smaller prompt or record the missing perspective and reduced coverage in the receipt. |
