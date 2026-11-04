# Template

`template/` is the only rendering base. Copy the whole directory for each
artifact, then replace the `<title>`, the `.brand` text, the
`<meta name="annotation-report">` id, and everything inside `<main>`. Delete the
example content completely. Keep the stylesheets, scripts and their order: the
page works offline from `file://`, and its behaviour depends on that order (math
renders before evidence notes move and before ink indexes text).

Output is a folder: `index.html` plus `assets/`. Put source images under
`assets/source/`. Produce a single file only when the user asks; inlining the
KaTeX fonts makes it large.

## Table of contents

- [Page skeleton and ids](#page-skeleton-and-ids)
- [Components](#components)
- [Evidence notes](#evidence-notes)
- [Content contract to markup](#content-contract-to-markup)
- [What the template already provides](#what-the-template-already-provides)
- [Changing the template](#changing-the-template)

## Page skeleton and ids

```html
<main><div class="paper">
<header>
 <h1>Source or report title</h1>
 <p class="source-line">…</p>
</header>
<section id="s-method" aria-labelledby="method">
 <h2 id="method">02　Method</h2>
 <h3 id="scaled-attention">…</h3>
 <p id="p014">…</p>
</section>
</div></main>
```

- `h2`/`h3` with ids build the contents pane; no TOC markup is needed.
- Ids are stable and derived from what an element is (`p014` from the source
  IR, `s-method`, `fig-attention`), never from render position. Readers' ink is
  anchored to the nearest element with an id plus quoted text, so an id that
  changes on regeneration detaches their marks.
- `annotation-report` is the key for readers' annotation files. Derive it from
  the source identity (`vaswani2017-attention`), keep it when the report is
  regenerated, and use only letters, digits, `-` and `_`. Never ship the
  template's example id.

## Components

| Class | Use |
|---|---|
| `key-point` | Blue block for one substantive finding or neutral conclusion. |
| `key-point key-point--positive` | Green: improvement or supporting evidence. |
| `key-point key-point--negative` | Red: limitation or issue to address. |
| `aside-note` | Secondary information: smaller, subdued, thin left rule. |
| `math-display` | Display equation: `<div class="math-display">$$ … $$</div>`. Inline math is `$ … $`. |
| `table-responsive` + `task-io` | Wrap every table: `<div class="table-responsive"><table class="task-io">`. `num` right-aligns numeric cells. |
| `code-block` | `<pre class="code-block"><code>…</code></pre>`; gains a copy button. |
| `academic-details` | `<details class="academic-details"><summary>…</summary><div class="details-content">…</div></details>` for optional supporting material. |
| `figure-resizable`, `figure-open`, `figure-resize` | Figure markup from the example; keeps resizing and the image viewer. |

Point blocks share geometry; use one per conclusion and keep ordinary
qualifications in body text or an `aside-note`. In `preserve` mode every
component that adds text is noncanonical (`data-canonical="false"`).

Add CSS only for source structures the template lacks, in a `<style>` after the
template stylesheets, using its variables (`--ink`, `--muted`, `--line`,
`--surface`, `--accent`). Do not restyle the template per artifact.

## Evidence notes

Write each note right after the block that cites it; the script moves notes into
the right pane, numbers markers by first reference, and adds back links. Without
notes, no pane is created.

```html
<p id="p031">Transformer big reaches 28.4 BLEU<a class="ev-ref" href="#ev-table2-bleu"></a>, …</p>
<aside class="ev-note" id="ev-table2-bleu" data-kind="excerpt" data-locator="Table 2"
       data-target="t002" data-canonical="false">
 <blockquote>Transformer (big) … 28.4</blockquote>
</aside>
```

- `data-kind`: `excerpt` (verbatim quote with locator), `citation` (reference
  to a source location), or `note` (generated commentary).
- Tie every note to its source: `data-target` lists in-page source ids;
  `data-locator` names the location in an external source (page, section,
  table). At least one is required; quotes are verbatim.
- Ids come from what the note supports (`ev-<source-id>` or a claim slug),
  never `ev-3`: readers' ink on a note is stored under its id.
- Several markers may point to one note; a note may hold several excerpts.
- Use notes for material claims that need source support, not for every
  sentence.
- In `preserve` mode, source footnotes and comments stay in the body in source
  order. A note may preview them only as a marked duplicate
  (`data-layout-duplicate="true" data-duplicate-of="<id>"`); nothing from the
  source may exist only in the pane.

## Content contract to markup

| IR item | Markup | Provenance |
|---|---|---|
| Source block | `<p id="p001" data-source-index="1">` (or `li`, `blockquote`, …) | stable id; source index/page when available |
| Section | `<section id="s-…" aria-labelledby="…">` + heading id | heading id; source index when copied |
| Figure | example figure markup inside `<figure id="fig-1" data-asset-status="copied" data-caption-status="copied">` with `<figcaption class="figure-caption">` | asset and caption status; `data-relayout="first-mention"` when moved |
| Table | `<figure id="tab-1">` + `table-responsive` + `task-io` | caption status; reading-order status when uncertain |
| Equation | `<div class="math-display" id="eq-1">$$…$$</div>` | the TeX in the HTML is the source math; `data-equation-status` when reconstructed |
| Citation | copied inline citation + `href` to the bibliography id when declared | `data-citation-status` when linked/unresolved/unavailable |
| Source footnote/comment | canonical block with `data-comment-origin="source"` | source id/index |
| Generated note | `aside.ev-note` (above) | `data-target` or `data-locator` |
| Generated block in body | `key-point`/`aside-note`/`section` with `data-canonical="false" data-generated="true" data-target="…"` | target ids |
| Layout duplicate | `data-layout-duplicate="true" data-duplicate-of="…"` | duplicate target |

Converter HTML is an extraction aid, not markup to paste: map it to these
elements and drop wrapper classes, inline styles and empty spans.

## What the template already provides

Do not rebuild these: contents pane with scroll highlighting; evidence pane
(pushes the page at ≥1280 px, overlays below, one pane at a time on phones);
figure resizing and a zoomable image viewer; code copy; selection copy that
writes LaTeX for formulas; laser pointer (`L`) whose drags leave unsaved trails
that fade after a minute (`Esc` clears them); pen annotations (`P`) saved per
report to browser storage or a chosen folder; print layout with evidence as
endnotes; reduced-motion and forced-colors handling.

## Changing the template

Edit `template/` only for changes every artifact should get. Annotation-file
persistence has regression tests: `node --test tests/`. Pane, evidence and ink
behaviour are browser-level; check them in Chrome at 800, 1280, 1440 and
1920 px after changing `panes.js`, `evidence.js`, `annotations.js` or
`text-index.js`.
