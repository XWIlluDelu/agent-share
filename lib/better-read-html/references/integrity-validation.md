# Integrity Validation

## Table of contents

- [Acceptance gates by mode](#acceptance-gates-by-mode)
- [Canonical text extraction](#canonical-text-extraction)
- [Required report fields](#required-report-fields)
- [Readability and design checks](#readability-and-design-checks)
- [Audit helper](#audit-helper)

## Acceptance gates by mode

| Check | conversion-preserve | close-read | derivation-math | notes-wiki | synthesis-report |
|---|---|---|---|---|---|
| Canonical source text parity | required when source text is available | source blocks preserved | source equations mapped when applicable | optional unless strict | not applicable |
| Duplicate ids | fail | fail | fail | fail | fail |
| Broken internal links | fail | fail | fail | fail | fail |
| Missing local assets | fail or visible warning by user policy | visible warning | visible warning | visible warning | fail for report-critical assets |
| Unresolved evidence refs | fail if any generated refs exist | fail | fail | warn/fail by policy | fail for material claims |
| Caption/source-label uncertainty | fail or visible unsupported item | visible uncertainty | visible uncertainty when applicable | visible warning | cite source or mark unavailable |
| Remote dependency | ask first | ask first | ask first | ask first | ask first |
| Accessibility basics | required | required | required | required | required |

## Canonical text extraction

When comparing HTML with source text, ignore:

- `script` and `style`;
- elements with `data-canonical="false"`;
- elements with `data-layout-duplicate="true"`;
- colophons, rails, generated annotations, and UI indexes when marked noncanonical.

Do not blanket-exclude `<aside>`; canonical source asides must count unless they are explicitly marked noncanonical. Normalize whitespace consistently and preserve codepoints by default. Compatibility normalization such as NFKC may be reported as a diagnostic, but it must not satisfy strict exact-preservation parity. Report first mismatch context when parity fails.

## Required report fields

A useful audit report should include:

```json
{
  "mode": "preserve",
  "mode_subtype": "conversion-preserve",
  "fidelity_tier": "verified-preserve",
  "html_file": "...",
  "sources": [],
  "design_language": "ibm-carbon",
  "layout_notes": [],
  "source_order_normalized_text_exact_match": true,
  "duplicate_ids": [],
  "broken_internal_links": [],
  "missing_referenced_assets": [],
  "unreferenced_assets": [],
  "warnings": [],
  "unsupported_content": [],
  "remote_dependencies": [],
  "external_links": []
}
```

## Readability and design checks

Keep design checks static, local, and contract-based. They do not replace human visual judgment and they never authorize canonical text rewrites. Suggested report buckets:

```json
{
  "fidelity_errors": [],
  "source_boundary_errors": [],
  "asset_link_errors": [],
  "accessibility_errors": [],
  "readability_warnings": [],
  "design_warnings": [],
  "converter_residue_warnings": []
}
```

Recommended lightweight checks:

- `html[lang]`, `<title>`, viewport meta, one useful `<main>`, nonempty canonical text. Empty `alt=""` is valid for decorative images; missing `alt` is an accessibility warning.
- Duplicate ids, broken internal links, unresolved `data-target`/`data-duplicate-of`/evidence refs.
- Unauthorized remote render dependencies such as scripts, stylesheets, fonts, iframes, remote media, or CDN math; executable links. Ordinary external source/citation anchors are reported as `external_links`, not failed as dependencies unless an offline-no-external policy is selected.
- Visible `:focus-visible` and `:target` styles when the artifact has navigation or anchors; long URLs and code-like tokens wrap or scroll without body-level horizontal overflow.
- Readable measure/spacing by inspection or documented route; horizontal overflow wrappers for wide tables/code/math.
- Print or print-safe behavior for substantial reading artifacts.
- Empty decorative apparatus omitted; rails/cards/previews marked noncanonical or duplicate.
- Substantial-artifact design smoke checks: first viewport not dominated by noncanonical apparatus or extracted site navigation; no visible duplicate generated/source title block; long titles and bare URLs do not create horizontal overflow; narrow screens show article content before long navigation; automatic anchors distinguish affiliations, footnotes, citations, and figure/table references.
- Converter residue warnings for high inline-style density, `<font>` tags, tool-specific wrapper classes, empty spans/divs, page fields, and GIF-only math when a cleaner source math representation is available.

For scholarly/formal sources, additionally check declared figure/table/equation/citation ids and status fields when those structures exist: `asset_status`, `caption_status`, `citation_status`, `math_renderer`, `reading_order_status`, generated-note targets, and visible uncertainty. Do not require OCR, figure CV, CSL/BibTeX/DOI enrichment, browser visual regression, JavaScript, remote fonts, or subjective aesthetic scores.

## Audit helper

Use `scripts/audit_html.py` for already-rendered HTML. It is a partial structural/source audit, not a full accessibility or visual test. It checks duplicate ids, missing `<main>` in strict mode, empty canonical text in strict mode, broken internal links, selected reference/evidence attributes, local asset references, remote render dependencies, executable links, external source links, minimal accessibility warnings, optional canonical text parity, selected readability/design warnings, and emits JSON. `--strict` is a structural/source-boundary gate; it can still report accessibility, readability, design, or scholarly warnings without failing unless those warnings also violate a strict structural rule. Record the exact command/profile used beside substantial audit outputs.
