---
name: pubmed-database
description: >-
  Programmatic access to PubMed biomedical literature via NCBI E-utilities
  REST API. Covers advanced Boolean/MeSH query construction, field-tagged
  searching, E-utilities endpoints (ESearch, EFetch, ESummary, EPost,
  ELink), history server for batch processing, citation matching, and
  systematic review search strategies. Use when searching biomedical
  literature, building automated literature pipelines, or conducting
  systematic reviews.
license: CC-BY-4.0
---

# PubMed Database

## Overview

PubMed is the U.S. National Library of Medicine's database with 36M+ biomedical citations from MEDLINE and life sciences journals. This skill covers programmatic access via the E-utilities REST API and advanced search query construction using Boolean operators, MeSH terms, and field tags.

## When to Use

- Searching biomedical literature with structured Boolean/MeSH queries
- Building automated literature monitoring or extraction pipelines
- Conducting systematic literature reviews or meta-analyses
- Retrieving article metadata, abstracts, or citation information by PMID/DOI
- Finding related articles or exploring citation networks programmatically
- Batch processing large sets of PubMed records
- For broader academic search (non-biomedical), use OpenAlex or Semantic Scholar

## Prerequisites

```bash
pip install requests  # HTTP client for E-utilities API
# Optional: pip install biopython  — Bio.Entrez wrapper (higher-level API)
```

**API Rate Limits**: 3 req/s without key, 10 req/s with key. Register at https://www.ncbi.nlm.nih.gov/account/

## Quick Start

```python
import requests, time

BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
API_KEY = "YOUR_API_KEY"  # Optional but recommended

def pubmed_request(endpoint, params):
    params.setdefault("api_key", API_KEY)
    response = requests.get(f"{BASE_URL}{endpoint}", params=params)
    response.raise_for_status()
    time.sleep(0.1 if API_KEY != "YOUR_API_KEY" else 0.34)
    return response

# Search → Fetch workflow
search_resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed", "term": "CRISPR[tiab] AND 2024[dp]",
    "retmax": 5, "retmode": "json"
})
pmids = search_resp.json()["esearchresult"]["idlist"]
print(f"Found: {pmids}")

fetch_resp = pubmed_request("efetch.fcgi", {
    "db": "pubmed", "id": ",".join(pmids),
    "rettype": "abstract", "retmode": "text"
})
print(fetch_resp.text[:500])
```

## Core API Summary

For complete code examples across all 6 endpoints and search patterns, see [references/api_reference.md](references/api_reference.md).

For systematic review workflow and literature monitoring pipeline, see [references/workflows.md](references/workflows.md).

For complete field tag reference and query templates, see [references/search_syntax.md](references/search_syntax.md) and [references/common_queries.md](references/common_queries.md).

## Key Concepts

### E-utilities Endpoint Summary

| Endpoint | Purpose | Key Parameters |
|----------|---------|----------------|
| `esearch.fcgi` | Search, return PMIDs | `term`, `retmax`, `sort`, `usehistory` |
| `efetch.fcgi` | Download full records | `id`/`query_key`+`WebEnv`, `rettype`, `retmode` |
| `esummary.fcgi` | Lightweight summaries | `id`, `retmode` |
| `epost.fcgi` | Upload UIDs to server | `id` (comma-separated) |
| `elink.fcgi` | Related articles, cross-DB | `id`, `dbfrom`, `db`, `cmd` |
| `einfo.fcgi` | List databases/fields | `db` (optional) |
| `ecitmatch.cgi` | Match citations to PMIDs | `bdata` |

### History Server Pattern

For result sets >500 articles, use the history server to avoid URL length limits:
1. **ESearch** with `usehistory=y` → returns `WebEnv` + `QueryKey`
2. **EFetch** in batches using `WebEnv` + `QueryKey` + `retstart`/`retmax`
3. **EPost** to upload additional PMIDs to the same `WebEnv`

### Automatic Term Mapping (ATM)

When no field tag is specified, PubMed maps terms through the MeSH Translation Table → Journals Table → Author Index → Full Text. Bypass ATM with explicit field tags (e.g., `term[tiab]`) or quoted phrases.

### Common MeSH Subheadings

| Subheading | Use |
|------------|-----|
| `/diagnosis` | Diagnostic methods |
| `/drug therapy` | Pharmaceutical treatment |
| `/epidemiology` | Disease patterns |
| `/etiology` | Disease causes |
| `/genetics` | Genetic aspects |
| `/prevention & control` | Preventive measures |
| `/therapy` | Treatment approaches |

## Key Parameters

| Parameter | Endpoint | Default | Effect |
|-----------|----------|---------|--------|
| `term` | ESearch | Required | Search query with Boolean/field tags |
| `retmax` | ESearch/EFetch | 20 | Max records returned (up to 10,000) |
| `retstart` | ESearch/EFetch | 0 | Offset for pagination |
| `rettype` | EFetch | `full` | Output: `abstract`, `medline`, `xml`, `uilist` |
| `retmode` | All | `xml` | Format: `xml`, `json`, `text` |
| `sort` | ESearch | `relevance` | `relevance`, `pub_date`, `first_author` |
| `usehistory` | ESearch | `n` | Enable history server: `y` for large sets |
| `api_key` | All | None | NCBI API key for 10 req/sec |

## Best Practices

1. **Always use an API key** — register at NCBI for 10 req/sec instead of 3
2. **Use history server for >500 results** — avoids URL length limits
3. **Include rate limiting** — `time.sleep(0.1)` with API key, `time.sleep(0.34)` without
4. **Cache results locally** — PubMed data changes slowly
5. **Combine MeSH + free text** — `(diabetes mellitus[mh] OR diabetes[tiab])` for comprehensive coverage
6. **Document search strategies** — record exact queries, dates, result counts for systematic reviews
7. **Parse XML for structured data** — text is human-readable but XML preserves field structure

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| HTTP 429 | Rate limit exceeded | Add `time.sleep()`; use API key |
| HTTP 414 (URI Too Long) | Too many PMIDs in URL | Use history server or EPost |
| Empty result set | Overly restrictive query | Remove filters one at a time |
| Unexpected MeSH mapping | Automatic Term Mapping | Use explicit field tags: `term[tiab]` |
| Missing abstracts | Pre-1975 or certain types | Filter: `hasabstract[text]` |
| Stale history server | Session expired (8h) | Re-run ESearch with `usehistory=y` |
| Truncated results | Default `retmax=20` | Set `retmax=100` or higher |

## Bundled Resources

- [references/search_syntax.md](references/search_syntax.md) — Complete field tag reference, Boolean/wildcard/proximity syntax, automatic term mapping rules, all filter types
- [references/common_queries.md](references/common_queries.md) — Ready-to-use query templates organized by domain (~40 example patterns)
- [references/api_reference.md](references/api_reference.md) — Complete ESearch/EFetch/ESummary/ELink/ECitMatch code examples
- [references/workflows.md](references/workflows.md) — Systematic review workflow and literature monitoring pipeline

## References

- PubMed Help: https://pubmed.ncbi.nlm.nih.gov/help/
- E-utilities Documentation: https://www.ncbi.nlm.nih.gov/books/NBK25501/
- NCBI API Key: https://www.ncbi.nlm.nih.gov/account/

## Related Skills

- **openalex-database** — broader academic literature beyond biomedical
- **literature-review** — systematic review methodology and PRISMA framework
