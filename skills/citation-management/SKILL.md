---
name: citation-management
description: Comprehensive citation management for academic research. Search Google Scholar and PubMed for papers, extract accurate metadata, validate citations, and generate properly formatted BibTeX entries. This skill should be used when you need to find papers, verify citation information, convert DOIs to BibTeX, or ensure reference accuracy in scientific writing.
allowed-tools: Read Write Edit Bash
license: MIT License
metadata:
    skill-author: K-Dense Inc.
---

# Citation Management

## Overview

Manage citations systematically: search academic databases (Google Scholar, PubMed), extract metadata from CrossRef/PubMed/arXiv, validate citation accuracy, and generate properly formatted BibTeX. Integrates with the literature-review skill for end-to-end research workflows.

## When to Use This Skill

- Searching for papers on Google Scholar or PubMed
- Converting DOIs, PMIDs, or arXiv IDs to BibTeX
- Extracting or validating citation metadata
- Cleaning, deduplicating, or formatting BibTeX files
- Building a bibliography for a manuscript

## Core Workflow

### Phase 1: Paper Discovery

Search Google Scholar (broad cross-discipline coverage) or PubMed (biomedical focus, MeSH-based queries). Use year filters and sort by citations to find high-impact work.

- Script: `scripts/search_google_scholar.py` — automated Scholar search with pagination, year filters, citation counts
- Script: `scripts/search_pubmed.py` — PubMed E-utilities client with MeSH, field tags, Boolean queries, date filters
- Details: `references/google_scholar_search.md`, `references/pubmed_search.md`

### Phase 2: Metadata Extraction

Convert paper identifiers (DOI, PMID, arXiv ID, URL) to complete metadata via CrossRef, PubMed, arXiv, and DataCite APIs. Supports single and batch processing.

- Script: `scripts/extract_metadata.py` — universal metadata extractor (DOI/PMID/arXiv/URL), batch mode, multi-format output
- Script: `scripts/doi_to_bibtex.py` — quick single/batch DOI-to-BibTeX conversion
- Details: `references/metadata_extraction.md`

### Phase 3: BibTeX Formatting

Standardize BibTeX entries: consistent field order, proper title capitalization (protected with `{}`), author name format, citation key conventions. Sort, deduplicate, and fix common syntax errors.

- Script: `scripts/format_bibtex.py` — format, sort, deduplicate, validate BibTeX files
- Details: `references/bibtex_formatting.md`

### Phase 4: Citation Validation

Verify DOIs resolve correctly, check required fields per entry type, detect duplicates, validate syntax and data consistency (year, volume, pages format).

- Script: `scripts/validate_citations.py` — DOI verification, completeness checks, duplicate detection, auto-fix, reporting
- Details: `references/citation_validation.md`

### Phase 5: Integration with Writing

Typical end-to-end flow for a manuscript bibliography:

```bash
# 1. Search
python3 scripts/search_pubmed.py "topic query" --date-start 2020 --limit 200 --output papers.json

# 2. Extract metadata
python3 scripts/extract_metadata.py --input papers.json --output refs.bib

# 3. Add specific papers by DOI
python3 scripts/doi_to_bibtex.py 10.1038/nature12345 >> refs.bib

# 4. Format, deduplicate, sort
python3 scripts/format_bibtex.py refs.bib --deduplicate --sort year --descending --output formatted.bib

# 5. Validate and auto-fix
python3 scripts/validate_citations.py formatted.bib --auto-fix --report validation.json --output final.bib
```

## Key Rules

- Always use DOIs as the primary identifier when available — most reliable metadata source.
- Never type BibTeX entries by hand; always extract from metadata APIs via scripts.
- Validate before submission: run `validate_citations.py` as a final check.
- If a preprint has been published, cite the journal version.
- Protect capitalization in BibTeX titles with `{}` and use `--` for page ranges.
- Search multiple databases (Scholar + PubMed) for comprehensive coverage.

## Integration with Other Skills

- **literature-review**: Use literature-review for systematic search methodology and synthesis; use citation-management for the technical metadata/validation layer.
- **scientific-writing / venue-templates**: Export validated BibTeX for LaTeX manuscripts; format references to match venue requirements.
