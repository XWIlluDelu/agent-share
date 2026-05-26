# Optional Components

Use this reference only when the user explicitly asks for one of these layers, or when the selected artifact mode clearly needs it. These are lightweight artifact patterns and metadata hooks, not bundled engines. They must never weaken source preservation: generated content stays noncanonical and targets source ids.

## Table of contents

- [Question/evidence ledger](#questionevidence-ledger)
- [Translation layer](#translation-layer)
- [Math rendering policy](#math-rendering-policy)
- [Figure and asset cards](#figure-and-asset-cards)
- [Citation status](#citation-status)
- [Not included](#not-included)

## Question/evidence ledger

Use when the user supplies research questions, teaching prompts, review criteria, or decision questions. Render a generated ledger that maps each question to source evidence.

Required fields:

```yaml
question_ledger_status: none | requested | generated | blocked
```

Suggested block:

```markdown
:::question id="q001" generated="true" status="source-linked"
Question: ...
Evidence:
- `p004`: supporting source block
- `asset2`: relevant source asset
Open uncertainty:
- ...
:::
```

Do not use a fixed classroom or Wonksheet schema unless the user explicitly asks for it. Do not color-code questions in a way that implies unsupported source categories.

## Translation layer

Translation is opt-in unless the source itself is bilingual. Generated translations are noncanonical and must target source ids.

Required fields:

```yaml
translation_status: none | source-bilingual | selected-span-generated | paragraph-generated | side-by-side-generated | blocked
translation_scope: none | selected | paragraph | section | full-document
```

Prefer paragraph or selected-span translation for readable artifacts. Sentence-level hover translation is allowed only when explicitly requested; it is not a default because it bloats HTML and relies on fragile sentence boundaries.

## Math rendering policy

Preserve source LaTeX or equation text even when a visual renderer is used. Ask before remote/CDN rendering for private or local sources.

Required field:

```yaml
math_renderer: none | preserve-latex | native-mathml | local-katex | local-mathjax | approved-cdn
```

Rules:

- `none` or `preserve-latex` is acceptable when exact source display matters more than visual typesetting.
- `native-mathml` is preferred for simple equations when it can be generated deterministically and works without remote assets.
- `local-katex` or `local-mathjax` requires available local assets.
- `approved-cdn` requires explicit approval for network dependency.
- Rendering failure must leave readable source math visible.
- For technical readers, equation blocks may expose a click-to-copy source affordance using local HTML/JS or a visible `<code>` fallback. Keep it visually quiet: no persistent “click to copy” helper text, no remote clipboard library, no generated derivation mixed into the canonical equation, and preserve exact source text in `data-canonical-text`, `data-math-source`, or equivalent audit metadata.

## Figure and asset cards

Use cards to keep source assets, captions, generated descriptions, and uncertainty visually organized.

Required or recommended fields:

```yaml
asset_status: copied | referenced | missing | placeholder
caption_status: copied | unavailable | uncertain
```

Caption / figure / legend rules are owned by [`scholarly-rigor.md`](scholarly-rigor.md); see "Figures, tables, and captions" for the fidelity invariants (no auto-generated short-form captions; generated descriptions live in separate noncanonical blocks).

## Citation status

Use for scholarly or evidence-heavy artifacts where citation preservation or linking matters.

Required field when citations are material:

```yaml
citation_status: not-applicable | copied | linked | unresolved | unavailable
```

Citation preservation, affiliation, and DOI/venue enrichment rules are owned by [`scholarly-rigor.md`](scholarly-rigor.md); see "Citations, affiliations, and author claims".

## Not included

This skill does not bundle heavy engines for:

- PDF/OCR extraction;
- figure cropping, panel segmentation, or computer vision matching;
- CSL/BibTeX/Pandoc citation parsing and DOI enrichment;
- Obsidian vault graph, Dataview, or backlink resolution;
- browser visual-regression infrastructure;
- mandatory bilingual worksheet generation;
- mandatory MathJax/KaTeX packaging or model-specific rendering apps.

Use external adapters for those tasks and feed their audited outputs back into the content contract.
