---
name: docdoki
description: >-
  Maintain a project's living documentation library under docdoki/: human-readable
  documents (northstar, spec abstract, living specs, stages, notes) kept aligned with
  the human's design and with the implementation. Use this whenever the user sets up
  or adopts documentation for a project, has edited the docs and wants the change
  understood and propagated into code, wants to compact, wrap up, or hand off
  in-flight work for the next agent or session, suspects the documents have drifted
  from the implementation, wants the library cleaned up and consolidated, or asks
  a project question the library can answer — even when they don't say "docdoki" or
  name a document by type. Also load it when the project contains a docdoki/ library,
  before non-trivial work in code the library covers. Do not use it for
  one-off writing outside this library — a standalone README, code docstrings
  or comments, or a project's ordinary docs/ folder — unless that content
  lives in or feeds docdoki/.
---

# DocDoki

DocDoki is a document library a human and an agent maintain together. Its work is to
keep two alignments current when the protocols run: the human's design ↔ `docdoki/`,
and `docdoki/` ↔ the implementation. The human reads and steers the high level; the
agent carries the detail, keeps the library true, and does almost all the upkeep.

It is a library, not a program. The protocol names below (`follow`, `challenge`,
`groom`, …) are codenames for procedures *you*, the agent, carry out with ordinary
Read / Edit / Bash (including git). There is no CLI and nothing to invoke; `follow`
means "the human edited a document — understand the change, polish it, and align the
implementation to it," and `challenge` means "reconcile the documents with the code —
find untrue records or wrong implementation and repair them." You read this skill, then
act.

## Protocols

| Protocol | Mode | Meaning |
| :-- | :-- | :-- |
| `init` | write | Scaffold the `docdoki/` skeleton; link to a parent library if one exists above. |
| `adopt` | write | Read an existing project and draft northstar, spec abstract, specs, notes, and any in-flight stage. |
| `ask` | read | Answer from the documents plus read-only code checks; change nothing. |
| `follow` | review / write | Act on recent human doc edits: understand, judge, then propagate into the documents and the implementation. |
| `challenge` | review / write | Reconcile docs with code on a scope you're given or choose (a spec, an area, or all); surface drift, then repair it. |
| `groom` | write | Deliberately clean the library: forget low-value churn, promote accumulated detail into structure, keep documents lean. |
| `handoff` | write | Rewrite the matching stage as current handoff state and print a kickoff prompt. |

Natural language counts: `compact`, `wrap up`, `save context`, `summarize session`
mean `handoff`; `tidy`, `clean up the docs`, `consolidate` mean `groom`. Review mode
reads and reports only; write mode makes the changes.

**Grooming and reconciliation also ride along.** Every `follow` and `challenge` grooms
what it touches and reconciles it against the code — `groom` and `challenge` are the
*deliberate* passes, not the only time the library is kept true. `handoff` does neither:
it writes its stage and prints a kickoff prompt, nothing else. Full procedures:
`references/operations.md`.

## Documents

```text
<unit>/docdoki/
  northstar.md            # intent: mission, success criteria, hard constraints
  spec_abstract.md        # the design map across areas + cross-spec direction
  specs/<name>.md         # one per code/data area; covers globs index the code
  stages/<protocol>-<topic>-<date>.md          # active work + handoff state
  stages/archive/<protocol>-<topic>-<date>.md  # closed snapshots, not routine input
  notes/<topic>.md        # reusable methods, gotchas, and evidence, with source pointers
```

The layering matches who keeps each thing true most cheaply, and what the human needs
to see:

- **`northstar.md`** and **`spec_abstract.md`** are the human's surface — intent and the
  design map. Reading just these two tells a human how the project runs and where it is.
  `northstar.md` is the only high-threshold document; `spec_abstract.md` is the main
  steering surface.
- **`specs/*.md`** are agent-owned contracts, reconciled with the code when challenged.
- **`stages/*.md`** and **`notes/*.md`** are the depth: work in flight, dead ends,
  methods, gotchas. The agent retrieves them on demand; the human need not hold them.

Child units use `parent: ../../docdoki/northstar.md`; parent units list children under
`## Units`; child northstars include `## Contribution`. Schemas and parent/child links:
`references/schemas.md`.

## Working rules

- Read a document before you change it. A human
  edit you have not yet propagated is a requirement, not noise — understand it, polish
  it, align the code; never blind-overwrite it away.
- **Never weaken a correct spec to ratify wrong code.** When documents and code
  disagree, decide by cause, not convenience — the three-way split (fix the doc / fix
  the code / the human decides) is in `references/philosophy.md` (Collaboration).
- **Record only what you have grounds for** — read from the code, or heard from the
  human. Reconstructing what the code does is grounds; ungrounded guessing is not.
- **Forgetting keeps only a recovery trace.** When you drop low-value content, the
  working tree reads as if it had always said the current thing. Only committed text
  has that recovery trace; durable lessons are routed before deletion, not hidden in
  commit messages. Do not create a side-channel ledger.
- **Reconcile a spec by reading the code it covers** — when asked, or when you work in
  that code. Never assume a claim holds; confidence is earned by the reading. Flag in
  prose any claim you have not checked, and never present it as confirmed.
- **git is for focus, not verdict.** `git diff` / `git log` over a spec's `covers` show
  *what changed* and point you where to look; whether a doc is true is your judgment,
  reading the code.

## Stage selection

Stage selection — explicit user mention; unique match by `scope` (the path globs it
touches); the single active stage; otherwise ask — is in `references/stages.md`,
including how multiple active stages and overlapping scopes are handled.

## References

Read the relevant reference before acting.

- `references/philosophy.md` — why the library exists; the human/agent ownership split; the autonomy yardstick.
- `references/operations.md` — the procedure behind each protocol, grooming, audit, and the upkeep that rides along.
- `references/schemas.md` — document schemas, covers, parent/child links.
- `references/stages.md` — stage selection, handoff, and the close lifecycle.

An optional panel (`python panel/panel.py`) projects the library as an editable
dell-1996 canvas — a bonus surface whose write-backs are ordinary human document edits
that `follow` handles, and whose copy prompt is spoken intent; it does not block use.
