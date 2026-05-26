# Mode Contracts

The skill exposes three public modes (`preserve`, `annotate-synthesize`, `audit`) in SKILL.md. The router below resolves a finer subtype inside that public mode — it is internal routing, not a parallel taxonomy. The chosen subtype is rendered as `data-mode-subtype="…"` on the article root (e.g. `<main data-mode-subtype="close-read">`) so subtype-gated CSS can scope reliably without enlarging the public configuration surface.

| Subtype | Public mode | Charter |
|---|---|---|
| `conversion-preserve` | `preserve` | exact conversion / source-preserving relayout |
| `close-read` | `annotate-synthesize` | annotated paper, margin notes, reading guide |
| `derivation-math` | `annotate-synthesize` | formula reconstruction, notation table |
| `notes-wiki` | `preserve` (Obsidian / Markdown notes) | wikilink + frontmatter panel preservation |
| `synthesis-report` | `annotate-synthesize` | report, brief, executive summary, recommendations |
| `debug-audit` | `audit` | inspect / verify / compare-text / extraction debug |

## Table of contents

- [Mode router](#mode-router)
- [Fidelity tiers](#fidelity-tiers)
- [Allowed transformations](#allowed-transformations)
- [PDF and OCR policy](#pdf-and-ocr-policy)
- [Synthesis policy](#synthesis-policy)

## Mode router

| User signal | Select | Ask first when |
|---|---|---|
| “100% preserve”, “exact conversion”, “do not add/delete/change”, “只转换”, “不要总结” | `conversion-preserve` | The user also asks for explanation, translation, or recommendations. |
| “精读”, “close reading”, “annotate”, “margin notes”, “reading guide”, “help me read this document/PDF” | `close-read` | Source extraction quality is unknown or the user may expect exact conversion. Load `scholarly-rigor.md` for paper/formula/citation/figure-heavy sources. |
| “derive”, “推导”, “skipped steps”, “formula logic”, “notation table” | `derivation-math` | The source equations are unavailable or generated derivation would be speculative. Load `scholarly-rigor.md`. |
| “Obsidian”, “wikilinks”, “note page”, “vault”, “Markdown note to HTML” | `notes-wiki` | The user expects vault link resolution but vault paths are unavailable. |
| “report”, “brief”, “synthesis”, “executive summary”, “recommendations”, “combine these sources” | `synthesis-report` | Claims cannot be linked to the provided sources. |
| “audit”, “verify”, “compare text”, “debug extraction” | `debug-audit` | None; use the strictest useful checks available. |

## Fidelity tiers

| Tier | Meaning | Required label |
|---|---|---|
| `verified-preserve` | Canonical source-order normalized text matches original source text or a separately audited ground-truth extraction. | “Source-order preservation verified against audited source text.” |
| `extracted-preserve` | HTML preserves an extracted text/IR, but the extraction itself has not been independently verified against the original document ground truth. | “Preserves extracted text; extraction quality has warnings.” |
| `source-primary` | Source text is primary, with separate generated annotations. | “Source-first close-reading artifact.” |
| `synthesized` | The artifact reorganizes or summarizes sources. | “Synthesized report, not source-preserving conversion.” |
| `unverified` | Validation could not prove preservation. | “Unverified; do not treat as exact conversion.” |

## Allowed transformations

### `conversion-preserve`

Allowed: semantic HTML tags, stable ids, source labels, TOC, anchors, local asset references, canonical/noncanonical markup, provenance colophon, accessibility metadata, CSS layout, visible extraction warnings.

Forbidden in canonical content: summaries, explanations, translations, style-driven rewrites, inferred figure legends, inferred affiliations, normalized terminology, reordered sections, dropped front/back matter, generated alt text presented as source fact.

### `close-read`

Allowed outside canonical source: margin notes, argument-function notes, claim/evidence cards, optional translations when requested, figure or asset notes, derivation repairs when applicable, questions, reading guide rails.

Required: every generated note targets a source id, broader section id, asset id, figure/table/equation id, or explicitly says why a precise target is unavailable. Use `optional-components.md` for question/evidence ledgers and translation layers; do not default to classroom worksheet or sentence-hover translation behavior.

### `derivation-math`

Allowed: notation table, assumptions, source equation map, reconstructed intermediate steps, omitted-proof notes, formula logic overview.

Required: distinguish exact source equations from reconstructed/supplemented steps. If a logical gap cannot be bridged using direct source equations, stated assumptions, or standard named rules that can be cited, mark it as an `Unresolved Derivation Gap` instead of inventing a bridge.

### `notes-wiki`

Allowed: frontmatter panel, wikilink chips or resolved links, callout styling, local asset cards, backlinks when a vault manifest or explicit backlink source is available.

Required: do not fake vault resolution; report broken/unresolved wikilinks. Do not implement full vault graph, Dataview, or backlink inference unless an external adapter provides audited data.

## PDF and OCR policy

PDFs are not automatically source-preserving. Before claiming preservation, record:

- extractor/tool and version when available;
- page count and covered page range;
- text-layer vs OCR status;
- reading-order confidence;
- image-only pages;
- extraction limitations for structured content and attachments;
- per-page or per-block warnings.

For scanned/OCR PDFs, use `extracted-preserve` or `source-primary`, not `verified-preserve`, unless a separate human/audit process validates the text. Load `scholarly-rigor.md` for academic papers, equations, citations, figures, tables, or formal technical PDFs. This skill does not bundle OCR, layout reconstruction, or figure-cropping engines.

## Synthesis policy

A synthesis report may use new headings, executive summaries, comparison tables, recommendations, and visual hierarchy. It must not imply source wording unless quoted. Every material claim should cite source ids, file paths, page numbers, URLs, or a source manifest entry. Unsupported recommendations are labeled as inference or removed.
