# Panel design — dell-1996

The panel is a project board, not a document-management console. Its main path is:
**see progress and dependencies → adjust a card or open a document → review and
save changes → copy the request to the agent**. [Panel model](panel-model.md)
defines the source and save invariants behind this interface.

## Layout and navigation

- A compact header contains the logo, project name, search, Changes, and language.
  No absolute root, branch, load timestamp, global privacy announcement, or second
  row of global actions. Narrow screens may wrap search.
- The sidebar has Dashboard, Overview, Northstar, Current work, then grouped spec, stage, and
  note titles. Full-width horizontal rules and lightly filled group headings separate
  navigation, specs, stages, notes, and archives. Archives are collapsed. Paths are not repeated beneath every title;
  show a muted path only to distinguish duplicate titles. The sidebar toggle is a
  panel icon inside the content bar, before its title. It never hangs between
  columns or moves into a second global toolbar. On phones, the sidebar overlays
  the workspace and has its own close control.
- Dashboard is the default entry and opens only the progress/dependency diagram.
  Overview is a separate sidebar entry opening `spec_abstract.md` as a document.
  There is no Cards / Document switch, separate Specs page or third card-list view.
- The card's explicit Open button or a sidebar entry opens the complete document,
  outside diagram scaling. Clicking or double-clicking the card itself stays on
  the board. Returning to Dashboard preserves pan, zoom, and dragged positions.
- A compact content bar identifies the current view or relative document path.
  No board/document switch appears here. Within documents, one `</>` icon
  immediately follows the path and toggles rendered body / full source. Black fill
  and `aria-pressed` indicate source view; a localized tooltip describes the next
  action. Keep the icon beside the path on narrow screens too, not right-aligned
  or on its own row. There is no workspace-wide reading/editing toggle.
  Reuse the document's Markdown H1 rather than repeating it above the content.

## Cards and editing

Cards have a white title bar, a tinted purpose block (up to three lines), and a
separated footer with Open and a compact progress label. Thin black rules make
these regions legible; status colors repeat in the label. Keep title and body
sizes compact without reducing the full document's reading size.
Missing progress says Not recorded; it is not synthesized from code or diagram
position. The agent maintains the record according to [the schema](../references/schemas.md#progress-summary).
Dependencies connect genuine upstream contracts. Notes are not extra graph nodes.

Clicking the card frame or its unused space selects it and highlights relationships;
Enter and Space on the focused card do the same. Field and Open buttons are separate
keyboard destinations. Clicking the canvas or pressing Escape clears selection.
Dragging non-field areas adjusts layout and never opens a document. Plain selection
does not summon an operation panel.

Title and purpose text have a subtle hover/focus edit affordance; progress is a
compact button. Activate a field to edit it with a native input, textarea, or
select in the card. The footer temporarily offers Apply and Cancel. Enter applies
single-line/select edits, Ctrl/Command+Enter applies a purpose, and Escape cancels
only this field. A purpose textarea keeps native newlines and scrolling. Switching
to another edit or opening Changes/a document first applies this local buffer;
if it cannot be applied, retain the input and do not navigate away. These actions
only stage drafts, never save files. Keep the focused field intact during previews.

Connect is a temporary tool, not a global edit permission. Its short in-context
hint asks for an upstream card, then a dependent card. Highlight the picked origin
without dimming possible targets. A successful pair adds a dependency; an existing
pair is a no-op, not an implicit deletion. Pick another pair or press Escape to
exit. Clicking a line selects it and exposes an explicit Remove dependency action.
Cycles and public/private violations are rejected without changing drafts.

Open the document for longer changes. It normally displays rendered Markdown.
Click, tap or keyboard-focus a block to expose that block's Markdown in place;
type `##`, `**`, lists or links directly. Touch pans and context-menu presses stay
in reading; touching down alone does not start an edit. Other blocks stay rendered. There is no rich-text
formatting toolbar and no Edit / Done / Cancel mode. The local textarea grows with
its content and width, preserving native selection, paste, multiline input and undo.
Clicking elsewhere restores the previous block's preview. Links still navigate;
selecting their text does not open them. Definitions do not produce empty boxes.

Switching between blocks carries local input; leaving body editing stages a draft,
never a file save. Ctrl/Command+Enter can also stage input outside composition.
Changes provides draft discard. Retain Markdown input when validation fails, without
converting it to HTML and back. Source remains the secondary whole-document textarea
for metadata, definitions and documents whose block ranges cannot be mapped safely.
Switching to it first applies body input; failure stops the switch rather than
losing text. Late preview completions must not move focus away from newer input
or navigation. Heading links, including encoded Unicode fragments, stay usable
after local editing. These document-only editing choices do not affect the board's tools.

Enter and paste retain native multiline behavior. IME composition is not a command.
Escape cancels the current source-edit session. Native textarea undo stays native;
the workspace undo shortcut covers completed edits. Do not replace the focused
textarea or controls during previews. Syntax/graph errors remain visible without
turning ordinary reading into a permanent explanation of the parser.

## Changes

Changes starts closed and never opens merely because typing begins. Its badge
appears only when documents have unsaved edits. Opening it does not fit or reset
the diagram. Use an overlay rather than shrinking the canvas.

Each changed document has its title, a short change summary, a folded complete
diff, and Discard changes. Diff details preserve conditions, negations, and complete
before/after sources; large changes use complete sources rather than an unbounded
diff calculation. Keep existing controls and expansion state stable during typing.

Ordinary pending work has only two bottom actions: **Save** and **Copy to Agent**.
The copy action chooses the unsaved apply request or the saved follow request;
that distinction belongs in the request, not in two competing button labels.
An empty drawer says No unsaved changes. After saving, show a short saved count
and keep Copy to Agent available. Do not fill the empty state with disabled tools.

No separate compare screen, baseline acceptance, permanent export button, or save
receipt console. Check for external changes on focus/visibility return. Clean
content updates without losing the current view or diagram layout. Existing drafts
are retained. If a changed file has newer disk content, show the problem beneath
that file in Changes; its expanded details may include the external version.
The human can copy all relevant versions to the agent, or discard that draft and
load the latest source. There is no overwrite or manual-rebase shortcut.

Saving errors retain drafts. Offer recovery export only in this error state.
Clipboard failure reveals selectable request text. Mark private documents quietly;
warn about private content at copy/export, not throughout normal reading.

## Visual language and access

The original [dell-1996.DESIGN.md](references/dell-1996.DESIGN.md) stays verbatim.
Retain black framing, white reading surfaces, flat card colors, strong sans-serif
headings, serif body text, square corners, and the restrained yellow language
button, upright rather than rotated. No gradients, soft SaaS cards, or ornamental toolbars. Progress uses the
existing sky, purple, and sage colors with a text label; unknown progress is white.

Give peer controls equal widths within their group, not widths determined by label
length. Comparable controls keep the same size across languages and active states.
Toolbar actions use the compact − / + / ▣ / ⟲ / ⇄ icons in equal-width cells;
the percentage uses a fixed, slightly wider cell. Keep action names and shortcuts
in localized tooltips and accessible labels, not visible text buttons. Active
Connect and locked zoom use inverted colors, without adding glyphs or changing
button sizes. Align Open and
progress columns across cards; local Apply / Cancel share equal units. Save / Copy
split their row equally, while a sole remaining action fills it. Keep different
roles distinct rather than making every button equally large. Labels must fit;
on narrow screens wrap groups, not individual controls into unequal widths.

Reading text is normally 17px and never scaled with the diagram. Use system CJK
fallbacks, readable code, high-contrast focus/hover states, and 16px phone inputs.
Tables and source lines may scroll internally. Paths and translated labels wrap
without covering controls. Search covers titles, paths, and loaded source drafts.

Graph navigation retains pan, drag, zoom, fit, and the minimap. A faint grid follows
pan and zoom; initial dependency columns are vertically centered. The bottom-center
toolbar has a 2px outer border, uniform 1px internal dividers, and a hard-edge
shadow; internal groups do not add thicker seams. Fit runs automatically
only for the first visible, populated board, within the normal zoom limits. Later
navigation, edits, external updates, sidebar changes, and window resizing preserve
the camera; Fit remains an explicit tool. Fit leaves room for the minimap and toolbar. The minimap includes the complete viewport frame and
keeps its coordinate system fixed during a drag. The toolbar groups zoom, fit/reset,
and Connect. The percentage toggles zoom lock with an inverted active state and
accessible label; it blocks canvas zoom/fit, not panning or browser zoom shortcuts.
Reset restores automatic card positions without editing sources or resetting the
camera. C toggles Connect and R resets layout outside text inputs.

Route connections from the side facing the other card, with a small border gap and
ordered, separated ports for siblings. This is not general obstacle avoidance.
Selected connections and their arrowheads are red; unrelated connections recede.
Arrowhead size does not grow with selection stroke width. Clicking an edge never
deletes it. Removal is always an explicit action. Dragging updates
incident and shared-port sibling geometry without rebuilding card or edge nodes.
Defer background card replacement until the gesture ends, then render the current
data at the retained positions. Other redraws preserve the focused card or control.
The canvas can shrink with a short or landscape window; keep its toolbar visible
rather than pushing it below a minimum-height canvas.

Hidden drawers and content covered by an overlay are not keyboard destinations.
Opening/closing drawers moves focus predictably; Escape closes them, with active
field/source-session cancellation taking precedence. Document navigation focuses its heading.
Preserve browser zoom shortcuts. Status feedback describes a user result or an
error and clears when no longer useful; do not keep technical disclaimers on screen.

Verify the normal journey and screenshots before counting features. Then check
keyboard and narrow-screen access, save/clipboard failure, external conflicts,
and asynchronous source preservation in real browser tests.
