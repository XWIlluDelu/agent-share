# Panel model

## Purpose and authority

The optional panel helps the human understand project progress and dependencies,
inspect and edit design, and hand changes to the agent. The file library remains
useful without it. Dashboard is the default entry and opens only the card diagram;
Overview separately opens `spec_abstract.md` as a document. Both are sidebar entries,
not modes of one page. Cards still open their documents through Open. Northstar,
active work, specs, and notes remain directly reachable.

The panel renders recorded information, not new project facts. `progress` is an
agent-maintained implementation summary under [the schema](../references/schemas.md#progress-summary),
with detailed evidence and limitations in the work records. Missing progress is
Not recorded. Design contracts can remain unimplemented; changing a status does
not change their obligations. The panel does not inspect code to infer completion.

Saving edits documents, not implementation. Copy to Agent preserves the distinction
between unsaved edits to apply and saved changes to follow. The panel does not run
project commands, commit, publish, archive stages, or move public/private files.

## Source and interaction model

- The board has no global reading/editing permission switch. Card title, purpose,
  and progress support local native field editing. Selection and layout remain
  available without an editing mode. Connect is a temporary tool for adding an
  upstream → dependent relation; removal is an explicit action on a selected edge.
- Documents open as rendered Markdown. Focusing a block exposes its local Markdown
  source in an auto-sized native textarea, without formatting tools or Edit / Done /
  Cancel. Other blocks remain rendered. Switching blocks previews the previous input;
  leaving body editing stages a full-source draft, never a filesystem write. Source
  remains a document-local full-document textarea, including metadata. Navigation
  and switching to Source await application; failure retains input and stops the action.
  Changing presentation does not grant filesystem authority.
- Complete Markdown is readable, including introductions, repeated headings,
  multiline conditions, code, and tables. Source mode includes frontmatter. There
  is no heading-name or claim-index save API. A card preview transforms one bounded
  field in the captured full source: the first ATX title outside code, or a flat
  `purpose`/`progress` scalar. Other source bytes, comments, and line endings are
  preserved. Unsupported field forms remain editable through the whole source.
- Wiki/relative links resolve inside the unit; notes and archives load on demand.
  Unresolved and out-of-unit links remain explicit. Search includes titles, paths,
  and loaded text, including drafts. No notes are synthesized into spec nodes.
- The client owns one baseline map, source drafts, chronological edit history, an
  active editing session, save state, and the last successful receipt. Parsed
  documents and diagram geometry are disposable views, never another editable copy.
  A local field input is an uncommitted buffer, not a second source authority. Apply
  transforms its captured source and stages one complete-source history entry.
  Escape cancels the buffer, including a pending application. Navigation, another
  edit, Changes, Save, and Copy await application; failure keeps the buffer visible
  and stops that action. Leaving with changed field text also warns about unsaved work.
- Dependency controls send an add/remove operation on one stem. The server applies
  it to the captured source draft and validates the graph. An already-satisfied
  operation leaves the source unchanged; stale graph previews never supply a full
  replacement dependency list. Connect always adds, never toggles based on a preview.
- Pending modifying responses are bound to their originating store and source
  version. Replacing a snapshot invalidates the old store's requests. Adopting a
  latest source after explicit discard advances the version even for equal text.
  Stale responses cannot stage edits or replace the graph. Field responses also
  require the same active buffer and input generation; continuing to type or
  cancelling invalidates them. Previews and disk checks never replace an active
  field input, and a field opens from parsed canonical source, not a stale summary.

## Body editing

`body.js` maps top-level Markdown tokens to exact ranges in captured full source,
including a mapping from normalized newlines back to original offsets. Gaps must
be whitespace or recognized definitions; unprovable mappings require Source editing.
Headings are not matched by name, and repeated text never supplies a save address.

One block at a time exposes its captured Markdown, not rendered text. Headings,
paragraphs, lists, fenced code, tables and reference/wiki-link blocks use the same
native textarea. Typed Markdown remains Markdown; there are no formatting commands,
HTML serialization or literal-text escaping. Paste and undo are native textarea
operations. Definitions stay in the source without empty preview boxes; edit these
and frontmatter in Source. Reference definitions are supplied before inline lexing.
No preview fetches external images or permits document HTML.

Switching blocks retains local source buffers and renders the previous block.
Leaving body editing patches only changed ranges and stages one complete-source
history entry through the existing preview API. Untouched blocks, frontmatter,
definitions and gaps keep their bytes. Local inputs retain Markdown spelling and
use the document's newline convention; original trailing block separators are
preserved. Neither headings nor parsed output determine replacement addresses.
Native undo stays inside the focused text surface; staged body edits participate
in the shared chronological source history and Changes supports document discard.
Idle reading surfaces do not block snapshot updates. A focus/typing event activates
only a surface bound to the current source and version; stale or saving surfaces
cannot accept input. Normal links still navigate; selecting link text does not.

Body buffers block snapshot adoption and reading-DOM replacement. Pending application
requires the same buffer, store, source version and input generation. Continued
input or refocusing invalidates an older response, even without textual changes.
Blur waits for pointer dispatch so rendering cannot swallow navigation. Pointer-up
also releases the wait when replacing a pressed preview node suppresses click.
Composition is not a command; completed composition can stage input after blur;
Save, Copy and navigation await successful application. Changed local body text also
participates in the tab-close warning, even before a source draft has been staged.
There is no body-fragment write API and no whole-document HTML-to-Markdown conversion.

## Changes, synchronization, and recovery

Changes is closed initially, with only an unsaved-count badge after editing. It
contains per-document review/discard and two normal actions: Save and Copy to Agent.
Complete diffs are available on demand; an empty drawer is not a disabled console.

On focus or visibility return, check disk state. With no drafts, adopt fresh content
while preserving navigation, reading position, document presentation, and diagram layout. Do not
replace content if editing continued while the request was pending or a local
field buffer is active. With drafts,
retain their sources and preconditions, and record external differences in Changes.
There is no global Refresh command, background autosave, or realtime collaboration.

A document's complete original source is its save precondition. Save captures a
batch, locks mutations and repeat submissions, and validates the affected disk
sources before writing. Return actual stored sources as the next baseline.
Success clears the submitted drafts and retains a copyable follow receipt.

A conflict is shown with the affected edit, not in a separate comparison workflow.
Keep the original, human draft, and available external source for the agent request.
Discarding an edit reads the latest source before dropping the draft and checks that
no intervening edit occurred. If the file was deleted, explicit discard can remove
it from the client too. Never accept an old draft against a newer baseline through
an overwrite/rebase button. Complex merging belongs to the agent.

Failures retain drafts and expose recovery export. An unknown save outcome remains
explicit in the request: some writes may already have happened, so the agent must
check actual files before applying anything. Clipboard failures leave the complete
request selectable. Copy never executes a request or clears edits. Receipts survive
in-app synchronization, not page reload or tab closure. Drafts, conflicts, and
receipts stay in memory, not browser storage; warn before leaving with unsaved work.

## Write and privacy boundaries

Run locally and **pause other writers to the same files while saving**. The process
lock serializes this server's saves, not independent editors. Full-source checks
and atomic replacement reduce risks but cannot close an uncoordinated final
check-to-replace race. This coordination rule belongs in operating guidance and
the agent request, not a permanent banner interrupting normal reading.

A failed multi-file save attempts rollback. It checks for newer content and reports
incomplete restoration rather than deliberately overwriting it. This is best-effort
recovery, not a filesystem transaction, crash-durability guarantee, or unconditional
concurrency safety. Export cannot recover an external writer's bytes lost during
an uncoordinated replacement window.

Private identity comes from `docdoki/private/`, never metadata. Reads/writes stay
inside the unit's existing document paths; traversal and symlink writes are rejected.
Shared writes reject recognized private dependencies/references. These checks do
not detect arbitrary secrets or authorize publication; [core privacy rules](../references/privacy.md)
apply. Mark individual private documents quietly; label private request content and
warn at copy/export to a trusted destination.

The service binds to loopback, checks Host and write Origin, and requires its token
for data requests. Responses are non-cacheable; scripts are escaped and framing is
blocked. Document HTML is rendered as text; external images are not fetched
implicitly. This is a local owner-operated tool, not a multi-user network service.

## Implementation and operation

Delivery is one self-contained page, without a build step or runtime network assets.
`documents.py` handles source I/O and supported metadata; `graph.py` builds the
catalog and DAG; `storage.py` validates and writes; `panel.py` serves and assembles
assets. `state.js` owns drafts/history and bounded diffs; `body.js` maps and serializes
bounded body edits. `panel.js`, `panel.html`,
and `panel.css` implement the views. `favicon.svg` is embedded as a data URL in the
assembled page. Marked and its license are vendored locally.

Frontmatter supports flat scalar fields and inline/block scalar lists, including
quotes and comments. Unsupported nested mappings, aliases, and block scalars produce
diagnostics, not guesses. Such sources remain inspectable; saving needs a supported
form or an external editor. Requests are limited to 1 MiB.

From the skill directory:

```sh
python3 panel/panel.py /path/to/project --port 0 --no-open
python3 -B panel/selftest.py
node panel/selftest.mjs
node panel/selftest.mjs --browser
```

The backend uses only Python's standard library. See [Panel design](panel-design.md)
for interaction and visual requirements. Tests use temporary libraries, not real
projects. The browser option needs Playwright and a browser binary. It defaults to
Chromium; `PANEL_BROWSER=firefox` or `webkit` selects another installed engine.
`PLAYWRIGHT_MODULE` can name an absolute `index.mjs` when module resolution needs it.

Browser checks exercise the real HTTP service, DOM, editing, and saving. Each run
covers only its selected engine and scenarios. Emulated touch/composition events do
not establish real-device, operating-system IME, or assistive-technology conformance;
Playwright WebKit is not shipping Safari. Fixtures and screenshots are temporary,
not skill assets.
