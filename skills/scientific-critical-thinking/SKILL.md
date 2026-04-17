---
name: scientific-critical-thinking
description: 'Critically evaluate scientific claims, experimental designs, and evidence quality. Use when stress-testing a paper''s methodology, identifying confounders/biases/logical flaws, applying evidence grading (GRADE, Cochrane RoB), or reviewing your own study design. Triggers: 批判性分析, 实验设计有问题吗, 这个研究有什么缺陷, critical analysis, evaluate evidence, methodology flaws, identify biases, assess study design, 批评一下这篇文章, what''s wrong with this paper, confounders. For open-ended ideation use scientific-brainstorming.'
allowed-tools: Read Write Edit Bash
license: MIT license
metadata:
    skill-author: K-Dense Inc.
---

# Scientific Critical Thinking

## Overview

Systematic evaluation of scientific rigor: methodology, experimental design, statistical validity, biases, confounding, and evidence quality using GRADE and Cochrane ROB frameworks.

## When to Use

- Evaluating research methodology and experimental design
- Assessing statistical validity and evidence quality
- Identifying biases, confounding, and logical fallacies
- Reviewing scientific claims and conclusions
- Conducting systematic reviews or meta-analyses
- Applying GRADE or Cochrane risk of bias assessments

---

## Core Capabilities

### 1. Methodology Critique

Evaluate study design appropriateness, internal/external/construct/statistical-conclusion validity, control and blinding implementation, and measurement quality. Check whether the design can support the causal claims being made, whether randomization and blinding are adequate, and whether instruments are validated.

**Reference:** `references/scientific_method.md` (principles) and `references/experimental_design.md` (design checklist).

### 2. Bias Detection

Systematically review for cognitive biases (confirmation bias, HARKing, cherry-picking), selection biases (sampling, attrition, survivorship), measurement biases (observer, recall, social desirability), analysis biases (p-hacking, outcome switching, selective reporting), and confounding. Check preregistration status and compare registered vs. published outcomes.

**Reference:** `references/common_biases.md` (comprehensive taxonomy with detection and mitigation strategies).

### 3. Statistical Analysis Evaluation

Assess sample size and power, test appropriateness and assumption compliance, multiple comparison corrections, p-value interpretation, effect sizes and confidence intervals, missing data handling, and regression/modeling issues. Flag common pitfalls: correlation-as-causation, regression to the mean, base rate neglect, Simpson's paradox.

**Reference:** `references/statistical_pitfalls.md` (detailed pitfalls and correct practices).

### 4. Evidence Quality Assessment

Evaluate evidence strength using the study design hierarchy (SR/MA > RCT > cohort > case-control > cross-sectional > case report > opinion). Apply GRADE when appropriate: downgrade for risk of bias, inconsistency, indirectness, imprecision, publication bias; upgrade for large effects, dose-response, or confounders favoring null. Assess convergence across independent replications, methods, and research groups.

**Reference:** `references/evidence_hierarchy.md` (hierarchy, GRADE system, quality assessment tools).

### 5. Logical Fallacy Identification

Detect fallacies in scientific arguments: causation fallacies (post hoc, correlation=causation, reverse causation), generalization fallacies (hasty generalization, ecological fallacy), authority/source fallacies, statistical fallacies (base rate neglect, prosecutor's fallacy), and science-specific fallacies (Galileo gambit, unfalsifiability). Name the fallacy, explain why the reasoning fails, and identify what evidence would support a valid inference.

**Reference:** `references/logical_fallacies.md` (comprehensive catalog with examples and detection strategies).

### 6. Research Design Guidance

Guide study planning: refine research questions (specific, falsifiable, feasible), select appropriate designs, plan bias minimization (randomization, blinding, confound control), conduct a priori power analysis, choose validated instruments, prespecify analyses, and commit to transparency (preregistration, reporting guidelines like CONSORT/STROBE/PRISMA, data sharing).

**Reference:** `references/experimental_design.md` (comprehensive design checklist from question to dissemination).

### 7. Claim Evaluation

Systematically evaluate scientific claims for validity and support.

1. **Identify the claim** — What exactly is claimed? Causal, associational, or descriptive? How strong (proven, likely, suggested, possible)?
2. **Assess the evidence** — Direct or indirect? Sufficient for the claim strength? Are alternative explanations ruled out?
3. **Check logical connection** — Do conclusions follow from data? Are there logical leaps? Is correlational data used for causal claims?
4. **Evaluate proportionality** — Is confidence proportional to evidence strength? Are hedging words appropriate? Is speculation labeled?
5. **Check for overgeneralization** — Do claims extend beyond the sample? Are population restrictions and context-dependence acknowledged?
6. **Red flags** — Causal language from correlational studies; "proves" or absolute certainty; cherry-picked citations; ignoring contradictory evidence; dismissing limitations; extrapolation beyond data.

When providing feedback: quote the problematic claim, explain what evidence would be needed, suggest appropriate hedging, and distinguish data (what was found) from interpretation (what it means).

---

## Application Guidelines

**Be constructive:** Identify strengths alongside weaknesses. Suggest improvements, don't just criticize. Distinguish fatal flaws from minor limitations.

**Be specific:** Point to specific instances ("Table 2 shows...", "In the Methods section..."). Quote problematic statements. Reference specific principles or standards violated.

**Be proportionate:** Match criticism severity to issue importance. Consider whether issues affect primary conclusions. Acknowledge uncertainty in your own assessments.

**Apply consistent standards:** Use the same criteria across studies. Don't apply stricter standards to findings you dislike. Base judgments on methodology, not results.

**Structure feedback as:** (1) Summary, (2) Strengths, (3) Concerns by severity (critical → important → minor), (4) Specific recommendations, (5) Overall assessment of evidence quality and supportable conclusions.

**When uncertain:** Acknowledge it. Ask clarifying questions about methodological details. Provide conditional assessments ("If X was done, then Y; if not, Z is a concern").
