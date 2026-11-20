# Mode Contracts

`SKILL.md` exposes three public modes (`preserve`, `annotate-synthesize`,
`audit`). The router below picks a finer internal `mode_subtype` inside that
public mode and records it in the audit report.

| Subtype | Public mode | Charter |
|---|---|---|
| `conversion-preserve` | `preserve` | exact conversion / source-preserving relayout |
| `close-read` | `annotate-synthesize` | annotated paper, evidence notes, reading guide |
| `derivation-math` | `annotate-synthesize` | formula reconstruction, notation table |
| `notes-wiki` | `preserve` (Obsidian / Markdown notes) | wikilink + frontmatter panel preservation |
| `synthesis-report` | `annotate-synthesize` | report, brief, executive summary, recommendations |
| `debug-audit` | `audit` | inspect / verify / compare-text / extraction debug |

## Mode router

| User signal | Select | Ask first when |
|---|---|---|
| “100% preserve”, “exact conversion”, “do not add/delete/change”, “convert only”, “do not summarize” | `conversion-preserve` | The user also asks for explanation, translation, or recommendations. |
| “improve the layout”, “easier to read”, “format as HTML”, “make this more readable”, “reformat for reading” | `conversion-preserve` as source-preserving relayout | The user also wants summaries, commentary, or structure beyond relayout. |
| “in-depth reading”, “close reading”, “annotate”, “margin notes”, “reading guide”, “help me read this document/PDF” | `close-read` | Source extraction quality is unknown or the user may expect exact conversion. Load `scholarly-rigor.md` for paper/formula/citation/figure-heavy sources. |
| “derive”, “derivation”, “skipped steps”, “formula logic”, “notation table” | `derivation-math` | Source equations are unavailable or derivation would be speculative. Load `scholarly-rigor.md`. |
| “Obsidian”, “wikilinks”, “note page”, “vault”, “Markdown note to HTML” | `notes-wiki` | The user expects vault link resolution but vault paths are unavailable. |
| “report”, “brief”, “synthesis”, “executive summary”, “recommendations”, “combine these sources” | `synthesis-report` | Claims cannot be linked to the provided sources. |
| “audit”, “verify”, “compare text”, “debug extraction” | `debug-audit` | None; use the strictest useful checks available. |

## Fidelity tiers

| Tier | Meaning | Required label |
|---|---|---|
| `verified-preserve` | Canonical source-order normalized text matches original source text or a separately audited ground-truth extraction. | “Source-order preservation verified against audited source text.” |
| `extracted-preserve` | HTML preserves an extracted text/IR, but the extraction itself has not been independently verified against original ground truth. | “Preserves extracted text; extraction quality has warnings.” |
| `source-primary` | Source text is primary, with separate generated annotations. | “Source-first close-reading artifact.” |
| `synthesized` | The artifact reorganizes or summarizes sources. | “Synthesized report, not source-preserving conversion.” |
| `unverified` | Validation could not prove preservation. | “Unverified; do not treat as exact conversion.” |

## Allowed transformations

### `conversion-preserve`

- **Allowed:** semantic HTML tags, stable ids, source labels, TOC, anchors,
  local asset references, canonical/noncanonical markup, provenance colophon,
  accessibility metadata, CSS layout, visible extraction warnings.
- **Forbidden in canonical content:** summaries, explanations, translations,
  style-driven rewrites, inferred figure legends, inferred affiliations,
  normalized terminology, reordered sections, dropped front/back matter,
  generated alt text presented as source fact.

### `close-read`

- **Allowed outside canonical source:** evidence notes, argument-function notes,
  `key-point` claim blocks, requested translations, figure/asset notes,
  derivation repairs, questions.
- **Required:** every generated note targets a declared source/section/asset/
  figure/table/equation id or states why a precise target is unavailable.

### `derivation-math`

- **Allowed:** notation table, assumptions, source equation map, reconstructed
  intermediate steps, omitted-proof notes, formula logic overview.
- **Required:** distinguish exact source equations from reconstructed steps;
  mark unbridgeable leaps `Unresolved Derivation Gap` instead of inventing a
  bridge.

### `notes-wiki`

- **Allowed:** frontmatter panel, wikilink chips or resolved links, callout
  styling, local asset links, backlinks when an explicit vault manifest or
  backlink source is provided.
- **Required:** do not fake vault resolution; report broken/unresolved
  wikilinks.

## PDF and OCR policy

PDFs are not automatically source-preserving. Before claiming preservation,
record extractor/tool and version (when available), page count and covered
range, text-layer vs OCR status, reading-order confidence, image-only pages,
structured-content extraction limitations, and per-page/block warnings.

For scanned/OCR PDFs, use `extracted-preserve` or `source-primary`, never
`verified-preserve`, unless a separate human/audit process validates the text.
Load [`scholarly-rigor.md`](scholarly-rigor.md) for academic or formal technical
PDFs (and for the excluded-engine boundary).

## Synthesis policy

A synthesis report may introduce new headings, executive summaries, comparison
tables, recommendations, and visual hierarchy. It must not imply source wording
unless quoted. Cite source ids, file paths, page numbers, URLs, or manifest
entries for material claims; label unsupported recommendations as inference or
remove them.
