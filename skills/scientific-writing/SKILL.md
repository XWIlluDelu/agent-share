---
name: scientific-writing
description: Core skill for the deep research and writing tool. Write scientific manuscripts in full paragraphs (never bullet points). Use two-stage process with (1) section outlines with key points using research-lookup then (2) convert to flowing prose. IMRAD structure, citations (APA/AMA/Vancouver), figures/tables, reporting guidelines (CONSORT/STROBE/PRISMA), for research papers and journal submissions.
allowed-tools: Read Write Edit Bash
license: MIT license
metadata:
    skill-author: K-Dense Inc.
---

# Scientific Writing

## Overview

Core skill for the deep research and writing tool — combining AI-driven deep research with well-formatted written outputs. Every document produced is backed by comprehensive literature search and verified citations through the research-lookup skill.

**Critical Principle: Always write in full paragraphs with flowing prose. Never submit bullet points in the final manuscript.** Use a two-stage process: first create section outlines with key points using research-lookup, then convert those outlines into complete paragraphs.

## When to Use This Skill

- Writing or revising any section of a scientific manuscript
- Structuring a research paper (IMRAD or other standard formats)
- Formatting citations in specific styles (APA, AMA, Vancouver, Chicago, IEEE)
- Creating or improving figures, tables, and data visualizations
- Applying reporting guidelines (CONSORT, STROBE, PRISMA, etc.)
- Preparing manuscripts for journal submission
- Improving writing clarity, conciseness, and field-specific terminology

---

## Core Capabilities

### 1. Manuscript Structure (IMRAD)

Guide papers through Introduction, Methods, Results, And Discussion. Support alternative structures for reviews, case reports, meta-analyses, methods papers, and theoretical/modeling papers. See `references/imrad_structure.md` for detailed section-by-section guidance.

### 2. Citation and Reference Management

Apply citation styles correctly: AMA (numbered superscript), Vancouver (numbered brackets), APA (author-date), Chicago (notes or author-date), IEEE (numbered brackets). Cite primary sources, include recent literature, and verify all citations against originals. See `references/citation_styles.md` for comprehensive style guides.

### 3. Figures and Tables

Use tables for precise numerical data; use figures for trends, patterns, and relationships. Each display item should be self-explanatory with complete captions, consistent formatting, labeled axes with units, and sample sizes. Follow the "one table/figure per 1000 words" guideline. See `references/figures_tables.md` for detailed best practices.

### 4. Reporting Guidelines

Follow established reporting standards for study-specific transparency: CONSORT (RCTs), STROBE (observational), PRISMA (systematic reviews), STARD (diagnostic accuracy), TRIPOD (prediction models), ARRIVE (animal research), CARE (case reports), SPIRIT (protocols), CHEERS (economic evaluations). See `references/reporting_guidelines.md` for checklists.

### 5. Writing Principles and Style

Clarity (precise language, defined terms, logical flow), conciseness (15-20 word average sentences, no redundancy), accuracy (exact values, consistent terminology), objectivity (no overstating, acknowledge conflicting evidence). See `references/writing_principles.md` for detailed guidance.

### 6. Field-Specific Terminology

Adapt language and conventions to the target discipline — biomedical, molecular biology, chemistry, ecology, physics, neuroscience, social sciences. Match audience expertise level, define terms strategically, maintain consistency, avoid field-mixing errors. See `references/field_terminology.md` for domain-specific guidelines.

### 7. Professional Report Formatting

For non-journal documents (research reports, white papers, technical reports, grant reports), use the `scientific_report.sty` LaTeX style package. Provides Helvetica typography, colored box environments (keyfindings, methodology, recommendations, limitations), professional tables, and scientific notation commands. Compile with XeLaTeX. For journal manuscripts and conference papers, use the `venue-templates` skill instead. See `references/professional_report_formatting.md` for full documentation.

### 8. Journal-Specific Formatting

Adapt manuscripts to journal requirements: follow author guidelines for structure/length/format, apply journal-specific citation styles, meet figure/table specifications, include required statements (funding, conflicts, data availability, ethics), and adhere to word limits.

---

## Two-Stage Writing Process

**Stage 1 — Outline with Key Points:**
Use research-lookup to gather literature. Create a structured outline with bullet points marking main arguments, key citations, data points, and logical flow. These bullet points are scaffolding only — not the final manuscript.

**Stage 2 — Convert to Full Paragraphs:**
Transform each bullet point into complete sentences. Add transitions between ideas (however, moreover, in contrast). Integrate citations naturally within sentences. Expand with context that bullet points omit. Ensure logical flow and vary sentence structure.

**Rules:**
- Bullet points are acceptable ONLY in Methods (inclusion/exclusion criteria, materials lists) and Supplementary Materials
- Never leave bullet points in Abstract, Introduction, Results, Discussion, or Conclusions
- Write abstracts as flowing paragraphs unless the journal explicitly requires structured format
- Read paragraphs aloud to check natural flow

---

## Manuscript Development Workflow

**Planning:** Identify target journal, review author guidelines, determine applicable reporting guideline, outline structure, plan figures/tables.

**Drafting** (two-stage process for each section): Start with figures/tables (the core data story). Then draft Methods -> Results -> Discussion -> Introduction -> Abstract -> Title. For each section: first outline with research-lookup, then convert to prose.

**Revision:** Check logical flow and "red thread," verify terminology consistency, ensure figures/tables are self-explanatory, confirm reporting guideline adherence, verify citations, check word counts, proofread.

**Final Preparation:** Format to journal requirements, prepare supplementary materials, write cover letter, complete submission checklists.

---

## Common Pitfalls

Top rejection reasons: inappropriate/incomplete statistics, over-interpretation of results, poorly described methods, small/biased samples, poor writing quality, inadequate literature review, unclear figures/tables, failure to follow reporting guidelines.

Writing quality issues to avoid: mixing tenses inappropriately (past for methods/results, present for established facts), excessive jargon or undefined acronyms, paragraph breaks disrupting logical flow, missing transitions, inconsistent notation.

---

## Integration with Other Skills

- **venue-templates**: Venue-specific formatting and writing style guides (Nature/Science, Cell Press, medical journals, ML/CS conferences)
- **research-lookup**: Literature search for Stage 1 outlines
- **scientific-schematics**: Publication-quality diagrams and figures
- **statistical-analysis**: Appropriate statistical presentations

Use this skill for general scientific writing principles, then consult venue-templates for venue-specific style adaptation.
