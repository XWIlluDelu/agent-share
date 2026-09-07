# Panel design — dell-1996

The panel is a project board, not a document-management console. Its main path is:
**see progress and dependencies → adjust a card or open a document → review and
save changes → copy the request to the agent**. [Panel model](panel-model.md)
defines the source and save invariants behind this interface.

## Layout and navigation

- A compact header contains the logo, project name, search, Changes, and language.
  No absolute root, branch, load timestamp, global privacy announcement, or second
  row of global actions. Narrow screens may wrap search.
- The sidebar has Dashboard, Current work, Northstar, Overview, then grouped spec, stage, and
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
  No board/document switch appears here. The document path supports click or
  Enter/Space to copy, without intercepting text selection. Confirm success only
  after clipboard completion; failure offers manual copying, and late results
  cannot label another document. Within documents, one `</>` icon
  immediately follows the path and toggles rendered body / full source. Black fill
  and `aria-pressed` indicate source view; a localized tooltip describes the next
  action. Keep the icon beside the path on narrow screens too, not right-aligned
  or on its own row. There is no workspace-wide reading/editing toggle.
  Reuse the document's Markdown H1 rather than repeating it above the content.
  The content bar stays visible while reading; anchor targets scroll clear of it.

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

Title and purpose edit in place with native text fields matching their display
font, position, padding and card tint. No inset box, blue outline or Apply/Cancel
footer appears. Editing a field does not select/dim the graph as a side effect.
Leaving a field stages its input; Enter also stages a title, Ctrl/Command+Enter a
purpose, and choosing a progress value applies it. Escape cancels this field.
The purpose supports native newlines, selection and scrolling. Retain Open and the
progress column in their normal positions. One click can switch fields or open a
document; wait for application without stealing the destination's focus. Failure
keeps input and stops navigation. These actions stage drafts, never save files.

Connect is a temporary tool, not a global edit permission. Its short in-context
hint asks for an upstream card, then a dependent card. Highlight the picked origin
without dimming possible targets. A successful pair adds a dependency; an existing
pair is a no-op, not an implicit deletion. Pick another pair or press Escape to
exit. Clicking a line selects it and exposes an explicit Remove dependency action.
Cycles and public/private violations are rejected without changing drafts.

Open the document for longer changes. Reading and writing share a continuous
Typora-like live Markdown surface: click text to place the caret, keep headings
and inline emphasis styled, and reveal nearby syntax only where it helps editing.
There are no per-block inputs, borders or font changes. Select, replace and undo
across paragraphs. Lists continue naturally on Enter; task checkboxes toggle in
place. Ctrl/Command+B, I and backtick wrap or unwrap selected Markdown for bold,
emphasis and inline code, with normal undo. Tables keep aligned cells while typing,
without switching the entire table to a code block. Keep ordinary
Markdown spelling available; this is not a general-purpose rich-text toolbar.
Touch selection, scrolling and context menus use the editor's native behavior.

The source icon changes only presentation: reveal complete Markdown and metadata
in the same centered content column, with soft wrapping and quiet syntax color.
Preserve the editor, selection, undo history and corresponding visible content;
never jump to the start or stretch into a full-width console. Layout heights may
change, so restore a source anchor rather than an identical scroll offset.

The document ends at its actual text, with only a small caret/append inset: do not
pad the editor into a tall blank page or impose a minimum document height. Related
documents are panel navigation, not Markdown. Place them outside the article in a
compact, lightly filled, bordered auxiliary region with a navigation label. Keep
this boundary clear in both live and Source presentation, including short documents
and narrow screens; never hide or rewrite real trailing source lines to tighten it.

Leaving editing stages a draft, never a file save. Ctrl/Command+Enter also stages;
Ctrl/Command+S requests Save. Escape can cancel the current full-source session.
IME composition is not a command. Changes provides document discard. Navigation,
Copy, Save and switching presentation await application; failures keep input and
stop the action. Late completions must not replace text or move newer focus.
Heading links, including repeated titles and encoded Unicode fragments, and normal
links remain usable after edits. Selecting a link's text does not navigate.
Native editor undo/redo remains local; workspace undo covers staged edits. Keep
syntax/graph errors visible without turning reading into a parser console.

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
button, upright rather than rotated. A black-outlined red pixel heart with stepped
shading and a small highlight is the tab icon, embedded without network assets.
No gradients, soft SaaS cards, or ornamental toolbars. Progress uses the
existing sky, purple, and sage colors with a text label; unknown progress is white.

Give peer controls equal widths within their group, not widths determined by label
length. Comparable controls keep the same size across languages and active states.
Toolbar actions use the compact − / + / ▣ / ⟲ / ⇄ icons in equal-width cells;
the percentage uses a fixed, slightly wider cell. Keep action names and shortcuts
in localized tooltips and accessible labels, not visible text buttons. Active
Connect and locked zoom use inverted colors, without adding glyphs or changing
button sizes. Align Open and
progress columns across cards, including during field editing. Save / Copy
split their row equally, while a sole remaining action fills it. Keep different
roles distinct rather than making every button equally large. Labels must fit;
on narrow screens wrap groups, not individual controls into unequal widths.

Reading text is normally 17px and never scaled with the diagram. Use system CJK
fallbacks, readable code, and 16px phone inputs. Editing text needs a clear caret,
not a focus box. Keyboard-operated controls retain a restrained black focus outline;
removing blue boxes must not make keyboard navigation invisible. Retro styling
belongs to the visual shell, not to modal or discontinuous editing mechanics.
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
