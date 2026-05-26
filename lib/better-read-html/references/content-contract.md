# Content Contract

Use this as the preferred intermediate representation when authoring a readable HTML artifact. It is intentionally compatible with structured Markdown, but the same fields can be represented as JSON.

## Table of contents

- [Frontmatter](#frontmatter)
- [Canonical source blocks](#canonical-source-blocks)
- [Generated blocks](#generated-blocks)
- [Noncanonical layout duplicates](#noncanonical-layout-duplicates)
- [Source manifest](#source-manifest)
- [Uncertainty fields](#uncertainty-fields)
- [Optional component fields](#optional-component-fields)
- [Semantic HTML mapping](#semantic-html-mapping)
- [Rendering rules](#rendering-rules)

## Frontmatter

```yaml
title: "..."
subtitle: "..."
mode: preserve | annotate-synthesize | audit
fidelity_tier: verified-preserve | extracted-preserve | source-primary | synthesized | unverified
source_type: pdf | docx | markdown | obsidian-note | article | formal-paper | report | mixed
source_file: "..."
source_url: "..."
sources: []
language: en | zh | mixed | other
design_language: ibm-carbon
assets_dir: assets/<slug>/
validation_required: true
math_renderer: none | preserve-latex | native-mathml | local-katex | local-mathjax | approved-cdn
translation_status: none | source-bilingual | selected-span-generated | paragraph-generated | side-by-side-generated | blocked
translation_scope: none | selected | paragraph | section | full-document
question_ledger_status: none | requested | generated | blocked
citation_status: not-applicable | copied | linked | unresolved | unavailable
```

The frontmatter exposes only the public mode. The internal `mode_subtype` (close-read / synthesis-report / conversion-preserve / notes-wiki / derivation-math / debug-audit) is determined by the router in `mode-contracts.md` and rendered as `data-mode-subtype` on the article root for CSS scoping; it is not a frontmatter field. For citation, figure, and caption rules, see [`scholarly-rigor.md`](scholarly-rigor.md).

## Canonical source blocks

Canonical blocks are the source record. Do not place generated analysis inside them.

```markdown
## Section title

:::source id="p001" source_index="1" page="3"
Original paragraph text here.
:::

:::asset id="asset1" src="assets/source/image1.png" source_index="42" type="image" caption_status="copied"
Original caption or label if supplied by the source.
:::

If a caption or legend is absent, set `caption_status="unavailable"` and leave canonical caption text empty. Any visible “caption unavailable from source” label is noncanonical status UI, not source text.

For scholarly figures, tables, equations, and derivations, read `scholarly-rigor.md`.
```

## Generated blocks

Generated blocks must target source ids.

```markdown
:::note id="n001" target="p001" type="argument-function" generated="true"
This paragraph establishes the problem boundary.
:::

:::claim id="c001" generated="true" status="source-supported"
Claim text.

Evidence:
- `p001`: source paragraph
- `asset1`: original source asset
:::
```

For derivation blocks, use `scholarly-rigor.md` before authoring generated steps.

For question/evidence ledgers, translation layers, math renderers, figure cards, and citation status, use `optional-components.md`.

## Noncanonical layout duplicates

HTML generated from preview, rail, index, or annotation duplicates must use one of:

```html
<aside data-layout-duplicate="true" data-duplicate-of="asset1">...</aside>
<section data-canonical="false">...</section>
```

The validator should exclude these nodes from source-order parity.

## Source manifest

For multi-source reports, include a source manifest in frontmatter or an audit block:

```yaml
sources:
  - id: s1
    path: reports/q4.md
    title: Q4 source note
    type: markdown
    hash: "sha256:..."
  - id: s2
    url: https://example.com/source
    retrieved: 2026-05-19
```

## Uncertainty fields

Use explicit status fields rather than vague prose:

- `caption_status: copied | unavailable | uncertain` (generated alt-text or interpretation lives in a separate noncanonical block with `data-generated="true"` and `data-target="<figure-id>"`; see [`scholarly-rigor.md`](scholarly-rigor.md))
- `reading_order: verified | extracted | uncertain | manual`
- `reading_order_status` on each section/block when PDF extraction order is not verified
- `ocr_status: not-needed | used | uncertain | failed`
- `asset_status: copied | referenced | missing | placeholder`
- `scholarly_status: not-applicable | required | applied | blocked`

## Optional component fields

Use these fields only when the corresponding optional component is relevant. Read `optional-components.md` before adding generated layers.

- `math_renderer: none | preserve-latex | native-mathml | local-katex | local-mathjax | approved-cdn`
- `translation_status: none | source-bilingual | selected-span-generated | paragraph-generated | side-by-side-generated | blocked`
- `translation_scope: none | selected | paragraph | section | full-document`
- `question_ledger_status: none | requested | generated | blocked`
- `citation_status: not-applicable | copied | linked | unresolved | unavailable`

## Semantic HTML mapping

Prefer semantic, namespaced reader HTML over converter wrapper DOM. This is a rendering contract, not a bundled extraction engine. Preserve source order in canonical regions unless the selected mode explicitly permits separate generated organization.

| IR item | Preferred HTML | Required provenance | Notes |
|---|---|---|---|
| Source paragraph/block | `<p id="p001" class="brh-source-block" data-source-index="1">...</p>` | stable id; source index/page when available | Preserve text and inline source emphasis/citations; do not carry nonsemantic converter spans/styles. |
| Section | `<section class="brh-section" aria-labelledby="sec-id">...` plus heading id | heading id; source index when copied | Generated section labels are noncanonical unless copied from source. |
| Asset/figure | `<figure id="fig-1" class="brh-asset-card" data-asset-status="copied" data-caption-status="copied">...` | source index; asset status; caption status; `data-relayout` if moved from source order | Use copied captions only. If absent, show status as noncanonical UI, not invented caption text. Under user-approved reader relayout, a figure may move to first mention and remain the single canonical figure record; record the relayout policy and keep source text parity only if the extracted comparison text reflects the chosen readable order. |
| Layout preview/rail card | `<aside class="brh-figure-peek" data-layout-duplicate="true" data-duplicate-of="fig-1">...` | duplicate target | Keep short; omit if it adds clutter; exclude from parity. Use preview duplicates only when the canonical full figure remains elsewhere; avoid both preview and full figure when the full figure is already embedded at the relevant reading point. |
| Table | `<figure class="brh-table-figure"><div class="brh-table-wrap"><table>...` | table/reading-order status; caption status | Preserve headers, spans, units, and footnotes when available; mark uncertainty instead of simplifying silently. |
| Equation/math | `<figure class="brh-equation" data-equation-status="source" data-math-renderer="native-mathml" data-canonical-text="...">...` | exact source math text or source image; renderer policy | Rendering failure must leave readable source math visible. A quiet copy-source affordance is allowed for equation blocks; visible helper text is not. Generated derivations are noncanonical and target source equations. |
| Citation/bibliography | copied inline citation string plus `href`/`data-citation-ref` to declared bibliography id when available | `citation_status` or `data-citation-status` for linked/unresolved/unavailable links | Do not enrich DOI, venue, author, or style without a separate source. Numeric superscripts in frontmatter are usually affiliations, not bibliography citations; classify affiliation markers, footnotes, citations, and figure/table/equation references before adding links. Preserve bare source URLs as clickable anchors when safe and report them as external links, not remote render dependencies. |
| Source-origin comment/footnote | canonical or provenance block with `data-comment-origin="source"` | source id/index when available | Generated reviewer notes use `data-generated="true"` and targets instead. |
| Generated note/claim | `<aside data-canonical="false" data-generated="true" data-target="p001">...` | target/evidence ids | Not allowed in plain conversion-preserve unless explicitly requested. |

## Rendering rules

- Unknown source facts stay unknown.
- IDs are stable, human-readable, and unique.
- Referenced ids must be declared ids, not only note targets.
- In `preserve` / `conversion-preserve`, generated block types are not allowed unless the user explicitly asks for a separate noncanonical annotation layer.
- Translation is opt-in and noncanonical unless the source itself is bilingual.
- Converter HTML is an extraction aid, not a design source. Drop tool-specific wrapper markup, inline styling, empty spans/divs, and page-layout artifacts unless they carry meaningful source structure or the user requested visual facsimile.
- When a source begins with title/authors/affiliations/summary, use that canonical frontmatter as the visible document opening. Do not add a separate generated hero that repeats the same content; keep fidelity/provenance labels compact in a footer, rail, or collapsed details block.
- Keep substantial generated apparatus within a budget: one compact provenance surface by default; dual rails/tools only for dense sources; comments collapsed by default; first-mention peeks short and optional; no empty or decorative rails.
- On narrow screens, merge multiple rails/tools into one ordered apparatus after the main article early enough to avoid squeezed sidebars. Use explicit priority metadata such as `data-rail-priority="10"` where needed: core navigation first, then source-linked reader aids, then reference/asset indexes, then provenance.
- Visible reader HTML is not a log. Avoid assistant commentary, process notes, “generated by” explanations, persistent helper text, or debug labels unless needed to prevent a fidelity misunderstanding; keep provenance compact and noncanonical when present.
