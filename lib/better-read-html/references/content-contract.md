# Content Contract

Use this as the preferred intermediate representation when authoring a readable
HTML artifact. It is intentionally compatible with structured Markdown, but the
same fields can be represented as JSON.

## Table of contents

- [Frontmatter](#frontmatter)
- [Canonical source blocks](#canonical-source-blocks)
- [Generated blocks](#generated-blocks)
- [Noncanonical layout duplicates](#noncanonical-layout-duplicates)
- [Source manifest](#source-manifest)
- [Uncertainty fields](#uncertainty-fields)
- [Optional component fields](#optional-component-fields)
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
assets_dir: assets/source/
validation_required: true
math_renderer: none | preserve-latex | native-mathml | local-katex | local-mathjax | approved-cdn
translation_status: none | source-bilingual | selected-span-generated | paragraph-generated | side-by-side-generated | blocked
translation_scope: none | selected | paragraph | section | full-document
question_ledger_status: none | requested | generated | blocked
citation_status: not-applicable | copied | linked | unresolved | unavailable
```

The frontmatter exposes only the public mode. The internal `mode_subtype`
(close-read / synthesis-report / conversion-preserve / notes-wiki /
derivation-math / debug-audit) is determined by the router in
`mode-contracts.md` and recorded in the audit report; it is not a frontmatter
field. For citation, figure, and caption rules, see
[`scholarly-rigor.md`](scholarly-rigor.md). For the HTML each IR item becomes,
see [`template.md`](template.md).

## Canonical source blocks

Canonical blocks are the source record. Do not place generated analysis inside
them.

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

Generated blocks must target source ids. They render as evidence notes or
noncanonical body blocks; see [`template.md`](template.md).

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

For derivation blocks, use `scholarly-rigor.md` before authoring generated
steps.

For question/evidence ledgers, translation layers, math renderers, figure records,
and citation status, use `optional-components.md`.

## Noncanonical layout duplicates

HTML generated from previews, indexes, or annotation duplicates must use one
of:

```html
<aside data-layout-duplicate="true" data-duplicate-of="asset1">...</aside>
<section data-canonical="false">...</section>
```

The validator should exclude these nodes from source-order parity.

## Source manifest

For multi-source reports, include a source manifest in frontmatter or an audit
block:

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

- `caption_status: copied | unavailable | uncertain` (generated alt-text or
  interpretation lives in a separate noncanonical block with
  `data-generated="true"` and `data-target="<figure-id>"`; see
  [`scholarly-rigor.md`](scholarly-rigor.md))
- `reading_order: verified | extracted | uncertain | manual`
- `reading_order_status` on each section/block when PDF extraction order is not
  verified
- `ocr_status: not-needed | used | uncertain | failed`
- `asset_status: copied | referenced | missing | placeholder`
- `scholarly_status: not-applicable | required | applied | blocked`

## Optional component fields

Use these fields only when the corresponding optional component is relevant.
Read `optional-components.md` before adding generated layers.

- `math_renderer: none | preserve-latex | native-mathml | local-katex |
  local-mathjax | approved-cdn`
- `translation_status: none | source-bilingual | selected-span-generated |
  paragraph-generated | side-by-side-generated | blocked`
- `translation_scope: none | selected | paragraph | section | full-document`
- `question_ledger_status: none | requested | generated | blocked`
- `citation_status: not-applicable | copied | linked | unresolved | unavailable`

## Rendering rules

- Unknown source facts stay unknown.
- IDs are stable, human-readable, and unique.
- Referenced ids must be declared ids, not only note targets.
- In `preserve` / `conversion-preserve`, generated block types are not allowed
  unless the user explicitly asks for a separate noncanonical annotation layer.
- Translation is opt-in and noncanonical unless the source itself is bilingual.
- Converter HTML is an extraction aid, not a design source. Drop tool-specific
  wrapper markup, inline styling, empty spans/divs, and page-layout artifacts
  unless they carry meaningful source structure or the user requested visual
  facsimile.
- When a source begins with title/authors/affiliations/summary, use that
  canonical frontmatter as the visible document opening. Do not add a separate
  generated hero that repeats the same content; keep fidelity/provenance labels
  compact in a footer or collapsed details block.
- Keep generated apparatus within a budget: evidence notes for material claims,
  one compact provenance block, comments collapsed by default, no empty notes.
- Visible reader HTML is not a log. Avoid assistant commentary, process notes,
  “generated by” explanations, persistent helper text, or debug labels unless
  needed to prevent a fidelity misunderstanding; keep provenance compact and
  noncanonical when present.
