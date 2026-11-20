# Scholarly and Formal-Technical Rigor

Use this reference when the artifact involves academic papers, preprints, formal
technical documents, scientific/medical/legal/compliance sources, citations,
figures, tables, equations, proofs, derivations, or paper-like PDFs. It
strengthens the generic workflow without relaxing the source contract.

## Default stance

For formal scholarly or technical sources, default to `conversion-preserve`
unless the user explicitly asks for annotation, explanation, synthesis, or
derivation. If the user asks for both exact conversion and analysis, keep
analysis noncanonical and visibly separate, or ask which output should be
primary. Never let a `key-point` block, evidence note, figure note, or generated
explanation imply that generated content is source text.

## Scholarly source inventory

In addition to the generic inventory, record:

- document type and venue/status if stated by the source;
- page count and covered page range;
- section hierarchy and appendix/supplement coverage;
- figure, table, equation, algorithm, theorem, footnote, and citation counts
  when relevant;
- bibliography/reference availability;
- text-layer vs OCR status and reading-order confidence by page, section, or
  block;
- table/formula/figure extraction limitations, missing/image-only pages, or
  cropped/unsupported material.

## Paper and PDF preservation

PDFs are not automatically source-preserving. Apply the PDF/OCR policy and
fidelity tiers from [`mode-contracts.md`](mode-contracts.md) at full stringency:
claim `verified-preserve` only against original source text or a separately
audited ground-truth extraction, never an unaudited intermediate. Surface
reading-order uncertainty with `reading_order_status`.

## Figures, tables, and captions

- Copy figure/table legends only when the source provides them.
- If a legend is absent, set `caption_status="unavailable"` and leave canonical
  caption text empty. If you show a visible placeholder (`Legend unavailable
  from source`), mark it noncanonical status UI (`data-canonical="false"`);
  never invent a legend.
- Do not auto-generate short-form, summarized, or paraphrased captions.
  `caption_status` is `copied | unavailable | uncertain`. Any generated
  alt-text or interpretation lives in a separate noncanonical element with
  `data-generated="true"` and `data-target="<figure-id>"`; it must not replace,
  prefix, or shadow the source caption.
- Preserve original numbering and labels when present. If figure/table
  association is uncertain, mark it uncertain rather than attaching the wrong
  caption.
- In `preserve`, keep figures/tables in source order unless the user asks for
  reader relayout, the source already places them near first mention, or the
  document clearly benefits from figure-aware relayout and the output is labeled
  relaid/extracted rather than exact source-order facsimile. When relaid, each
  figure/table appears once at first mention, carries
  `data-relayout="first-mention"` plus source-index provenance, and keeps the
  full copied legend/caption.

## Citations, affiliations, links, and author claims

- Do not invent citations, affiliations, author intent, venue, institution,
  funding, or related-work claims.
- Preserve citation strings and bibliography entries when present.
- Link declared cross-references when safe (bibliography citations,
  figure/table/equation refs, source footnotes/comments, bare source URLs) while
  keeping the visible source string intact. Do not mislink affiliation
  superscripts, footnote markers, or numbering.
- Do not enrich DOI, venue, author, or citation style without a separate source.
  External source URLs are ordinary anchors, not render dependencies.
- For synthesis reports, cite source ids, file paths, page numbers, URLs, or
  manifest entries for material claims, and label generated conclusions as
  synthesis rather than findings of the source authors.

## Equations and derivations

Use `derivation-math` only when requested or clearly needed. Distinguish exact
source equations, notation tables derived from source symbols, stated
assumptions, standard named rules/theorems, reconstructed intermediate steps,
and unresolved gaps.

Render source equations visually with an offline renderer (bundled KaTeX by
default) or native MathML while preserving exact source equation text in the
HTML TeX, `data-canonical-text`, `data-math-source`, or adjacent source markup.
When extraction is lossy (e.g., DOCX/OMML without reliable conversion), preserve
raw equation text and mark visual rendering as reconstructed.

Every generated derivation block must target source equation ids or an explicit
source section. If a logical gap cannot be bridged from direct source equations,
stated assumptions, or cited standard rules, mark it `Unresolved Derivation Gap`
instead of inventing a bridge.

## Academic close-reading layer

Allowed outside canonical source blocks: evidence notes in the right pane,
argument-function labels, `key-point` claim blocks, glossary/notation cards,
figure/table notes, derivation repairs, and questions for the reader. Every
generated note must target a declared source/section/figure/table/equation id or
state why a precise target is unavailable.

## Academic output checks

Verify in addition to generic checks:

- figure/table/equation/citation ids are unique and linked without broken
  cross-references;
- generated notes target declared ids;
- legends/captions are copied, unavailable, uncertain, or separately generated —
  never silently inferred;
- source equations and reconstructed steps are visually distinct and retain
  source-preserving text;
- extraction limitations and reading-order uncertainty appear in compact
  provenance and the audit summary, not as decorative process commentary in the
  reader body.

## Boundary: accepted hooks, not bundled engines

This skill accepts lightweight metadata contracts and optional hooks (figure/
caption/asset status, `citation_status`, equation/derivation provenance,
user-supplied question ledgers, opt-in noncanonical translation, math renderer
policy). It does **not** bundle or require heavy engines:

- OCR or PDF reading-order reconstruction;
- automatic figure cropping, panel segmentation, or CV matching;
- CSL/BibTeX/Pandoc citation parsing or DOI enrichment;
- full Obsidian vault graph, Dataview, or backlink resolution;
- browser visual-regression infrastructure;
- math renderers beyond the bundled KaTeX, or model-specific rendering apps;
- mandatory sentence-level hover translation, bilingual worksheet generation, or
  fixed classroom worksheet layouts.

Feed audited outputs from external adapters into the content contract when those
capabilities are needed.
