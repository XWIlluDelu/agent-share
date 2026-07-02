# Stages

A stage is an active work capsule and handoff document for one work stream. It captures
the current objective, state, next actions, the decisions and dead ends worth keeping,
and a handoff — enough to make a fresh agent productive from current state rather than
from a transcript. The stage is the handoff surface. See `references/schemas.md` for the
frontmatter and section list.

## Selecting a stage

When an operation targets a stage, choose by:

1. explicit user mention;
2. unique match by `scope` (the path globs the stage touches);
3. the single active stage;
4. otherwise ask.

Multiple active stages are normal for multi-agent, multi-branch, or multi-objective
work, and are justified when objectives or scopes differ. Overlapping scopes are a
coordination signal, not an error: when you notice overlap, name the stage explicitly
rather than guess.

## Creating vs reusing

Create a new stage when the work has a distinct objective, scope, branch, or agent
stream. Reuse an existing stage when the work serves the same objective and overlaps the
same paths. Reuse the file for the same topic; a new file means a distinct work stream.
Fill `scope` promptly — an unscoped stage cannot be selected by rule 2.

## Handoff

Compacting a session — "compact", "wrap up", "save context", "summarize session", or
context pressure — updates the matching active stage; it never creates separate session
files. The procedure, and the rule that handoff writes only the stage and routes nothing,
are in `references/operations.md` under `handoff`.

## Closing

A stage closes when its objective is completed, abandoned, superseded, split, or merged.
You make that semantic judgment. The rule is one line: **route durable content out, then
archive** — and the order matters, so nothing valuable is sealed away unrouted.

Route first: durable requirements → specs or `spec_abstract.md`; reusable methods,
gotchas, and dead ends → notes; unfinished work → another active stage or a new one;
the completion fact and non-durable closure rationale → the seal commit body. Then
rewrite the stage into a compact final snapshot and move the file to
`docdoki/stages/archive/`.

Archived stages are closed reference snapshots. They are excluded from routine status
reading and challenge, and read only on explicit request or when current documents lack
context they should have contained.
