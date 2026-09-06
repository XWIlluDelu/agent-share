# Panel model

## Purpose and authority

The panel is DocDoki's optional human reading and steering surface. The file
library remains useful without it. The panel helps a human understand intent,
contracts, implementation gaps, and current work, then express a change; the
agent interprets that intent and follows it through authorized work.

Presentation is not design authority. The panel computes navigation, layout,
and structural diagnostics, not new project facts. It does not inspect code to
infer completion, invent dependencies to improve a diagram, or maintain a
parallel progress ledger. Decided contracts can remain unimplemented. Progress
comes from the overview and stages; an explicit `progress` field is only a
manual planning label. A missing value means **not recorded**, not not-started.

Saving edits the documents, not their implementation. The saved-change follow
request gives the agent the affected sources and human changes; it does not
claim that propagation, verification, or stage closure has happened. The panel
does not run project commands, publish, commit, move public/private documents,
or automate the semantic work of archiving a stage.

## Reading model

- Open `spec_abstract.md` first: design, capabilities and gaps, current work, and
  decisions needing the human. If absent, use the available northstar or state
  what is missing rather than synthesize an overview.
- Keep northstar, active stages, and specs directly reachable. Spec lists and
  dependency diagrams are alternative navigation views, not the whole project.
- Cards are summaries; the reader exposes the complete Markdown body, including
  introductions, multiline claims, unknown sections, checks, and non-goals.
  Source mode exposes the entire file, including frontmatter.
- Resolve in-unit wiki and relative Markdown links. Load notes and archived
  stages on demand, with archives collapsed initially. Mark unresolved or
  out-of-unit links explicitly; do not quietly drop them.
- Show the project root, available branch, snapshot load time, and whether private
  documents are included. Search titles, paths, and loaded text, including drafts;
  disclose that unopened notes and archives are not body-indexed.

## Draft and save model

A document's complete source is the editing unit and its full original source is
its save precondition. There is no claim-index or heading-name patch API: repeated
headings, fenced examples, and multiline lists must not create ambiguous writes.
Structured dependency controls produce a source draft through the same pipeline.

The client owns one baseline map, source drafts, chronological edit operations,
an optional active editing session, an in-flight save flag, and the last successful
save receipt. Parsed documents and graph layout are disposable views of those
sources, not another editable copy. Preview uses the client's snapshot plus its
drafts; it must not mix newly read disk content with old editing baselines.

Save captures a batch and locks edits, undo, restores, and repeat submissions.
The server validates the batch and preconditions before writing, then returns
actual stored sources as the next baseline. A successful response clears the
submitted drafts, not unrelated future input. Failures retain drafts; an unknown
network outcome requires comparing disk before retrying. Refresh must not erase
edits made while its request was pending.

The Changes surface separates:

- Unsaved edits, their complete before/after sources, chronological undo, and
  per-file restore.
- An unsaved apply request, which tells the agent to check baselines before
  applying the draft.
- A saved-change follow request, backed by the last successful receipt and
  explicitly not asking the agent to apply the edits again.

Receipts survive the in-app Refresh action but not a page reload or tab closure.
Drafts and receipts stay in memory, not browser storage. Warn before leaving with
unsaved drafts and offer explicit export. Copy failures leave the complete request
selectable and must not report success.

## Write and privacy boundaries

Run locally and **pause other writers to the same files while saving**. The
process lock serializes this server's saves; it does not coordinate independent
agents or editors. Full-source comparisons, rechecks, and atomic replacement
reduce risks but cannot close the final check-to-replace race with an
uncoordinated writer.

A failed multi-file save attempts rollback. Restoration checks for newer content
and reports incomplete rollback rather than deliberately overwriting it. This is
best-effort recovery, not a transaction, crash-durability guarantee, or unconditional
concurrency safety. Export retains the panel's baseline and draft, not an external
writer's bytes lost during an uncoordinated replacement window. Compare latest
and explicitly accept a baseline only after merging the required external intent.

Private labels come from `docdoki/private/`, never editable metadata. Reads and
writes stay inside this unit's existing document paths; symlink and traversal
writes are rejected. Public writes reject recognized private dependencies and
references. These structural checks do not detect arbitrary secrets or authorize
publication; [the core privacy rules](../references/privacy.md) still apply.
Private copy/export content must be labelled and sent only to a trusted destination.

The service binds to loopback, checks Host and write Origin, and requires its
process token for data requests. Responses are non-cacheable, script data is
escaped, framing is blocked, and document HTML is rendered as text. External
images are not fetched implicitly. This is a local owner-operated tool, not a
multi-user service; do not expose it through a network proxy.

## Implementation and operation

The delivery remains one self-contained browser page with no build step or
runtime network assets. Source responsibilities are separate:

| Source | Responsibility |
| :-- | :-- |
| `documents.py` | Source-preserving reads, explicit YAML subset, document metadata, `after` patching. |
| `graph.py` | Library snapshot/catalog, structural diagnostics, linear-time DAG layering. |
| `storage.py` | Write validation, full-source preconditions, replacement and recovery. |
| `panel.py` | Local HTTP service and page assembly. |
| `state.js` | Source drafts, edit history, save state, bounded diffs. |
| `panel.js`, `panel.html`, `panel.css` | Navigation, Markdown reading, native editing, geometry and presentation. |
| `vendor/marked.js` | Bundled Markdown rendering; attribution in `vendor/marked.LICENSE`. |

Frontmatter supports a strict subset: flat scalar fields and inline or block
lists of scalars, including single/double quotes and comments. Unsupported forms
such as nested mappings, aliases, and folded/block scalars produce diagnostics,
not guessed values. Such sources remain inspectable; saving requires a supported
form or an external editor. The service accepts request bodies up to 1 MiB.

From the skill directory:

```sh
python3 panel/panel.py /path/to/project
python3 panel/panel.py /path/to/project --port 0 --no-open
```

The backend uses only Python's standard library. The visual contract is
[Panel design](panel-design.md). Lightweight checks use temporary document
libraries, never a real project as a writable fixture:

```sh
python3 -B panel/selftest.py
node panel/selftest.mjs
node panel/selftest.mjs --browser
```

The browser option needs an available Playwright package and browser binary. It
defaults to Chromium; set `PANEL_BROWSER=firefox` or `PANEL_BROWSER=webkit` to run
the same checks on another installed engine. If normal module resolution cannot
find Playwright, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path.

Browser checks exercise the actual local HTTP service, DOM, editing, and save
flow; pure Node checks are not browser evidence. Each run covers only its selected
engine and scenarios. Emulated taps and synthetic composition events do not
establish real-device touch, assistive-technology, or operating-system IME
conformance; Playwright WebKit is not shipping Safari. Fixtures and optional
screenshots are temporary, not skill assets.
