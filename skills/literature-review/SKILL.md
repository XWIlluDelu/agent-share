---
name: literature-review
description: Conduct comprehensive, systematic literature reviews using multiple academic databases (PubMed, arXiv, bioRxiv, Semantic Scholar, etc.). This skill should be used when conducting systematic literature reviews, meta-analyses, research synthesis, or comprehensive literature searches across biomedical, scientific, and technical domains. Creates professionally formatted markdown documents and PDFs with verified citations in multiple citation styles (APA, Nature, Vancouver, etc.).
allowed-tools: Read Write Edit Bash
license: MIT license
metadata:
    skill-author: K-Dense Inc.
---

# Literature Review

## Overview

Conduct systematic, comprehensive literature reviews following rigorous academic methodology. Search multiple databases, synthesize findings thematically, verify all citations, and generate professional output in markdown and PDF.

## When to Use This Skill

- Systematic literature review, meta-analysis, or scoping review
- Synthesizing current knowledge across multiple sources
- Writing the literature review section of a paper or thesis
- Investigating state of the art or identifying research gaps
- Requiring verified citations and professional formatting

## Visual Enhancement

Optionally include PRISMA flow diagrams (for systematic reviews) and thematic synthesis diagrams when a diagramming workflow is available. Otherwise, use markdown tables or ASCII diagrams.

---

## Core Workflow

### Phase 1: Planning and Scoping

1. Define research question (use PICO framework for clinical/biomedical reviews)
2. Determine review type (narrative, systematic, scoping, meta-analysis) and set boundaries (time period, study types, geographic scope)
3. Develop search strategy: identify 2-4 main concepts, list synonyms and related terms, plan Boolean combinations (AND/OR/NOT)
4. Select minimum 3 complementary databases
5. Document inclusion/exclusion criteria (date range, language, publication types, study designs)

### Phase 2: Systematic Literature Search

1. Search across selected databases — use `pubmed-database` skill for PubMed, `semantic-scholar-daily` or Semantic Scholar API for cross-disciplinary search, arXiv API for preprints in physics/math/CS/q-bio. See `references/database_strategies.md` for detailed per-database guidance.
2. Document every search: database name, date, search string, date range, result count
3. Export results in JSON format, aggregate into a single file, deduplicate:
   ```bash
   python scripts/search_databases.py combined_results.json \
     --deduplicate --format markdown --output aggregated_results.md
   ```

### Phase 3: Screening and Selection

1. Deduplicate by DOI (primary) or title (fallback); document duplicates removed
2. Screen progressively: title → abstract → full text, applying inclusion/exclusion criteria at each stage
3. Document reasons for exclusion at each stage
4. Record final included count; create PRISMA flow diagram for systematic reviews:
   ```
   Initial: n=X → Deduplicated: n=Y → Title screen: n=Z → Abstract: n=A → Included: n=B
   ```

### Phase 4: Data Extraction and Quality Assessment

1. Extract from each study: metadata (authors, year, journal, DOI), design, sample size, key findings, limitations, funding/COI
2. Assess quality with appropriate tools (Cochrane RoB for RCTs, Newcastle-Ottawa for observational, AMSTAR 2 for reviews); rate High/Moderate/Low/Very Low
3. Identify 3-5 major themes; group studies by theme (studies may span multiple themes)

### Phase 5: Synthesis and Analysis

1. Write thematic synthesis (NOT study-by-study summaries) — organize by themes or research questions, compare/contrast across studies, highlight consensus and controversies
2. Evaluate methodological strengths and limitations across the literature
3. Identify knowledge gaps and propose future research directions
4. Write discussion: interpret findings in broader context, acknowledge review limitations, compare with prior reviews

### Phase 6: Citation Verification

1. Verify all DOIs resolve correctly:
   ```bash
   python scripts/verify_citations.py my_literature_review.md
   ```
2. Check that author names, titles, and publication details match retrieved metadata; fix errors and re-verify until all pass
3. Format citations consistently in one style throughout — see `references/citation_styles.md` for APA, Nature, Vancouver, Chicago, IEEE

### Phase 7: Document Generation

1. Generate PDF:
   ```bash
   python scripts/generate_pdf.py my_literature_review.md \
     --citation-style apa --output my_review.pdf
   ```
2. Review final output: formatting, citations, figures/tables, TOC accuracy
3. Final checklist: DOIs verified, citations consistent, search methodology documented, results thematic, quality assessed, limitations acknowledged

## Database-Specific Search Guidance

See `references/database_strategies.md` for comprehensive per-database strategies including PubMed MeSH tips, arXiv category codes, Semantic Scholar API usage, and citation chaining techniques.

## Citation Styles and Impact Prioritization

For detailed citation formatting (APA, Nature, Vancouver, Chicago, IEEE), see `references/citation_styles.md`.

Prioritize papers by citation count, venue quality, and author reputation — quality over quantity:

| Paper Age | Citations | Classification |
|-----------|-----------|----------------|
| 0-3 yr | 20+ / 100+ | Noteworthy / Highly Influential |
| 3-7 yr | 100+ / 500+ | Significant / Landmark |
| 7+ yr | 500+ / 1000+ | Seminal / Foundational |

Venue tiers: Tier 1 (Nature, Science, Cell, NEJM, Lancet, PNAS, top Nature sub-journals), Tier 2 (IF>10 journals, NeurIPS/ICML/ICLR), Tier 3 (IF 5-10 specialized). Use forward/backward citation chaining and snowball sampling from Tier-1 seed papers to find seminal work.

## Best Practices and Common Pitfalls

1. Search minimum 3 databases including preprint servers; document every search string, date, and count
2. Screen systematically (title → abstract → full text) with pre-defined criteria; document exclusion reasons
3. Synthesize thematically, not study-by-study; compare, contrast, identify patterns
4. Assess study quality with appropriate tools; verify all citations with `verify_citations.py`
5. Follow PRISMA guidelines for systematic reviews

Avoid: single-database search, undocumented searches, unverified citations, no quality assessment, ignoring preprints, publication bias, overly broad or narrow queries.

## Example Workflow

```bash
cp assets/review_template.md my_review.md
# Search PubMed, Semantic Scholar, arXiv; export JSON; aggregate:
python scripts/search_databases.py combined.json --deduplicate --format markdown --output results.md
# Screen, extract data, write thematic synthesis in my_review.md
python scripts/verify_citations.py my_review.md
python scripts/generate_pdf.py my_review.md --citation-style nature --output my_review.pdf
```

## Integration with Other Skills

- `citation-management` — search Google Scholar / PubMed, manage references
- `scientific-writing` — draft and polish manuscript text
- `pubmed-database` — programmatic PubMed access via E-utilities
- `openalex-database` — query OpenAlex for bibliometrics and citation analysis
- `semantic-scholar-daily` — search and rank recent papers via Semantic Scholar API
- `paper-search` / `paper-analyze` — search local paper notes, deep-analyze single papers
