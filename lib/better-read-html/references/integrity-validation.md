# Integrity Validation

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

When comparing HTML with source text, ignore `script`, `style`, elements with
`data-canonical="false"`, and elements with `data-layout-duplicate="true"`. Do
not blanket-exclude `<aside>`; canonical source asides count unless explicitly
marked noncanonical.

Normalize whitespace consistently and preserve codepoints (NFC) by default.
Compatibility normalization (NFKC) may be reported diagnostically, never to
satisfy strict exact-preservation parity. Report first mismatch context when
parity fails.

## Audit summary & helper output

Run `scripts/audit_html.py` on every rendered HTML artifact (record the exact
command and `--profile` used beside substantial audit outputs).

- **Agent audit summary** records artifact-level metadata not derived solely
  from HTML: `mode`, `mode_subtype`, `fidelity_tier`, `sources`, `layout_notes`,
  `unreferenced_assets`, and `unsupported_content`.
- **`scripts/audit_html.py`** emits structured JSON covering:
  - **Strict structural/source-boundary gates** (cause non-zero exit under
    `--strict`): `main_seen`, `canonical_text_chars`, `duplicate_ids`,
    `broken_internal_links`, `unresolved_attribute_refs`,
    `missing_referenced_assets`, `missing_local_links`, `remote_dependencies`
    (unless `--allow-remote`), `executable_links`, `navigation_hazards`
    (`<base href>`, meta refresh), `html_validity_errors`,
    `source_boundary_errors` (generated-block targets and evidence-note rules),
    `template_errors` (`annotation-report` id), and
    `source_order_normalized_text_exact_match` (with `first_text_mismatch` and
    diagnostic `source_order_compatibility_text_match`).
  - **Advisory warning buckets** (reported without failing `--strict` unless
    they also violate a strict rule): `accessibility_warnings`,
    `readability_warnings`, `design_warnings`, `converter_residue_warnings`, and
    `scholarly_warnings` (`--profile scholarly`).
  - **Informational inventories:** `asset_references`, `local_links`,
    `external_links` (ordinary anchors, not render dependencies),
    `inline_data_assets`, `benign_external_links`, and counts for ids, relaid
    figures, evidence notes, math elements, and links.

## Lightweight static checks

Keep static checks local and contract-based; they do not replace human visual
judgment and never authorize canonical text rewrites.

- **Accessibility & structure:** `html[lang]`, `<title>`, viewport meta, one
  useful `<main>`, nonempty canonical text. Empty `alt=""` is valid for
  decorative images; missing `alt` warns.
- **Dependencies & navigation:** flag unauthorized remote render dependencies
  (scripts, stylesheets, fonts, iframes, media, CSS `url()`/`@import`,
  `srcset`, `<object>`), executable links, missing local links/assets (including
  URLs and local `@import` chains inside stylesheets), `<base href>`, and meta refresh.
- **Readability & layout:** visible `:focus-visible` and `:target` styles when
  anchored, `.table-responsive` / `overflow-x: auto` wrappers for wide tables,
  print stylesheet (`@media print`), no duplicate noncanonical hero, no
  double-rendered figures, no truncated or editorial-prefixed captions, no
  visible process/helper notes, and low converter residue (`<font>`, legacy
  tags, excessive inline `style=`).
- **Scholarly (`--profile scholarly`):** check `data-caption-status`, math
  renderer/provenance markers (satisfied automatically by bundled KaTeX), and
  `citation_status` / `data-citation-status` when citations are present. Do not
  require external engines listed in [`scholarly-rigor.md`](scholarly-rigor.md).
