# Scholarly and Formal-Technical Rigor

Use this reference when the artifact involves academic papers, preprints, formal technical documents, scientific/medical/legal/compliance sources, citations, figures, tables, equations, proofs, derivations, or paper-like PDFs. This reference strengthens the generic document-artifact workflow; it does not relax the source contract.

## Table of contents

- [When to load this reference](#when-to-load-this-reference)
- [Default stance](#default-stance)
- [Scholarly source inventory](#scholarly-source-inventory)
- [Paper and PDF preservation](#paper-and-pdf-preservation)
- [Figures, tables, and captions](#figures-tables-and-captions)
- [Citations, affiliations, and author claims](#citations-affiliations-and-author-claims)
- [Equations and derivations](#equations-and-derivations)
- [Academic close-reading layer](#academic-close-reading-layer)
- [Academic output checks](#academic-output-checks)
- [Boundary: accepted hooks, not bundled engines](#boundary-accepted-hooks-not-bundled-engines)

## When to load this reference

Load it for any of these signals:

- paper, preprint, article, proceedings, thesis, report, specification, RFC, standard, clinical/legal/compliance document;
- PDF close reading, annotated paper, figure-aware reading, citation-aware reading;
- formula, equation, notation, proof, derivation, skipped steps, appendix math;
- source claims where fabricated legends, citations, affiliations, author intent, or math steps would be harmful.

## Default stance

For formal scholarly or technical sources, default to `conversion-preserve` unless the user explicitly asks for annotation, explanation, synthesis, or derivation. If the user asks for both exact conversion and analysis, keep analysis noncanonical and visibly separate, or ask which output should be primary.

Never let a warm/editorial design, margin note, figure card, or generated explanation imply that generated content is source text.

## Scholarly source inventory

In addition to the generic inventory, record:

- document type and venue/status if stated by the source;
- page count and covered page range;
- section hierarchy and appendix/supplement coverage;
- figure, table, equation, algorithm, theorem, footnote, and citation counts when relevant;
- bibliography/reference availability;
- text-layer vs OCR status;
- reading-order confidence by page, section, or block;
- table/formula/figure extraction limitations;
- missing pages, image-only pages, cropped content, or unsupported material.

## Paper and PDF preservation

PDFs are not automatically source-preserving. Before claiming `verified-preserve`, parity must be checked against original source text or a separately audited ground-truth extraction. Matching HTML to an unaudited intermediate extraction is only `extracted-preserve`.

For scanned/OCR PDFs, use `extracted-preserve` or `source-primary`, not `verified-preserve`, unless a separate human or deterministic audit validates the text. Surface reading-order uncertainty at page, section, or block level with `reading_order_status`.

## Figures, tables, and captions

- Copy figure/table legends only when the source provides them.
- If a legend is absent, write `Legend unavailable from source`; do not invent one.
- Do not auto-generate short-form, summarized, or paraphrased captions. `caption_status` is one of `copied | unavailable | uncertain`. A generated alt-text or interpretation block must live in a separate noncanonical element with `data-generated="true"` and a `data-target` pointing at the figure id; it must not replace, prefix, or shadow the source caption.
- Generated descriptions, alt text, visual summaries, or interpretation must be marked generated/noncanonical.
- Preserve original numbering and labels when present.
- If figure/table association is uncertain, mark it uncertain rather than attaching the wrong caption.
- In `preserve`, keep figures/tables in source order unless the user asks for reader relayout, the source already places them near first mention, or the document form clearly benefits from figure-aware relayout and the output is labeled as relaid/extracted rather than exact source-order facsimile. When relayout is used, each figure/table should appear once at the most relevant first mention, carry `data-relayout="first-mention"` or equivalent provenance, and keep the copied full legend/caption with it.

## Citations, affiliations, links, and author claims

- Do not invent citations, affiliations, author intent, venue, institution, funding, or related-work claims.
- Preserve citation strings and bibliography entries when present.
- Link declared cross-references when safe: bibliography citations to bibliography ids, figure/table references to figure/table ids, equation references to equation ids, source footnotes/comments to their ids, and bare source URLs to external anchors. Keep the visible source string intact; do not turn affiliation superscripts, footnote markers, bibliography citations, figure labels, or equation numbers into the wrong kind of link.
- Do not enrich DOI, venue, author, or citation style without a separate source. External source URLs are ordinary anchors, not render dependencies.
- For synthesis reports, cite source ids, file paths, page numbers, URLs, or manifest entries for material claims.
- Label generated conclusions as synthesis; do not present them as findings of the source authors.

## Equations and derivations

Use `derivation-math` only when requested or clearly needed for the artifact. Distinguish:

- exact source equations;
- notation tables derived from source symbols;
- stated assumptions;
- standard named rules or theorems;
- reconstructed/supplemented intermediate steps;
- unresolved gaps.

Render source equations visually when a local/offline renderer is available or native MathML is sufficient, while preserving exact source equation text in `data-canonical-text`, `data-math-source`, adjacent source markup, or an equivalent audit field. If source math is lossy (for example, DOCX/OMML extraction without reliable conversion), preserve the raw equation text and mark the visual rendering as reconstructed rather than silently replacing the source.

Every generated derivation block must target source equation ids or an explicit source section. If a logical gap cannot be bridged using direct source equations, stated assumptions, or standard named rules that can be cited, mark it as an `Unresolved Derivation Gap` instead of inventing a bridge.

## Academic close-reading layer

Allowed outside canonical source blocks:

- margin notes;
- argument-function labels;
- claim/evidence cards;
- glossary or notation cards;
- figure/table notes;
- derivation repairs;
- questions for the reader;
- reading guide rails.

Required: every generated note targets a source id, section id, figure/table/equation id, or explicitly states why a precise target is unavailable.

## Academic output checks

For scholarly/formal artifacts, add checks for:

- figure/table/equation/citation ids are unique and linked;
- generated notes target declared ids;
- legends/captions are copied, unavailable, uncertain, or generated—never silently inferred;
- bibliography, citation, figure/table, equation, footnote, and bare-URL links are not broken when rendered;
- source equations and reconstructed steps are visually distinct and retain copyable/source-preserving text when available;
- extraction limitations and reading-order uncertainty are visible in the artifact and audit summary, not as decorative process commentary in the reader body.

## Boundary: accepted hooks, not bundled engines

Accept lightweight contracts and optional hooks:

- figure/caption/asset records with stable ids and uncertainty status;
- citation preservation and `citation_status` reporting;
- equation/derivation provenance and unresolved-gap labels;
- question/evidence ledgers when the user supplies questions;
- opt-in translation layers marked noncanonical;
- math renderer policy fields.

Do not bundle or imply built-in support for heavy engines:

- OCR and PDF reading-order reconstruction;
- automatic figure cropping, panel segmentation, or computer-vision matching;
- CSL/BibTeX/Pandoc citation parsing or DOI enrichment;
- full Obsidian vault graph, Dataview, or backlink resolution;
- mandatory sentence-level hover translation;
- fixed classroom Wonksheet layouts.
