# Document Schemas

Paths below belong to a **project unit** (`<unit>/docdoki/`), not the installed skill directory.

## Layout and authoritative homes

```text
<unit>/docdoki/
  northstar.md
  overview.md
  specs/<name>.md
  work/<slug>.md
  work/archive/<YYYY-MM-DD>-<slug>.md
  notes/<topic>.md
  private/                    # gitignored local overlay, when needed
    specs/<name>.md
    work/<slug>.md
    work/archive/<YYYY-MM-DD>-<slug>.md
    notes/<topic>.md
```

*(Legacy libraries using `spec_abstract.md` and `stages/` remain readable by `validate.py` and the Panel; use `overview.md` and `work/` for new libraries.)*

| Document | Authoritative for | Do not duplicate here |
| :--- | :--- | :--- |
| `northstar.md` | Mission, success criteria, hard constraints, parent/child units. | Detailed module design or live task status. |
| `overview.md` | System architecture, area narrative, and `## Open decisions`. | Manual per-spec summary tables or active work checklists. |
| `specs/<name>.md` | Module obligations (`## Goal`), checks, `purpose`, `area`, `status`, `progress`, `after`, `covers`. | Live task checklists, run logs, or implementation diaries. |
| `work/<slug>.md` | Active work streams (`specs`, `scope`, current gaps, check results, next actions, handoffs). | Permanent contracts or long-term reference knowledge. |
| `notes/<topic>.md` | Reusable methods, gotchas, research, rejected options, durable evidence (`relates`, `covers`). | Binding requirements or active task tracking. |

Visibility is determined solely by path (`docdoki/private/`), never by a metadata field. `northstar.md` and `overview.md` stay public.

## Common format and links

- **Frontmatter:** Simple top-level YAML keys supporting scalars, block/folded scalars (`>`, `>-`, `|`, `|-`), and inline or block lists. Omit empty optional fields and sections.
- **Body:** One H1 title, sentence-case headings, fenced code/commands/paths, inline code for paths in prose.
- **Filenames & stems:** Short kebab-case (`specs/export.md`, `work/atomic-export.md`, `notes/fs-gotchas.md`). Keep document stems unique across public, private, and archive folders within a unit.
- **Links:** Use `[[stem]]` (or `[[stem#Heading]]`, `[[stem|label]]`) within a unit, and ordinary relative Markdown links between units. Do not use `covers` to link documents to each other.

## `northstar.md`

Captures slow-changing project intent from human input and authorized decisions. Use `# Northstar` with `## Mission`, `## Success criteria`, and `## Hard constraints`. State explicit questions if intent is incomplete rather than inventing generic goals.

Child units add frontmatter and `## Contribution`:

```yaml
---
parent: ../../docdoki/northstar.md
---
```

Parent units list children under `## Units`:

```md
- [Analysis](../analysis/docdoki/northstar.md) — statistical analysis unit.
```

## `overview.md`

The human's architecture and steering entrypoint (no frontmatter). Keep it high-density and concise:

```md
# Project overview

## Architecture

Rows flow from local input readers through [[validation]] into [[export]].
All processing stays local; network delivery is out of scope.

## Areas

- **IO:** [[export]], [[validation]] — local CSV parsing, validation, and atomic publication.

## Open decisions

- Decide whether network filesystems must be supported for atomic publication.
```

- `## Architecture` and `## Areas` explain how subsystems fit together at a higher level than individual specs.
- `## Open decisions` is the **single human steering queue** for consequential tradeoffs, unresolved questions, and proposed specs needing review.
- Do not copy every spec's `purpose` table or active work checklists into `overview.md`. For a generated flat spec table in Markdown, run `validate.py --index` or open the Panel.
- Human edits to `overview.md` can change design direction; reconcile them into concrete specs and authorized code.

## `specs/<name>.md`

Records what the implementation **should satisfy**, whether implemented yet or not.

```md
---
purpose: >-
  Local CSV export that publishes complete output or leaves an existing
  destination unchanged on failure.
area: IO
status: decided
progress: in-progress
after: [validation]
covers:
  - src/export.py
  - tests/test_export.py
---

# CSV export

## Goal

- Successful export publishes a complete CSV file at the requested path.
- Failed export leaves an existing destination unchanged with no partial file.
- Export never transmits row data over the network.

## Checks

Exercise successful publication, row-generation failure, and replacement of an
existing destination.

## Sources

Human selected local-only, failure-safe export on 2026-09-05.
Active work: [[atomic-export]].
```

Frontmatter fields:
- `purpose` *(required)*: 1–2 sentences summarizing scope and core obligations (used on board cards).
- `area` *(optional)*: Short grouping label (e.g., `Core`, `IO`, `UI`) for board organization when specs are orthogonal.
- `status` *(optional, default `decided`)*: `decided` (binding contract) or `proposed` (draft design awaiting human review; surfaced in the Panel and not implemented as binding until decided).
- `progress` *(optional)*: Concise execution summary maintained from evidence: `not-started`, `in-progress`, `blocked`, or `done`. Omit if unknown.
- `after` *(optional)*: Genuine upstream spec stems (`after: [validation]`). Keep sparse and acyclic.
- `covers` *(recommended)*: Unit-relative code/data globs (`*`, `**`, `{a,b}`). Use planned paths (noted in `## Sources`) or `covers: []` before code exists.

## `work/<slug>.md`

Active work record for one objective, rewritten in place at meaningful milestones rather than appended as a diary. Use a stable descriptive slug (e.g., `work/atomic-export.md`); add a date prefix only when archiving (`work/archive/2026-09-05-atomic-export.md`).

```md
---
specs: [export]
scope:
  - src/export.py
  - tests/test_export.py
status: active
---

# Atomic export

## Objective

Implement failure-safe publication required by [[export]].

## Current state

- Working: CSV rows are written (`src/export.py`).
- Broken/Blocked: writes directly to destination; atomic replacement unmet.
- Not checked: network filesystem rename semantics.

## Next actions

- [ ] Write to a sibling temp file and `os.replace` on success.
- [ ] Add failure and overwrite tests in `tests/test_export.py`.
```

Frontmatter fields:
- `specs` *(recommended)*: Spec stems this work stream advances (links work directly to specs on the board and in `--for` lookup).
- `scope` *(recommended)*: Unit-relative globs for touched/planned files.
- `status` *(optional, default `active`)*: `active`, `blocked`, or `ready-for-review`.

Optional sections (omit when empty): `## Decisions`, `## Dead ends`, `## Handoff`.

## `notes/<topic>.md`

Retains durable methods, gotchas, research, verification evidence, and rejected-option rationale.

```md
---
purpose: POSIX and network-FS atomic rename constraints for local export.
relates: [export]
covers:
  - src/export.py
---

# Filesystem rename gotchas

`os.replace` is atomic within one local filesystem; cross-device temp paths fail
with `EXDEV`, so temp files must be created as siblings of the destination.
```

Frontmatter fields (all optional): `purpose`, `relates` (relevant document stems), `covers` (relevant code/data globs). Include source pointers (file/symbol, test command and observed scope, commit, or URL) for non-obvious claims, and separate observations from hypotheses.
