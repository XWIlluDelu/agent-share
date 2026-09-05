# Document schemas

Use this reference when reading an unfamiliar library or creating, moving, or
changing its documents. Paths in the tree below belong to a **project unit**;
they are not paths inside the installed skill.

## Contents

- [Library roles](#library-and-information-roles) · [Format and references](#common-format-and-references)
- [Northstar](#northstarmd) · [Spec abstract](#spec_abstractmd)
- [Specs](#specsmd) · [Stages](#stagesmd) · [Notes](#notesmd)

## Library and information roles

```text
<unit>/docdoki/
  northstar.md
  spec_abstract.md
  specs/<name>.md
  stages/<protocol>-<topic>-<date>.md
  stages/archive/<protocol>-<topic>-<date>.md
  notes/<topic>.md
  private/                   # ignored local overlay, when needed
    specs/<name>.md
    stages/<protocol>-<topic>-<date>.md
    stages/archive/<protocol>-<topic>-<date>.md
    notes/<topic>.md
```

| Document | What it holds | What it does not decide |
| :-- | :-- | :-- |
| `northstar.md` | Mission, success criteria, and binding constraints. | Code cannot establish the project's purpose. |
| `spec_abstract.md` | The human's design and progress overview, with direct links to detail. | A summary is not a second complete contract or task ledger. |
| `specs/` | Current decided design contracts, including unimplemented requirements. | Conformance is not implied by the existence of a spec. |
| `stages/` | Current work, implementation gaps, checks, and next actions. | A task or experiment does not silently revise a requirement. |
| `notes/` | Reusable methods, evidence, rationale, and lessons. | Proposals and observations do not become decided requirements here. |

Keep information that guides future work or saves consequential re-derivation.
Do not record an action merely because it happened. An agreed obligation goes
in a spec; its implementation gap and next step go in a stage. A durable
explanation or measurement goes in a note, unless it is a short rationale best
kept beside the contract. Give each detailed fact a home; useful summaries and
links elsewhere are welcome. Maintain them together when their meaning changes.

Private documents follow these same roles. Visibility comes from the path, not
frontmatter. The two top-level documents remain public; do not create private
copies of them. Read [Privacy](privacy.md) before handling private information or
changing visibility, paths, or references.

## Common format and references

Use simple YAML frontmatter: scalars and inline or block lists. Start the body
with one H1 title. Use sentence-case headings, retaining the spelling of real
identifiers and proper names. Put displayed code, commands, output, and standalone
paths in fences; use inline code for a path in a sentence. Omit empty optional
fields and sections. Do not invent content just to fill a template.

Specs and notes use short kebab-case filenames. Stages use
`<protocol>-<topic>-<YYYY-MM-DD>.md`: the prefix and date record the operation
that opened the work, not its current status. For a stage created by ordinary
implementation, use `follow` as the origin (following the existing design).
Reuse its name while the same work continues; archive by moving it, not renaming
it to the latest operation or date.

A `[[stem]]` link addresses a document by its filename without `.md`. Keep stems
unique across public/private documents and archives in a unit. `after` uses the
same spec identifiers. Renaming requires updating inbound references; moving
requires checking relative Markdown links even when wiki-links remain valid.
Use ordinary relative Markdown links for navigation between units. Do not use
`covers` to link documents to each other.

## northstar.md

Draft intent from the human's input and existing authorized decisions. If intent
is incomplete, mark the open question; do not infer a binding objective from
whatever code happens to exist. Protect decisions by their substance and
authorization, here and in every other document. Wording improvements that
preserve meaning do not require renewed design approval.

Use `# Northstar` with `## Mission`, `## Success criteria`, and
`## Hard constraints` when known. During initialization an unknown section can
state the specific question; do not populate it with generic invented goals.
Constraints are actual limits, such as offline operation or a license obligation,
not an automatic inventory of directories and Git settings.

Only child units need frontmatter:

```yaml
---
parent: ../../docdoki/northstar.md
---
```

The path is relative to the child's northstar file. Children add
`## Contribution`, explaining how they serve the parent. Parents list children
under `## Units`, for example:

```md
- [Analysis](../analysis/docdoki/northstar.md) — statistical analysis unit.
```

Use the filesystem to discover units; reconcile these navigation links with it.
Do not silently change a parent's intent while setting up a child.

## spec_abstract.md

The primary human reading and steering surface, without frontmatter. It should
make four things easy to find: current design, key implemented capabilities and
gaps, active work, and decisions needing human attention.

A small example (links refer to documents in the same example library):

```md
# Spec abstract

## Design map

| Area | Contract | Design |
| :-- | :-- | :-- |
| CSV export | [[export]] | Local export; publish complete files only. |

## Current work

Atomic publication is not implemented yet; direct writes can expose partial
files. [[follow-export-2026-09-05]] holds the inspection and next actions.

## Cross-spec direction

Exports stay local. Network delivery is outside the export boundary.
```

Add review questions when there are real decisions to make. Summarize the
relevant stages and evidence, rather than inferring completion from missing
fields or copying every checklist. When work closes, retain any useful concise
capability summary and point to durable evidence if needed; remove obsolete
active-work links. Do not delete stable design facts merely because they have
stopped changing.

Human edits here can change the design. `follow` propagates them into the
concrete contracts and authorized implementation, or leaves an explicit
unresolved difference. Neither the overview nor a more detailed file silently
wins a conflict solely because of its position.

## specs/*.md

A spec records what the implementation **should satisfy under current decided
design**, whether or not it satisfies it yet. Decisions can come from the human
or from the agent acting within delegated design authority. Label an undecided
proposal as a proposal in the relevant stage or note; do not mix it into binding
claim bullets. Lack of implementation does not invalidate an agreed contract.

```md
---
purpose: Local CSV export that publishes complete output or leaves the destination unchanged.
covers:
  - src/export.py
  - tests/test_export.py
---

# CSV export

## Goal

- Successful export publishes a complete CSV file at the requested path.
- Failed export leaves an existing destination unchanged and no partial final file.
- Export does not send row data over the network.

## Checks

Exercise successful publication, row-generation failure, and replacement of an
existing destination. Check failures before publication leave it unchanged.

## Sources

The human selected local-only, failure-safe export on 2026-09-05.
Implementation work and evidence: [[follow-export-2026-09-05]].
```

In this example atomic publication has been decided but is **not implemented**.
That gap belongs in the linked stage, not in softened contract wording.

`purpose` is required: one or two sentences explaining the area and its key
obligations, not a repeat of the title or a progress report. `## Goal` is the
required section; state concrete, checkable obligations, usually as bullets.
Add `## Checks`, `## Non-goals`, `## Sources`, rationale, or domain sections when
useful. Checks describe how to assess conformance; one run's results belong in
a stage or evidence note. Keep live status, next actions, resume instructions,
and chronological logs out of spec bodies.

### Code association: covers and after

`covers` is a list of code/data globs relative to the unit root, including for
private specs. `*` matches within a path segment, `**` across directories, and
`{a,b}` denotes brace alternatives. Match the scope to the obligations: include
necessary dependencies, exclude unrelated files. Inspect actual matches when
setting it or challenging the spec. A glob is a navigation aid, not evidence.

For a decided capability with no code yet, list intended paths and say the
association is planned in `## Sources`, or use `covers: []` and explain that no
in-tree target exists yet. Empty matches never mean conformance. Once code
exists, update the association. For off-tree data, services, or environments,
use the in-tree paths available (possibly none) and describe the actual check
and access needed in prose. Do not invent a matching path or a verification.

`after` is optional and lists genuine upstream spec dependencies, for example
`after: [preprocess]`. It describes design order, not audit status. Keep it
sparse and consistent with the design map.

### Existing progress field

`progress` remains an optional, explicitly edited display marker for the
existing panel, with values `not-started`, `in-progress`, and `done`. Preserve
it; core maintenance does not infer or set it from code, tests, or stage closure.
An explicit human edit may change it through `follow`. The panel renders an
absent value as `not-started`; that default is **not evidence** of implementation
state. Use stage evidence and the overview for factual progress, not this marker
as a verification result. No field migration is needed for this distinction.

## stages/*.md

A stage is the current work record for one objective, not a transcript or a
reference store. Selection, reuse, handoff, and closure are defined together in
[Operations — Work stages](operations.md#work-stages).

```md
---
scope:
  - src/export.py
  - tests/test_export.py
---

# Failure-safe export

## Objective

Implement the agreed publication contract in [[export]].

## Current state

- Working: CSV rows are written, confirmed by reading `src/export.py`.
- Broken/Blocked: it writes directly to the destination; atomic publication is
  known unmet, not merely unchecked.
- Not checked: behavior on network filesystems; no such environment is available.
- Modified files: none in this work stream yet.

## Next actions

- [ ] Write to a sibling temporary file and publish only on success.
- [ ] Test successful replacement and row-generation failure.
```

`scope` contains unit-relative globs for touched paths and supports stage
selection; planned paths are allowed. `Current state` separates known working,
known gaps/blockers, and unverified claims. Record changed files when useful for
resumption, not as a duplicate of scope. Preserve only relevant check results
with their scope and limitations. Rewrite this state at meaningful milestones.

Add `## Decisions` for choices with reasons (including untried alternatives),
`## Dead ends` for failed approaches worth not retrying, and `## Handoff` for
explicit continuation instructions. Omit empty sections. Point reusable depth
into notes; keep active obligations visible in stages and contracts.

## notes/*.md

Notes retain methods, gotchas, research, source-grounded evidence, and useful
rationale. Add a concise `purpose` when it helps identify the contents; omit a
redundant optional field rather than pad it. Use an H1 title and sections suited
to the subject, not a fixed report template.

Give non-obvious factual claims source pointers: code and symbols, tests and
observed results, a commit, data identity, or a source URL with version/date
where relevant. Distinguish observations from hypotheses and external claims.
Record the scope and limitations needed to reuse evidence, not raw logs.

A rejected option can matter without having failed in an experiment: “Remote
conversion was not selected because rows must stay local” preserves a design
reason; “we discussed three services on Tuesday” usually does not. Notes may
explain decisions or explore proposals, but binding requirements belong in specs
and current tasks in stages. Keep the library self-contained for the knowledge
it claims to retain: link external evidence, but do not leave the only copy of a
durable lesson in an agent memory file or chat transcript.
