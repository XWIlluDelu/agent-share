---
name: docdoki
description: >-
  Use for project work guided by a docdoki/ library: load before substantial
  implementation covered by its design, even when the user does not name DocDoki.
  Maintain human intent, decided specs (including unimplemented requirements),
  implementation evidence, and work state. Also use to init/adopt a library,
  answer project questions, follow human design edits, challenge drift, groom
  documents, or prepare an explicit continuation handoff. Do not introduce it
  for unrelated README/docs copyediting, code with no relevant library, or chat
  summaries not intended to continue project work.
---

# DocDoki

DocDoki is a shared project document space, primarily maintained by the agent.
The human supplies intent and important design choices, reads the main documents
to understand design and progress, and can edit them to steer the project. The
agent turns that input into usable contracts, implements authorized work, checks
conformance, and keeps useful state and knowledge current. Read
[Philosophy](references/philosophy.md) for the principles behind this collaboration
when designing or adapting the library.

It is a library of files and agent procedures, not an application or a protocol
CLI. Use normal reading, editing, Git, and verification tools. The optional panel
is not required for any core operation and is not installed by default. The
[related work](references/related-work.md) is optional background for comparing approaches,
not an additional set of operating rules.

## Start here

Find the relevant `<unit>/docdoki/` in the project or its ancestors. Follow child
unit links where the work belongs, and use the nearest applicable intent and
contracts; do not adopt an unrelated repository just because this skill exists.
If there is no relevant library and no request to create one, do the ordinary
task without introducing DocDoki. A code task can be covered even if it never
mentions documentation. README, comments, and ordinary `docs/` work alone are
not a trigger unless they feed this library.

The main project reading paths are:

- `northstar.md`: intent, success criteria, and hard constraints.
- `spec_abstract.md`: design and progress overview with links to detail.
- `specs/`: current decided design contracts, including requirements not yet
  implemented. Code and checks establish conformance, not design authority.
- `stages/`: current work, known gaps, evidence, and next actions.
- `notes/`: reusable methods, reasons, evidence, and lessons.

Read [Document schemas](references/schemas.md) when the library format is
unfamiliar or before creating, moving, or changing documents. Load relevant
project detail, not every note and archived stage.

## Ordinary project work

For “continue implementing this feature” and other substantial covered work:

1. Read project intent and the overview, the relevant specs, and the matching
   active stage. Inspect existing changes before editing. Use
   [Work stages](references/operations.md#work-stages) to select, reuse, or create
   a stage when persistent state is needed.
2. Determine the requested scope and permission to write. Use existing decisions
   as the guide; label proposed choices as proposals until decided. For conflicts
   or unclear authorization, read
   [Shared decisions](references/operations.md#shared-decisions).
3. Implement the authorized work. Preserve valid requirements even when they are
   not yet met. Resolve clear local problems yourself; request only decisions
   or access that materially affect the outcome.
4. Check the changed behavior with evidence appropriate to the claim. Distinguish
   confirmed behavior, known unmet requirements, and what was not checked. Do
   not use code reading alone to claim measured performance or deployment success.
5. Persist meaningful changes: maintain the affected contracts if authorized
   design changed, update work state and overview summaries, and retain reusable
   lessons in their proper home. If document paths or references changed, follow
   [Privacy](references/privacy.md) and run the bundled boundary check. Leave
   unrelated documents alone. If nothing relevant changed, no documentation edit
   is necessary. A progress update is not a full handoff and needs no kickoff prompt.

## Boundaries in every operation

- **Read/review is zero-write**, including formatting, status, grooming,
  generated files, and stage creation. Report useful changes instead.
- **Maintenance is not unrestricted design authority.** Preserve the meaning
  of human input, wherever it is written. Repair direction needs decided design,
  authorization, evidence, and scope; never weaken a valid contract to excuse
  wrong implementation. See [Shared decisions](references/operations.md#shared-decisions).
- **Private stays private.** Private documents live only in the ignored
  `docdoki/private/` overlay. Public documents and public-facing answers cannot
  depend on or expose them. Read [Privacy](references/privacy.md) before setup,
  handling private information, or changing paths, references, or visibility;
  run its bundled check when required. Store no credentials in either scope.

## Named operations

Natural-language intent selects the operation, not an exact keyword. Read
[Operations](references/operations.md), its shared decisions and the selected
section, before using a named procedure. Read schemas only as needed for the
project documents being handled.

| Operation | Use and result |
| :-- | :-- |
| `init` | Set up a library from stated intent; expose important unknowns without inventing decisions. |
| `adopt` | Read an existing project and establish contracts, observations, gaps, and useful knowledge separately. |
| `ask` | Answer from documents and appropriate read-only checks; change no files. |
| `follow` | Interpret human input or edits, including specified commits; review impacts or propagate within authorized scope. |
| `challenge` | Review conformance or repair in-scope drift when requested; do not implement an entire unfinished roadmap. |
| `groom` | Clean and consolidate library content without losing obligations or useful reasons. |
| `handoff` | On a request to continue elsewhere, rewrite the matching stage and give a cold-start kickoff prompt. |

“Compact,” “wrap up,” and “save context” can request a continuation handoff;
“summarize this for an email” does not. For ordinary work-state updates or stage
closure, use [Work stages](references/operations.md#work-stages), not an unasked
handoff. Inspection alone defaults to review; a repair/propagation request permits
in-scope writing, subject to explicit restrictions.
