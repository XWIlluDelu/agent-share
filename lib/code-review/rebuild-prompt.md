# Rebuild the `code-review` Skill

Design and rewrite `SKILL.md` in this directory from scratch. Do not treat the
existing `SKILL.md` as a template or design authority; once you reach a fresh
synthesis, replace it directly.

## Requirements

This skill conducts code reviews—usually across an entire repository, and
occasionally over a user-specified directory, package, module, feature, or
change. Target repositories are typically small to medium, so whole-repository
reviews should cover all relevant first-party code rather than sampling only
hotspots.

Focus the review on:

- Concrete, well-evidenced bugs;
- Architectural and organizational improvements that increase maintainability
  and clarity while reducing coupling and cognitive load;
- Duplicate code, duplicate concepts, competing sources of truth, dead code,
  low-value abstractions, and obsolete compatibility paths;
- Aggressive cleanup recommendations (removing dead code, superseded
  implementations, and unneeded compatibility layers) when the user explicitly
  states—or repository evidence clearly establishes—personal or autonomous
  small-team ownership; remain conservative when ownership or external
  consumers are uncertain.

Reviews are read-only by default. Modify code only when the user authorizes
fixes upfront or explicitly approves them after reviewing the findings.

## Rebuild Principles

Start with fresh research into strong publicly available skills and established
methods for code review, whole-codebase audits, architecture review, and
maintainability review. Be selective: draw only from a small set of references
that genuinely fit the requirements above and contribute distinct judgment
methods. Do not carry over a reference merely because a prior version cited it.

Synthesize those insights with the requirements above to write the skill from
scratch rather than incrementally patching the previous version. Center it on
review philosophy, judgment heuristics, and evidence discipline, leaving room
for model reasoning; avoid mechanical checklists, finding quotas, health
scores, arbitrary line-count thresholds, and over-prescriptive workflows.

Require every substantive finding to rest on verifiable code locations, call or
trigger paths, structural mechanisms, and concrete consequences. Separate
severity from confidence, re-verify every citation in context, merge findings
sharing one root cause, and reject preference-based, speculative, or
context-blind commentary. Preserve the read-only default and external-state
safety boundaries.
