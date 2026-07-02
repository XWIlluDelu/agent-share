---
name: docdoki
description: >-
  Maintain a project's docdoki/ living-document library—northstar, spec abstract,
  specs, stages, and notes—in alignment with human design and implementation. Use to
  initialize/adopt it; propagate human doc edits into code; reconcile drift;
  groom/consolidate it; answer project questions from it; or compact, wrap up, save
  context, and hand off in-flight work. Also load before non-trivial work covered by
  an existing docdoki/ library, even when unnamed. Exclude standalone README,
  docstring/comment, and ordinary docs/ work unless it feeds docdoki/.
---

# DocDoki

DocDoki is a document library a human and an agent maintain together. Its work
is to keep two alignments current when the protocols run: the human's design ↔
`docdoki/`, and `docdoki/` ↔ the implementation. The human reads and steers the
high level; the agent carries the detail, keeps the library true, and does
almost all the upkeep.

It is a library, not an application. The protocol names below (`follow`,
`challenge`, `groom`, …) are codenames for procedures *you*, the agent, carry
out with ordinary Read / Edit / Bash (including git); there is no protocol CLI.
`follow` means "the human edited a document — understand the change, polish it,
and align the implementation to it," and `challenge` means "reconcile the
documents with the code — find untrue records or wrong implementation and
repair them." The bundled `scripts/check_privacy.py` is narrower: it performs
the deterministic Git and reference checks for private documents. You read this
skill, then act.

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

Natural language counts: a user request to `compact`, `wrap up`, `save context`,
or `summarize session` means `handoff` — capturing in-flight work so it continues
in another session or with another agent, not something done unasked mid-session;
`tidy`, `clean up the docs`, `consolidate` mean `groom`. Review mode reads and
reports only; write mode makes the changes.

**Grooming and reconciliation also ride along.** Every `follow` and `challenge`
grooms what it touches and reconciles it against the code — `groom` and
`challenge` are the *deliberate* passes, not the only time the library is kept
true. `handoff` does neither: it writes its stage and prints a kickoff prompt,
nothing else. Full procedures: `references/operations.md`.

## Documents

```text
<unit>/docdoki/
  northstar.md            # public intent: mission, success criteria, hard constraints
  spec_abstract.md        # public design map + cross-spec direction
  specs/<name>.md         # public contracts; covers globs index the code
  stages/<protocol>-<topic>-<date>.md          # public active work + handoff state
  stages/archive/<protocol>-<topic>-<date>.md  # public closed snapshots
  notes/<topic>.md        # public reusable methods, gotchas, and evidence
  private/                # gitignored local overlay; same schemas
    specs/<name>.md
    stages/<protocol>-<topic>-<date>.md
    stages/archive/<protocol>-<topic>-<date>.md
    notes/<topic>.md
```

The layering matches who keeps each thing true most cheaply, and what the human
needs to see:

- **`northstar.md`** and **`spec_abstract.md`** are the human's surface — intent
  and the design map. Reading just these two tells a human how the project runs
  and where it is. `northstar.md` is the only high-threshold document;
  `spec_abstract.md` is the main steering surface.
- **`specs/*.md`** are agent-owned contracts, reconciled with the code when
  challenged.
- **`stages/*.md`** and **`notes/*.md`** are the depth: work in flight, dead
  ends, methods, gotchas. The agent retrieves them on demand; the human need not
  hold them.
- **`private/`** is part of the same library, not a side channel. Its specs,
  stages, and notes use the same schemas, stage selection, grooming, and unique
  filename stems as public documents. The path is the visibility authority:
  public documents may not depend on private documents, while private documents
  may reference public ones. A public clone must remain internally true without
  the overlay. Credentials, private keys, and tokens never enter either scope.

Which document a grounded fact enters is a two-step test, and getting it wrong is
the root of most drift:

1. **Does it enter the library at all?** Keep what constrains or teaches the work
   — a contract, a method, a gotcha, a reason worth not re-deriving. Drop what
   only records that an action happened: byte counts, timings, and "we downloaded
   / built / verified" narration. Identity and inventory need the same
   load-bearing test rather than automatic deletion: a host alias or local path
   that durably changes how future work runs belongs in a private note; a
   transient location needed only to resume belongs in the matching stage; a
   public document keeps the portable capability rather than the local identity.
   Select by information density against the space you have — a dense summary
   beats an exhaustive log.
2. **Which layer?** A **spec** is a standing assertion the implementation must
   satisfy — true of the code as it stands, re-checkable against a code target at
   any time. A how-to, a gotcha, reusable evidence, or the residue of a completed
   activity ("we validated X, it passed") with no standing code target is a
   **note**. The current state of in-flight work — status, next actions, results
   so far — is a **stage**, a work capsule, not a reference store: it points
   reference depth (paper derivations, code maps, data writeups) into notes rather
   than holding it. A spec is timeless — transient status stays in the stage, and
   "did X and it worked" is an event whose residue is a note or a stage, never a
   fresh spec; the standing-contract rule and the sections it forbids live in
   `references/schemas.md` (specs/*.md). Decide by this test, not by what the fact
   is nominally "about."

Child units use `parent: ../../docdoki/northstar.md`; parent units list children
under `## Units`; child northstars include `## Contribution`. Schemas and
parent/child links: `references/schemas.md`.

## Working rules

- Read a document before you change it. A human edit you have not yet propagated
  is a requirement, not noise — understand it, polish it, align the code; never
  blind-overwrite it away.
- **Formatting is meaning.** A heading is sentence case (an identifier keeps its
  own casing); a command, code line, or standalone path belongs inside a fence,
  since unfenced it reads as prose and a leading `#` reads as a heading; an empty
  section heading is a promise unkept, so omit it. Full conventions:
  `references/schemas.md` (Formatting conventions).
- **Never weaken a correct spec to ratify wrong code.** When documents and code
  disagree, decide by cause, not convenience — the three-way split (fix the doc
  / fix the code / the human decides) is in `references/philosophy.md`
  (Collaboration).
- **Record only what you have grounds for** — read from the code, or heard from
  the human. Reconstructing what the code does is grounds; ungrounded guessing
  is not. Grounds admits a fact; it does not select it — whether a grounded fact
  belongs in the library at all, in which layer, and in which visibility scope
  is the routing test under Documents.
- **Keep the private boundary physical.** Put private documents only under
  `docdoki/private/`, keep that subtree ignored and untracked, and run
  `scripts/check_privacy.py <unit>` after init and whenever visibility or
  references change. Never use frontmatter as the access-control authority.
- **Forgetting keeps only a recovery trace.** When you drop low-value content,
  the working tree reads as if it had always said the current thing. Only
  committed text has that recovery trace; durable lessons are routed before
  deletion, not hidden in commit messages. Do not create a side-channel ledger,
  and do not point a document's durable content at an external store (an agent
  `MEMORY.md`, a chat log): a lesson's home is a library note or spec, so the
  library stays self-contained for what it claims to hold.
- **Reconcile a spec by reading the code it covers** — when asked, or when you
  work in that code. Never assume a claim holds; confidence is earned by the
  reading. Flag in prose any claim you have not checked, and never present it as
  confirmed.
- **git is for focus, not verdict.** `git diff` / `git log` over a spec's
  `covers` show *what changed* and point you where to look; whether a doc is
  true is your judgment, reading the code.

## Stage selection

Stage selection — explicit user mention; unique match by `scope` (the path globs
it touches); the single active stage; otherwise ask — is in
`references/stages.md`, including how multiple active stages and overlapping
scopes are handled.

## References

Read the relevant reference before acting.

- `references/philosophy.md` — why the library exists; the human/agent ownership
  split; the autonomy yardstick.
- `references/operations.md` — the procedure behind each protocol, grooming,
  audit, and the upkeep that rides along.
- `references/schemas.md` — document schemas, covers, parent/child links.
- `references/stages.md` — stage selection, handoff, and the close lifecycle.

An optional panel (`panel/panel.py` in this skill) projects public and private
specs and active stages on one editable dell-1996 (catalog-era visual language)
canvas, marking private items from their path. Its write-backs are ordinary
human document edits that `follow` handles, and its copy prompt is spoken intent;
it does not block use. `init` links the script into the project's agent-tooling
directory and notes the run command, so the panel is discoverable per project
while the script remains the single authority.
