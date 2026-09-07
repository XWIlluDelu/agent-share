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
- Documents open in one continuous, source-backed live Markdown editor. Headings,
  emphasis, lists and tables retain their layout during input; nearby syntax is
  revealed where useful. Source uses the same editor, paper width, selection and
  undo history, with all Markdown and frontmatter visible. There are no per-block
  textareas or editing-mode buttons. Leaving editing stages a full-source draft,
  never a filesystem write. Navigation and presentation changes await application;
  failure retains input and stops the action. Presentation grants no write authority.
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
  A local field input is an uncommitted buffer, not a second source authority.
  Blur, Enter (Ctrl/Command+Enter for purpose) or choosing progress transforms its
  captured source and stages one complete-source history entry. No confirmation
  footer is needed. Escape cancels the buffer, including a pending application.
  Navigation, another
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

## Document editing

`body.js` wraps a vendored CodeMirror editor. Its document is Markdown source;
Lezer syntax ranges drive disposable layout decorations, not save addresses.
CodeMirror owns selection, composition, paste, cross-paragraph editing and local
undo/redo. Its contenteditable DOM is an input mechanism, not an HTML document to
serialize. There is no HTML-to-Markdown conversion or fragment write API.

Each text transaction maps normalized editor offsets back to the captured raw
source and patches only its changed ranges. Untouched text, comments, metadata,
definitions, gaps and mixed line endings retain their bytes. Inserted newlines use
the document convention. Full source remains accessible for syntax without a
special visual treatment. Raw HTML stays text and images are not fetched.

Live presentation hides frontmatter and protects it from body select-all/deletion;
Source reveals it. Markdown markers remain ordinary source even when decorated or
hidden. Tables use editable, aligned cell spans over source ranges, not serialized
HTML tables. Heading anchors, wiki/relative/reference links and source selection
remain usable. Link text selection is not navigation.

Presentation changes retain the same editor and local history, using a source
position to restore the visible content after layout settles. A newer edit or
selection invalidates a pending position restoration. Source is softly wrapped in
the same centered paper, not a full-width boxed console. A clean snapshot adoption
can rebuild the editor; preserve reading position, but do not carry undo across
adoption or discard. Staged edits also join the workspace's chronological history.

A focused session holds captured source, DraftStore identity/version and input
generation. Active buffers block snapshot adoption and DOM replacement. Application
validates the complete proposed source through `/preview`; only a response for the
same session, store, version and generation can stage it. Typing or refocusing
invalidates older responses, including refocus without text changes. Stale/saving
surfaces cannot accept transactions. Blur waits for pointer dispatch; Save, Copy,
navigation and presentation changes await application without stealing newer focus.
Composition is not a command. Local dirty text participates in the badge and
unload warning before staging. Validation failures retain input, never silently
switch presentation, save or discard it.

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
assets. `state.js` owns staged drafts/history and bounded diffs; `body.js` owns the live
source editor, exact text-transaction mapping and display decorations. `panel.js`, `panel.html`,
and `panel.css` implement the views. `favicon.svg` is embedded as a data URL in the
assembled page. Marked and CodeMirror/Lezer are vendored with their licenses;
[vendor maintenance](vendor/README.md) describes rebuilding the offline editor bundle.

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
