# Optional Components

Use this reference only when the user explicitly asks for one of these layers or
the selected mode needs it. These are lightweight patterns and metadata hooks —
not bundled engines (see the excluded-engine boundary in
[`scholarly-rigor.md`](scholarly-rigor.md)). Enum values live in
[`content-contract.md`](content-contract.md). Generated content always stays
noncanonical and targets declared source ids.

## Question/evidence ledger

Use when the user supplies research questions, teaching prompts, review
criteria, or decision questions. Set `question_ledger_status` and render a
generated ledger mapping each question to source evidence:

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

Do not impose a fixed classroom or worksheet schema unless requested, and do not
color-code questions in ways that imply unsupported source categories.

## Translation layer

Translation is opt-in unless the source itself is bilingual. Set
`translation_status` and `translation_scope`. Prefer paragraph or selected-span
translation; allow sentence-level hover translation only when explicitly
requested (it bloats HTML and relies on fragile sentence boundaries).

## Math rendering policy

Set `math_renderer` and preserve source LaTeX or equation text even when a
visual renderer is used. Ask before using remote/CDN rendering on private or
local sources.

- `none` or `preserve-latex` is acceptable when exact source display matters
  more than visual typesetting.
- `native-mathml` is preferred for simple equations when it can be generated
  deterministically without remote assets.
- The template bundles KaTeX, so `local-katex` is the default: write TeX
  between `$…$` or `$$…$$`. Source TeX stays in the HTML, renders offline, and
  copies back as LaTeX.
- `local-mathjax` requires available local assets; `approved-cdn` requires
  explicit approval for the network dependency.
- Rendering failure must leave readable source math visible (KaTeX runs with
  `throwOnError:false`).
- Do not mix generated derivation steps into a source equation; reconstructed
  steps live in separate blocks with `data-equation-status`.

## Figure, asset, and citation status hooks

Set `asset_status`, `caption_status`, and (when citations are material)
`citation_status` on figure/asset and scholarly records. All fidelity rules for
captions, legends, citations, affiliations, and enrichment are owned by
[`scholarly-rigor.md`](scholarly-rigor.md).
