# Panel design — dell-1996

The panel is a local document reader and editor, not a generic project-management
application. [Panel model](panel-model.md) defines its information and write
boundaries. This contract defines the human-facing interaction and visual language.

The source style is [dell-1996.DESIGN.md](references/dell-1996.DESIGN.md), retained
verbatim. Adapt its black frame, flat ribbon cards, heavy sans-serif headings,
serif body, hard edges, and restrained sticker accents to readable documents.
Do not copy the era's small text, inaccessible controls, or fixed-width layout.

## Visual language

- Black page frame and banners, white reading surfaces, square corners, hard
  borders. Use hard offset shadows sparingly; no gradients or soft SaaS cards.
- Display: Arial Black/Helvetica at heavy weight. UI: Helvetica/Arial with system
  CJK sans fallbacks. Body: Times/Times New Roman with CJK serif fallbacks. Code
  and source: Courier/system monospace. No remote fonts.
- Reading text stays unscaled at a comfortable size, normally 17px; controls and
  metadata may be smaller without making essential content depend on them.
- Dell Red `#e91d2a` marks the heart, pending edits, selected dependencies, and
  errors. Dell Yellow `#fcc20f` marks hover, search hits, and the EN/中 sticker.
  Links use Mosaic blue `#0000ee`.
- Explicit manual planning labels may use the original catalog tints: lime
  `#c0d4a7` for `done`, periwinkle `#8c9ae0` for `in-progress`, steel `#a5b8c0`
  for `not-started`. Missing labels use white and say “not recorded.” Always
  pair a tint with its manual-plan wording; it is not implementation evidence.
- Private documents carry a compact black Private/私有 label beside their title
  and source path. Pending drafts have a distinct label or red hard shadow.

## Workspace

The banner identifies the project and snapshot, offers search and language
selection, and keeps Documents, Refresh, and Changes accessible. The Changes
count remains visible when its drawer is closed. On wide windows the first new
draft opens Changes without fitting or resetting the diagram. At overlay widths,
keep typing unobscured and mark the count instead; opening the drawer is explicit.

The document navigation offers Overview, Northstar, Current work, and Specs.
The default main view reads the overview. Current work links to complete active
stage records, including private stages. Specs can be read as a list or diagram.
Notes remain navigable without becoming graph nodes; archives start collapsed.

A document view has an explicit source path and Read / Edit source / Compare
latest actions. Reuse a leading Markdown H1 as the reading title rather than
printing it twice; keep its inline content and anchors. Source mode has its own
visible title. Preview activity is a compact source-bar indicator, not a large
persistent banner. The reader shows complete body content, real tables and lists,
fenced code, and navigable links. Raw HTML is shown literally and external images
are references rather than implicit requests. Unresolved links remain visible
with their targets; related-document links are navigation aids, not inferred facts.

## Editing and changes

Read mode is not editable. Edit source opens a native multiline textarea for the
whole document, including frontmatter. The editor is outside the scaled graph
and must retain its DOM, caret, selection, and focus during draft previews.

- Enter inserts a newline; typing and paste use native text behavior.
- Composition events and `isComposing` prevent IME confirmation keys from being
  mistaken for commands. An editing-session Escape restores its start value,
  not the original disk value or an earlier committed draft.
- Blur or Read closes the editing session. A dedicated Undo last edit action
  traverses operations chronologically across files; native textarea undo remains
  native while typing. Restore file is a separate, explicitly named action.
- Save visibly locks editing and repeat submission until its response. Failure
  or timeout leaves drafts available; success preserves a copyable follow receipt.
- Compare latest shows disk text without replacing the draft. Accepting it as
  the baseline is explicit and follows the human's merge, not an automatic
  conflict resolution.

The Changes drawer groups pending work by source file. A folded line diff marks
removed/added text and useful word-level changes, and always exposes complete
before/after sources. Bound the diff calculation and cache unchanged results;
large changes fall back to complete source views with an explicit budget notice.
Never truncate the only copy of a condition or negation. Preserve unchanged
controls and expanded source views while previewing; ending an edit must not
replace the Restore button under the pointer. Undo, restore, and cancellation
report the resulting unsaved state, not an obsolete staged-change message.

Copy apply request and Copy saved-change follow request are distinct actions.
The saved receipt names affected files and retains their changes; it does not
claim implementation alignment. Clipboard failure leaves selectable request text
and an error. Invalidate displayed request text when edits, saves, or refreshes
make that capture stale; delayed clipboard results must not resurrect it.
Private copy/export content has a visible warning. Unsaved navigation
away warns, and export is available without browser-storage persistence.

## Dependency view

The diagram presents only recorded `after` dependencies: A → B means A's stem is
in B's `after`. Specs without dependencies need no invented edges. Directed acyclic
graph layering is recomputed from the current draft graph. Unknown targets,
duplicate stems/edges, self-dependencies, invalid types, private-boundary violations,
and cycles produce visible diagnostics rather than disappearing silently.

Cards show the H1 title, a short purpose summary, the manual planning label, and
Read full. Opening a card goes to the unscaled document reader, not an expanding
miniature contract inside the diagram. Cards are keyboard reachable; Enter/Space
opens the focused card. `/` focuses search. Search uses current draft content;
matching diagram cards are highlighted and nonmatches dimmed.

Dragging non-control card surfaces changes runtime layout only. Update the moved
card's transform, its minimap rectangle, and incident edges inside animation
frames; do not rebuild all cards or editors per pointer event. Reset clears drag
offsets. Edges route geometrically between facing sides, not through a semantic or
obstacle-routing engine. Selection highlights related cards and edges.

An edge click opens its description; it does not delete it. An explicit Remove
dependency action stages removal. The document's advanced dependency control can
add a genuine upstream spec; both actions validate structure before producing a
source draft. Ordinary source edits receive diagnostics and save-time validation.
There is no implicit connect mode competing with text editing.

Pan with the canvas, wheel/trackpad, or minimap. Use Shift-wheel horizontally;
Ctrl/Meta/Alt-wheel zooms about the pointer. Toolbar ± and keyboard +/− zoom,
0 fits, and the zoom readout locks/unlocks zoom. Fit is explicit; opening a drawer
or resizing must not shrink reading text or reset the chosen view. The minimap
uses card bounds, marks the viewport in red, and supports click/drag panning.

## Responsive and accessible behavior

Wide windows can show navigation, reading content, and Changes together. At
medium widths Changes becomes an overlay rather than squeezing the reader. On
narrow screens both side surfaces are drawers, with ordinary controls opening
one at a time. Drawer bounds follow the actual banner/footer sizes, not fixed
assumptions about language or line wrapping.

Explicit drawer opening focuses a control inside it. Escape or its close button
returns focus to the opener; source-edit Escape cancels the edit first. Hidden
panels and reading content covered by an overlay are not keyboard destinations.
Navigation focuses the destination heading. Search can expose the document list
without stealing input focus. Preserve browser-level zoom shortcuts.

Search, drawer toggles, and close controls must remain visibly usable at 1024px
and narrow phone widths. Check their actual bounds: a clipped zero-width drawer
can pass a superficial “no page overflow” test. Keep document reading outside
zoom transforms and permit internal scrolling for tables and source lines.

Use native buttons, inputs, textarea, and scrollbars. Preserve visible keyboard
focus and a live status region for success, errors, and uncertainty. Provide CJK
font fallbacks, readable touch targets, and 16px phone form text to avoid implicit
input zoom. Keep focus and hover contrast on black and accent surfaces. Do not
reannounce identical status text on every keystroke. Localize UI labels without altering
source text. Long paths and translated labels may wrap; they must not cover or
hide other controls. Browser tests complement, not replace, visual inspection and
real-device/accessibility checks.
