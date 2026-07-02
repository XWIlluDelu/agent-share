# Panel design — dell-1996

The panel (`panel/panel.py`) is a product surface. This is the design contract its
renderer must satisfy, so the look stays coherent as the renderer evolves. Pure
hand-written CSS + vanilla JS, one self-contained offline page served by a small local
tool, no external fonts or libraries.

The chosen visual language is **dell-1996**: a catalog-era reinterpretation of
Dell.com's 1996 home page. The source spec is cold-backed at
`design/dell-1996.DESIGN.md` (verbatim, from `npx getdesign@latest add dell-1996`);
this file is the active contract that adapts it to a dense, editable canvas, where
legibility and density take precedence over literal fidelity. A black page frame,
flat color-block "ribbon cards", Arial Black display over Times Roman body, hard
borders, zero radius, and GIF-sticker chrome.

## Principles

- The black page frame is the strongest depth cue; everything lives inside it.
- Ribbon cards carry the work: a white title bar over a status-tinted body block.
- Hierarchy from typeface and weight contrast — Arial Black for display-scale
  (brand, document titles, dispatch header, toolbar symbols), Helvetica Bold for
  ribbon-card titles and UI/eyebrows, Times Roman for body — not from soft shadows
  (there are none; depth is borders, frames, and hard offset "sticker" shadows).
- Saturated color earns its place: one tint per status, the red reserved for the
  brand heart, the pending-edit shadow, and a lit dependency edge, the yellow for hover, the EN/中 toggle,
  the dispatch badge, and search hits. The selected state inverts to black (the menu's
  current item, the active rail tab).
- View ≠ authority: write-back writes a panel edit straight to the document file; the
  copy-prompt fallback emits intent for `follow`. The panel does no semantics —
  propagation and alignment are `follow`'s job, never the panel's.

## Tokens (current values)

- Frame & surface: page frame + banners `#000`, canvas `#fff`, faint 34px table grid.
- Brand color: Dell Red `#e91d2a` (alarm/CTA), Dell Yellow `#fcc20f` (stickers/active
  tab), Mosaic link `#0000ee`. (Dell Purple `#6a26a4` is spec-restricted to the
  BUY-a-DELL sticker stripe, which this panel does not render, so it is unused.)
- Ribbon-card tints — three of the spec's eight catalog colors, one per status, all
  with legible pure-black text: done `#c0d4a7` (lime) · in-progress `#8c9ae0`
  (periwinkle) · not-started `#a5b8c0` (steel). The palette is closed by design.
- Type (system fonts only): display `"Arial Black",Helvetica,…` weight 900;
  ribbon-card title + UI/eyebrow/button `Helvetica,Arial,…` 700, uppercase, +.04em;
  body `"Times New Roman",Times,…,"Noto Serif CJK SC","Songti SC",serif` 14px/1.4,
  pure `#000` ink (no warm-near-black softening); code/prompt `"Courier New",monospace`.
  CJK falls back to a serif/sans CJK face.
- Spacing 4px base (2/4/6/8/10/12/16/20/24/32/40/48). Radius: 0 everywhere; only
  round seals (unused) would take 9999px.
- Borders/elevation: hairline 1px, card 2px solid `#000`, page frame 8px solid
  `#000`. Hard offset shadows only: hover `3px 3px 0 rgba(0,0,0,.3)`, selected
  `5px 5px 0 #000`, pending edit `5px 5px 0 var(--red)`, stickers `2px 2px 0 #000`.

## Components

- Ribbon card (the canvas holds one kind — a spec, so no kind eyebrow): `border:2px solid
  #000`, 0 radius; white title bar (an editable Helvetica Bold heading-3 title — the
  card's display title is the spec's `# H1`, not its filename) over a progress-tinted
  Times body; a footer row holds the expand toggle on the left and the progress status
  on the right as matching footer cells: natural width, same padding and height, no
  independent sticker border; Expand has a `2px` right divider, status has a `2px` left
  divider, matching the card border weight, and uses the progress tint. Selection shows a `5px 5px 0 #000` offset shadow, a
  pending edit a red one. The title itself is the only editable title surface and
  shrinks to its text width; the remaining title bar stays a select/drag surface.
- Banner: black bar, Arial Black brand (a red ♥ between Doc and Doki), the search box
  centered, and the EN/中 toggle in Dell Yellow.
- Canvas chrome: a black-bordered hard-shadow floating toolbar — zoom −/+, a
  clickable zoom readout (click to lock/unlock the current zoom), fit, reset of the
  runtime drag layout, and a connect-mode toggle.
- Minimap: a black-bordered hard-shadow box top-right of the canvas — every spec as a
  status-tinted rect, a red rectangle marking the current viewport; click or drag to pan.
  Its scale comes from the spec-card bounds, not from the artificial canvas size, so the
  project stays centered in the minimap while the viewport frame moves and clips
  symmetrically when panned beyond it.
- Documents rail: a persistent left column with three tabs (Northstar / Abstract / Active
  stages; the active tab inverted black, like the menu's current item) over the document
  title with a clear `10px` gap before the section stack. Sections are `## section`
  blocks — a Helvetica caps header bar over an editable Times body; a pending edit shows
  a red offset shadow. Active stages list one such block-stack each.
- Dispatch panel: black header + yellow count badge; change cards as mini ribbons. Each
  card carries a field-label sticker tag (content / claim / title / progress / after /
  section …), the spec or document name (plus the section name or claim index when the
  field has one), and the change itself: single-line fields as an inline `old → new` (old
  struck, new bold), multi-line sections as a folded line diff — a removed line struck
  under a red `−`, an added line bold under `+`, a line edited in place shown under `~`
  with only the changed words marked (struck-red / bold), unchanged runs collapsed to `⋯`.
  Prompt in a Courier black-bordered surface; black-fill primary button (red on hover),
  bordered ghost buttons; a rotated ✎ sticker empty state.

## Interactions

- Pan: drag empty canvas, or plain wheel / trackpad (Shift = horizontal). Zoom:
  ⌘/Ctrl/Alt + wheel (to cursor), toolbar ±, or `+`/`-`; `0` fits; clicking the zoom
  readout locks the current zoom (−/+, wheel, `0` all disabled while locked; panning
  and the minimap stay live).
- Documents: the left rail is always open; its tabs switch Northstar / Abstract / Active
  stages.
- Minimap: click or drag inside it to recenter the canvas on that point.
- Keyboard: `/` focuses search; `Esc` cancels an edit, clears search, closes the
  menu, exits connect mode, or deselects; ⌘/Ctrl+Z undoes the last change.
- Connections: edges derive from each spec's `after` list and are rendered as directed
  arrows: A→B means A's stem is in B's `after`. The router recalculates after every
  layout/drag change from geometry only. Card-center direction chooses the facing side
  pair, with a horizontal bias for left-to-right pipelines; same-row edges keep the
  center port and stay straight when unobstructed; sibling edges on the same side fan
  out in far-endpoint order with edge-id tie-breaks. It is deliberately not an obstacle
  router. There is no render-index jitter and no sticky routing cache. Toggle connect mode with the `⇄` button or `c`;
  the stage cursor and a yellow hover tell you it's active. In connect mode, click card A then card B to toggle
  the A→B edge — connect if absent, disconnect if present; the first pick glows yellow,
  the second commits. Outside connect mode, click an edge to disconnect. All connect/disconnect
  changes record as `after` edits and land in the frontmatter on save — never silently.
  Do not model undirected edges by writing reciprocal `after` entries: that creates
  false dependency cycles.
- Cards: click selects (lights its links, dims the rest); click empty deselects.
  Drag a card by its title bar — runtime-only displacement atop the auto layout,
  never persisted; `r` or the reset button clears it.
- Editing: the title is plain text by default (no persistent input chrome); click the title
  text to enter edit mode — the editable box spans only the text, so the rest of the
  title bar stays a select/drag surface. Enter or blur commits, Esc restores and exits;
  the box and its focus outline exist only while editing. The body, claims, `after`/`covers`,
  and rail sections edit in place; single-line fields (purpose, title, claim, `after`,
  `covers`) commit on Enter and stay one line, while rail sections keep newlines; paste
  is coerced to plain text (newlines kept only for sections). In connect mode canvas
  text editing is suspended (card contenteditable absorbs no events). On save, title
  writes to the spec's `# H1`, content to `purpose`, claims to `## Goal` bullets, and
  `after`/`covers` to frontmatter.
- Progress: click the right footer status cell for a popover of progress states; no
  explicit dropdown glyph is shown. Clicking the same status cell again closes the
  popover (it toggles). The change is recorded and, on save, written to `progress` in
  the frontmatter.
- Search: filters the spec cards — matches keep a yellow outline, the rest dim.
- Feedback: each edit and progress change lands in the dispatch panel and as toasts.
  «写回文件» writes them straight to the documents (surgical — one fragment each);
  «复制 PROMPT» emits one consolidated `follow` prompt as the fallback.

## Guardrails

- Body is Times 14px/1.4 in pure `#000` ink, per spec; never soften the ink or shrink
  past 14px for the sake of density — legibility outranks the era look.
- One sticker per card at most; the catalog kitsch must not crowd out scannability.
- Status tints stay inside the spec's eight catalog colors (here lime / periwinkle /
  steel); the palette is closed — no custom desaturated variants.
- Status must always read from both the tint and the pill; color maps to real state.
- Hard offset shadows and the page frame are the only depth; no soft shadows, no
  gradients, no border-radius on working surfaces.
- Switching EN/中 must not reflow the layout: buttons whose label changes with language
  (the EN/中 toggle, the dispatch ghost buttons, the card expand/collapse toggle) hold a
  fixed width.
- The rails scroll via a slim grey handle centered on their seam border (native
  scrollbar hidden), so it sits on the line and never eats content width.
