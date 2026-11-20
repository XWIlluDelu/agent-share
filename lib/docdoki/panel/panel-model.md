# Panel Model

## Purpose and authority

The optional Panel is a local **project steering board** and lightweight source editor for a DocDoki library. The file library remains fully usable without it.

- **Dashboard** is the default view: a Project Pulse strip (Northstar mission, Open Decisions / Proposals / Blockers queue, and progress stats) above the spec board (**Areas** grouping by default when dependencies are sparse, or **Dependency DAG** toggle).
- **Active work** displays rich work cards (objective, linked specs, current state, status, and task progress) from `work/` (and legacy `stages/`).
- **Northstar** and **Overview** (`overview.md`, or legacy `spec_abstract.md`) remain directly accessible from the sidebar, along with grouped `Specs`, `Active work`, `Notes`, collapsed `Archive`, and linked parent/child **Units** from `northstar.md`.
- **+ New** creates a new `spec`, `work`, or `note` (public or private) from canonical schema templates with stem-uniqueness and path validation.

The panel renders recorded information, never inferring completion from code. Saving edits documents on disk; **Copy to Agent** generates compact, deduplicated unified diffs plus an optional human steering note for the agent to follow.

## Source, editing, and handoff model

- **Single shared core:** Frontmatter parsing (including YAML folded/block scalars `>-`/`|-`), lossless card/dependency patching, link resolution, and privacy checks live in `scripts/docdoki_lib.py`, shared with `scripts/validate.py`.
- **Rendered reading + plain-Markdown source editing:** Documents render safely offline via vendored `marked.js` (raw HTML escaped, images rendered as text without network fetch, `[[stem]]` and relative links resolved, unit links supported). Clicking `</> Edit` (or pressing `e`) switches to a full-source `<textarea>` in the same centered column, preserving exact line endings, comments, and frontmatter. `Ctrl/Cmd+S` saves; `Esc` returns to rendered preview while retaining staged drafts.
- **Inline card editing:** Card title, purpose, progress (`not-started | in-progress | blocked | done`), and authority status (`decided | proposed`) edit directly on the board and stage full-source drafts through `/transform`.
- **Full-library search and backlinks:** `/search` searches all documents in the unit (including unopened `notes/` and unsaved drafts). Server-computed `backlinks` show every referencing document, including unopened notes and work items.
- **Deduplicated unified-diff handoff:** `DraftStore` tracks one net saved delta per file per tab (initial session baseline → latest saved state) alongside current unsaved drafts. **Copy to Agent** emits compact unified diff hunks plus any optional steering note—never repeating full file contents per intermediate save.
- **Optimistic save & privacy boundaries:** Saves verify full-source disk preconditions under `WRITE_LOCK`, validate graph and public/private boundaries, write atomically, and attempt best-effort rollback without overwriting newer external writes. Pause other writers to the same files while saving.

## Implementation and checks

Backend uses Python's standard library only; frontend uses vendored `marked.js` with zero build step and zero runtime network calls.

| File | Responsibility |
| :--- | :--- |
| `scripts/docdoki_lib.py` | Shared frontmatter parser/patcher, privacy checker, link/glob utilities. |
| `panel/graph.py` | Catalog, steering summaries (Pulse, Open Decisions, Active Work), backlinks, and search. |
| `panel/storage.py` | Optimistic save, rollback, `/transform` card/dependency patching, and `/create`. |
| `panel/panel.py` | Local HTTP server, multi-unit allowlist (`?unit=`), CSP/token security, single-page assembly. |
| `panel/state.js` | `DraftStore`, deduplicated session deltas, bounded LCS & unified diff generator. |
| `panel/board.js` | Project Pulse, Open Decisions, Area board, DAG canvas/minimap/Connect, inline card edits, Active Work cards. |
| `panel/changes.js` | Review drawer, steering note, unified-diff handoff, save, discard, and disk sync. |
| `panel/panel.js` | Navigation, safe `marked.js` rendering, source editor, full-library search, creation modal, localization. |

### Launching and verification

Launch directly without copying files into the project:

```sh
python3 /path/to/docdoki/panel/panel.py /path/to/unit
```

Run tests from the skill directory:

```sh
python3 -B scripts/selftest.py
python3 -B panel/selftest.py
node panel/selftest.mjs
node panel/selftest.mjs --browser
```
