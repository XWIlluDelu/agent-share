---
name: "openalex-database"
description: "Query OpenAlex REST API for scholarly literature — 250M+ works, authors, institutions, journals, and concepts. Search by title/abstract keywords, author, DOI, ORCID, or OpenAlex ID. Filter by year, open access status, citation count, or field. Retrieve citations, references, and author disambiguation. Free, no authentication required. For PubMed biomedical search use pubmed-database; for bioRxiv preprints use biorxiv-database."
license: "CC0-1.0"
---

# OpenAlex Scholarly Database

## Overview

OpenAlex is a free, open-access index of 250M+ scholarly works, 90M+ authors, 110,000+ journals, and 10,000+ institutions. It succeeds Microsoft Academic Graph and provides rich metadata: abstracts, open-access URLs, citation counts, referenced works, author disambiguated IDs (ORCID), and concept tags. The REST API requires no authentication for up to 100,000 requests/day; a polite pool (email parameter) gives priority processing.

## When to Use

- Building systematic literature review corpora across all academic disciplines (not just biomedical)
- Retrieving citation networks for bibliometric analysis or reference graph traversal
- Disambiguating author identities using ORCID/OpenAlex author IDs
- Finding open-access full-text URLs for a set of DOIs
- Analyzing publication trends by year, institution, country, or research concept
- Enriching a paper list with metadata from DOIs or titles
- For PubMed-indexed biomedical literature use `pubmed-database`; for bioRxiv preprints use `biorxiv-database`

## Prerequisites

```bash
pip install requests pandas
```

- No API key required; add `mailto=your@email.com` to join the polite pool
- Rate limits: 10 req/s; cursor pagination supports up to 10,000 results per query

## Quick Start

```python
import requests

BASE = "https://api.openalex.org"
r = requests.get(f"{BASE}/works",
                 params={"search": "CRISPR gene editing",
                         "filter": "publication_year:2023",
                         "per_page": 5,
                         "mailto": "your@email.com"})
r.raise_for_status()
data = r.json()
print(f"Total: {data['meta']['count']}")
for work in data["results"][:3]:
    print(f"  {work['title'][:80]} ({work['publication_year']}) cites={work['cited_by_count']}")
```

## Core API Summary

| Use Case | Endpoint / Pattern |
|----------|-------------------|
| Search works by keyword/filter | `GET /works?search=...&filter=...` |
| Lookup single work by DOI | `GET /works/https://doi.org/{doi}` |
| Search authors, resolve ORCID | `GET /authors?search=...` |
| Get all papers by author (ORCID) | `GET /works?filter=author.orcid:{orcid}` |
| Get citation network | `GET /works/{id}?select=referenced_works` |
| Concept/topic trend analysis | `GET /works?filter=concepts.id:...&group_by=publication_year` |
| Batch metadata by DOIs | Loop per DOI or batch by `filter=openalex_id:W1|W2|...` |

For complete runnable code (6 query types, systematic search, collaboration network, batch DOI lookup, country analysis), see [references/api_queries.md](references/api_queries.md).

## Key Concepts

### Inverted Index Abstracts

OpenAlex stores abstracts as inverted indexes (word → positions) due to copyright restrictions. Reconstruct with:
```python
inv = work.get("abstract_inverted_index")
if inv:
    words = {pos: w for w, ps in inv.items() for pos in ps}
    text = " ".join(words[i] for i in sorted(words))
```

### Cursor-Based Pagination

Use `cursor="*"` to start, then read `next_cursor` from each response. Max 200 per page, up to 10,000 results via cursor pagination.

## Key Parameters

| Parameter | Default | Range / Options | Effect |
|-----------|---------|-----------------|--------|
| `search` | — | text string | Full-text search across title+abstract |
| `filter` | — | `field:value,field:value` | Structured filters (AND logic) |
| `per_page` | `25` | `1`–`200` | Results per page |
| `cursor` | `"*"` | cursor string | Cursor-based pagination |
| `sort` | `relevance` | `cited_by_count:desc`, `publication_year:desc` | Result ordering |
| `select` | all fields | comma-separated field names | Limit response fields (faster) |
| `group_by` | — | field name | Aggregate counts by field |
| `mailto` | — | email address | Polite pool (prioritized processing) |

## Best Practices

1. **Always include `mailto`**: Joins polite pool for priority processing without extra rate throttling.
2. **Use `select` for large paginations**: e.g., `select=id,doi,title,cited_by_count` to reduce response size.
3. **Use cursor pagination, not offset**: OpenAlex does not support offset beyond 10,000 results.
4. **Check `abstract_inverted_index is not None`** before reconstructing — not all works have abstracts.
5. **Cache by work ID**: OpenAlex Work IDs (W…) are stable; cache to avoid re-fetching.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `HTTP 429 Too Many Requests` | Rate limit exceeded | Add `time.sleep(0.15)`; use polite pool |
| Empty `abstract_inverted_index` | No abstract | Check for `None` before reconstructing |
| Cursor pagination returns duplicates | Cursor expired | Re-start with `cursor="*"` |
| DOI lookup 404 | DOI not indexed in OpenAlex | Try title search instead |
| Filter returns 0 | Syntax error | Use `field:value` with no spaces; verify field names |
| Stale `cited_by_count` | Counts refresh periodically | Use for trends, not exact figures |

## Related Skills

- `pubmed-database` — Biomedical literature with MeSH controlled vocabulary
- `literature-review` — Systematic review methodology and PRISMA framework
- `scientific-brainstorming` — Hypothesis generation using literature as input

## References

- [OpenAlex documentation](https://docs.openalex.org/)
- [OpenAlex API endpoint](https://api.openalex.org/)
- [OpenAlex paper (Priem et al. 2022)](https://arxiv.org/abs/2205.01833)
- [Entity types reference](https://docs.openalex.org/api-entities/works)
