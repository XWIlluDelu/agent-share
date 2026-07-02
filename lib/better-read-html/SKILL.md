---
name: better-read-html
description: Create or audit source-first static HTML artifacts from formal documents (papers, technical reports, notes, plans, specifications). Use only when the user asks for a browser-readable/local/offline/single-file/printable HTML page, document or note conversion into HTML, source-preserving HTML relayout, evidence-linked HTML report/close-reading page, or validation of an existing/generated HTML artifact. Do not use for general summarization, paper reading, Markdown editing, math explanation, design exploration, or report writing unless the deliverable is HTML. Choose preserve, annotate-synthesize, or audit; keep canonical source text unchanged; keep generated material noncanonical and source-linked; validate links, assets, remote dependencies, and fidelity claims. Load scholarly-rigor only for formal paper/citation/figure/equation/derivation work. Artifacts use IBM Carbon design language (flat surfaces, hairlines, restrained blue accent).
---

# Better Read HTML

Produce static, local-first HTML pages whose source boundary is inspectable. This skill is for HTML creation or audit, not general document analysis.

## Mode first

Choose one mode before rendering.

| Mode | Use when | Boundary |
|---|---|---|
| `preserve` | Exact conversion, source-preserving relayout, or “do not summarize/rewrite/add” requests. | Canonical text and source order are copied from validated source extraction/IR; no rewriting. |
| `annotate-synthesize` | The requested HTML includes explanation, close reading, report structure, reading guide, or synthesis. | Generated material is labeled noncanonical and source-linked for material claims. |
| `audit` | Inspect an existing/generated HTML artifact. | Report fidelity, links, assets, duplicate ids, remote dependencies, accessibility basics, and uncertainty; fix only if asked. |

Source type changes risk, not the basic mode. DOCX, PDF/OCR, Markdown, Obsidian, text, papers, and math all still use one of the modes above.

## Default workflow

1. Inventory supplied sources, assets, extraction quality, privacy/network constraints, high-risk material, and content shape: long prose, figures/assets, tables, equations, citations, code, comments, and footnotes.
2. Select mode and fidelity tier before rendering; ask if exact preservation and generated analysis conflict.
3. Build or verify a small source IR before rendering. Separate document body from site chrome, menus, search widgets, duplicate tables of contents, and decorative/navigation assets before anything becomes canonical. For converter output such as DOCX/PDF/Office/LibreOffice/Pandoc HTML, do not use the converter DOM as the reader DOM by default. Map it to source blocks, assets, tables, equations, citations, comments, headings, lists, inline links, inline emphasis, and code spans, then render semantic, namespaced HTML. Keep converter classes/styles only when they preserve meaningful structure or when the user asks for visual facsimile.
4. Render static HTML with local/inline assets by default. Use `templates/source-reader.html`, `templates/report-brief.html`, or `templates/note-wiki.html` as optional starting points when they help; adapt freely. Preserve the full selected source scope in `preserve`; if you intentionally render an excerpt, label the title/colophon/fidelity tier as an excerpt and never let the artifact imply full-document preservation.
5. Keep canonical source regions separate from noncanonical generated/layout regions, e.g. `data-canonical="false"` or `data-layout-duplicate="true"`. Omit empty noncanonical apparatus rather than rendering decorative placeholders.
6. Validate relevant fidelity, links, assets, ids, remote dependencies, accessibility basics, readable structure, visible uncertainty, and converter residue. Record the exact audit command/profile beside substantial artifacts. For existing HTML, use `python3 <skill-dir>/scripts/audit_html.py ...` when applicable.

## Load references only when needed

- [`references/mode-contracts.md`](references/mode-contracts.md): ambiguous preserve vs generated-content boundaries, PDFs/OCR preservation claims, fidelity tiers, or implied exactness; do not replace the three public modes.
- [`references/scholarly-rigor.md`](references/scholarly-rigor.md): academic/formal technical sources with citations, figures, tables, equations, derivations, or claim-level annotation.
- [`references/content-contract.md`](references/content-contract.md): structured IR, stable source ids, generated-block ids, asset ids, or evidence links.
- [`references/optional-components.md`](references/optional-components.md): requested question/evidence ledgers, translations, math rendering/copy affordances, figure cards, or citation status.
- [`references/integrity-validation.md`](references/integrity-validation.md): strict conversion gates or HTML audit failures.
- [`references/ibm-design-md.md`](references/ibm-design-md.md): modifying or auditing the IBM Carbon design language itself; do not load for normal rendering.

## Fidelity invariants

- Canonical source content is never rewritten to sound better.
- Source facts, labels, metadata, citations, identities, quantities, and claims are copied from the source or marked unavailable/uncertain; inferred or generated claims belong only in noncanonical blocks.
- Layout duplicates, previews, rails, colophons, and generated notes are marked noncanonical.
- Strict conversion requires verifiable source-order text. If it cannot be verified, mark the artifact unverified or ask; do not claim 100% preservation.
- For PDFs/OCR, preservation can only be claimed against validated extracted text/IR unless trusted structure or equivalent audit evidence exists. Reading-order uncertainty must be visible.

## Design rule

Artifacts use IBM Carbon design language: flat white surfaces on `#f4f4f4` ground, charcoal text, restrained blue accent (`#0f62fe`), IBM Plex Sans typography, square geometry with hairlines. Inline `templates/ibm-carbon.css` into `<style>`. Give the document title `<h1 class="brh-doc-title">…</h1>`. When using subtype-specific styles, emit `data-mode-subtype="…"` on the article root for CSS scoping.

Design is content-shaped: short notes use single-column article; long figure-heavy manuscripts may justify responsive semantic rails; table-heavy sources may need horizontal table wrappers. Rails, indexes, cards, annotations, glossaries, and copy controls are acceptable only when they reduce reader work and are marked noncanonical or as layout duplicates. For figure-heavy sources, place each figure once at relevant first mention with full source legend when user permits relayout; otherwise keep canonical figure in source order and use first-mention previews as noncanonical duplicates. On narrow screens, multiple rails/tools become one priority-ordered apparatus below the article, not unrelated repeated sidebars.

Aesthetic quality gate: clear hierarchy, readable measure and spacing, restrained accents, local/offline typography, visible focus/target states, print/narrow behavior, no obvious converter residue in reader-facing DOM unless source-structural or explicitly requested. This gate authorizes CSS, semantic wrappers, navigation, labels, and noncanonical aids; never authorizes rewriting canonical source text. Keep visible UI quiet: no assistant commentary, debug notes, process explanations, copy hints, or provenance prose unless the user asks or the artifact would otherwise be misleading.

Design smoke check for substantial artifacts: first viewport not dominated by noncanonical apparatus or extracted site navigation; source frontmatter not visibly duplicated by generated hero; paragraph width matches the chosen reading column unless a source form requires narrower measure; long titles and bare URLs wrap naturally; narrow screens show article content before the priority-ordered apparatus; figures appear near their first relevant mention or are explicitly marked as noncanonical previews; automatic links respect semantics (author affiliations, footnotes, bibliography citations, figure/table/equation references are distinct). If smoke check fails, revise rendering or report design warning.

## Reporting contract

For substantial artifacts, report the HTML path, single-file/asset status, mode, fidelity tier, source list, layout notes when they affect reading, validation summary, and unresolved uncertainty. For trivial artifacts, report only path, mode/fidelity, and validation warnings.

## Stop rules

Stop, ask, downgrade, or mark unverified when:

- Exact conversion is requested but only lossy extraction/OCR is available.
- Source text or assets are unavailable and would require guessing.
- A source block, attachment, table, figure, equation, citation, or evidence target is uncertain in strict mode.
- Remote services, remote fonts, or CDN math are needed for private/local sources without approval.
- A design choice would reduce readability, accessibility, or source auditability.
