# CHAOS evaluation rubric

Use before final synthesis to weigh evidence, calibrate confidence, and verify
the deliberation did not collapse into consensus theater.

## Evidence hierarchy

Prefer direct tests, observations, primary sources, calculations, and inspected
artifacts over indirect summaries. For code or implementation claims, require
`file:line`, diff hunks, command output, test output, logs, or stable
permalinks. Explicit reasoning can support inferences but never overrides
stronger direct evidence. Unsupported confidence has no decision weight.

## Confidence handling

Record confidence only with basis: evidence quality, method fit, agreement with
direct observations, and known uncertainty. Challenge confidence shifts during
critique. Treat confidence as calibration metadata, not authority.

## Diversity check

A perspective is diverse only if it changes at least one operational axis:
source path, method, assumptions, evidence standard, failure mode, stakeholder
criterion, verification technique, or model family. Persona labels, tone
changes, or roleplay without different work do not count.

## Synthesis rubric

Judge the final answer by:

- fit to the task frame and evidence standard;
- directness and verifiability of supporting evidence;
- claim survival under anonymized critique;
- severity of unresolved risks and feasibility of remaining validation;
- breadth of independent coverage (and explicit disclosure of degraded runs);
- actionable preservation of live minority objections.

## Process metrics (diagnostic only)

Useful diagnostics: unique first hypotheses, changed/narrowed claims,
minority-correct adoption, wrong-majority reversal, unresolved-risk severity,
and claims moved from unsupported to tested. Metrics are never proof of
correctness.

## Anti-patterns to reject

- Majority vote, threshold consensus, unanimity without counter-case check, or
  forced consensus that erases minority objections.
- Swarm/chatroom dynamics without claim IDs, evidence, or parent synthesis.
- Persona theater or topic-sharded scouting counted as whole-frame first
  positions.
- Identity-visible cross-examination, deference to fluent/confident/special
  roles, or evidence-free reversals counted as corrections.
- Context contamination before first positions, or counting process/session
  labels as proof of independence or extra claim weight.
- Extra rounds after no new evidence or useful narrowing appears, or advisory
  agents self-accepting final claims.

## Explicit failure outcomes

When the evidence standard is unmet, return one of the explicit failure states
rather than false certainty: `unresolved after exhaustive available review`,
`needs direct test`, `needs external expertise`, `insufficient evidence`,
`degraded: independent agents unavailable`, or `degraded: planned perspective
failed`.
