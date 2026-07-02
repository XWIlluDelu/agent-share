# Operations

The procedure behind each protocol. A protocol is a codename for work you do with
Read / Edit / Bash (including git) — there is nothing to invoke and there is no script.
You read this skill, then act.

Three rules run through every procedure: read before you write; record only what you
have grounds for; and when documents and code disagree, never weaken a correct spec to
ratify wrong code. The reasoning is in `references/philosophy.md`.

## Contents

- `init`, `adopt` — set up a library, from scratch or from existing code
- `ask` — answer from the library plus read-only code checks
- `follow` — act on human doc edits and propagate them
- `challenge` — reconcile the documents with the code (anti-rot)
- `groom` — forget low-value churn, promote detail into structure, keep quality
- `handoff` — capture current state into a stage
- Maintenance that rides along · When not to use DocDoki

## init

Scaffold a library for a new project: create `docdoki/northstar.md` and
`spec_abstract.md` from the schemas, plus the `specs/ stages/ stages/archive/ notes/`
directories. If the unit is not already inside a git repository, run `git init` first:
committed history is the recovery trace for committed content removed during grooming,
so a docdoki library should normally live in one. In a child unit (a parent `docdoki/` exists
above), write `parent:` into the child northstar and add the child under the parent's
`## Units`. Then draft `northstar.md` from the user's stated intent and offer it for
review — it is the only high-threshold document, so the human is its source and
approver, not its typist.

## adopt

Generate a library for a project that already has code. Read the code deeply —
entrypoints, data flow, public contracts, tests — then write:

1. `northstar.md` — mission, success criteria, hard constraints. Offer it for review
   before treating it as settled.
2. `spec_abstract.md` — the design map across areas and the cross-spec direction.
3. `specs/*.md` — one per coherent code/data area: a unit a contract can be stated and
   audited about on its own (a public module, a pipeline step, a data area), not one per
   file. Give each `covers` globs; optionally set `after` (pipeline order) where the
   code makes it clear.
4. `notes/*.md` — reusable methods and gotchas you found, with source pointers.
5. a stage for any work in flight.

Do not invent contracts the code does not have; where unsure, write the claim and flag
it as not yet checked.

## ask

Read-only project Q&A. Answer from the documents plus read-only code checks, keeping
distinct what a document *claims*, what the code actually *does*, where they *disagree*,
and what you *could not verify*. Change no project meaning. If the question reveals drift
worth fixing, say so and point to `challenge`.

## follow

The human edited one or more documents. Find the edits with `git diff` and the working
tree.

- **review:** report whether each edit is reasonable, its impact on other documents and
  on the code, and any open questions. No changes.
- **write:** for a clear, reasonable edit, understand it, polish the wording, and
  propagate the intent into the affected documents and the implementation. For an
  unclear or risky edit, record the mismatch in a stage and ask rather than guess.

A human edit to `spec_abstract.md` is the common case: propagate the design direction
into concrete specs and code, or record an explicit open mismatch. Treat the human's
text as rough intent, not final wording — re-understand it into the written result, and
flag what you propagate as not yet checked against the code until you have audited it.

A panel write-back (`panel/`) is one of these human document edits — it writes straight
to the file, so you find and follow it exactly the same way. If the panel's copy-prompt
fallback is used instead, treat that prompt as spoken intent.

## challenge

Reconcile the documents with the implementation. This is the anti-rot pass.

It runs on a scope you are given or choose: a single spec, a module or area, or the
whole library. (It also rides along whenever you work in code a spec covers —
reconcile what you touched.) For each spec in scope, read the code under its `covers`,
compare it to the claims, and reconcile. git is there to focus you — `git diff` or
`git log` over `covers` shows what moved recently — but it only points; the judgment is
yours, reading the code.

- **review:** report drift only. No changes.
- **write:** repair it. For each claim, decide whether the code matches, then act by
  cause, not convenience: a legitimate code change the spec lags → fix the spec (you may,
  for clear cases); code that violates a correct spec → fix the code, or raise a stage
  when the fix is out of scope; a genuine tie → the human decides. When you confirm a
  claim by reading the code, drop any "not yet checked" flag on it — the confidence is
  earned by that reading, never assumed.

## groom

Keep the library high-quality on its own, so the human rarely has to. Grooming runs two
ways: it **rides along** with every `follow` and `challenge` (groom what you just
touched), and it runs as a **deliberate whole-library pass** when invoked or when a
document has visibly drifted from its purpose.

For each piece of content, decide one of:

- **leave** — it still earns its place; do nothing.
- **polish** — same meaning, clearer or denser wording; rewrite toward the document's
  purpose.
- **promote** — detail has accumulated until it has become a point in its own right
  (quantity becoming quality). Synthesize it into structure: a recurring gotcha across
  stages becomes a `note`; a settled, repeated decision becomes a line in a spec or in
  `spec_abstract.md`; the raw detail then recedes beneath that structure or is dropped.
- **forget** — low-value churn, process residue that was never durable, or a fact the
  code or current documents now make cheap to re-derive. The test is load-bearing, not
  attention: if re-encountering the fact could change a later decision, promote or keep
  it, never forget it; what fails the test is removed, so the document reads as if it
  had always said the current thing. Route durable lessons before deleting — a commit
  body may explain the cleanup but is not where lessons live — and only committed text
  has a recovery trace, so be surer before dropping uncommitted text.

The two failure modes grooming exists to prevent: something important buried in detail,
and the human's review surface (`northstar`, `spec_abstract`) filling with trivia or
with facts that are fixed and no longer in play. Promote the first up; forget or sink
the second.

Restraint is the default. Most content should be left alone; grooming is not a quota.
Don't manufacture cleanup — if nothing crosses the threshold of being worth a change,
the pass is already done. The aim is a library that reads as though it had always been
this clean, not a library in constant churn.

Grooming never blocks and never asks permission for ordinary cleanup. The one thing it
does not do on its own is rewrite `northstar.md`'s intent or weaken `spec_abstract.md`'s
direction — those carry the human's design, so propose the change and let the human
decide.

## handoff

Capture the current state into the matching stage (stage selection:
`references/stages.md`) so a fresh agent can continue without the transcript. In one
motion:

1. scan the conversation and current files for the objective and goal, current state
   (working / broken / modified files), next actions, decisions worth keeping, and dead
   ends not to retry;
2. rewrite the stage toward current state (never append a transcript), omitting any
   section that would be empty;
3. emit a short, copy-pasteable **kickoff prompt** for the next agent: the stage's path
   plus "continue from `## Next actions`".

handoff writes its stage and nothing else. It does not route durable content into specs,
the abstract, or notes, and does not reconcile against code — that promotion is the work
of `follow`, `challenge`, `groom`, and stage close, not of a capture under context
pressure. Durable content noticed here is recorded in the stage (`Decisions`, `Dead
ends`) and promoted later by those passes.

Keep it scannable and minimal: orientation in under 30 seconds, concrete next actions,
dead ends recorded so they are not retried, and no line that exists only because it
happened chronologically.

## Maintenance that rides along

These are not separate protocols; they happen inside the ones above.

- **status** — when you need the current picture, read the library: active stages, which
  specs look behind (read their `covers`, or `git diff`/`git log` over it, to check), and
  what needs attention. It is a reading, not a stored artifact.
- **route** — move durable content to its right home during `follow`, `challenge`,
  `groom`, and stage close. Don't let important things stay buried in a stage or note.
- **stage close** — when a stage's objective is done, abandoned, or superseded, route its
  durable content, then archive it (`references/stages.md`).

## When not to use DocDoki

- Pure code questions that do not touch the documentation library.
- A project's ordinary `docs/` directory — outside DocDoki's scope.
- Repos with no `docdoki/` and no intent to adopt one (offer `init` / `adopt`, then stop
  if declined).
