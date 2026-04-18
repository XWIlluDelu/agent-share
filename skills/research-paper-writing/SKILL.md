---
name: research-paper-writing
description: Improve academic paper writing quality for Neuroscience/ML-style papers with clear section structure, paragraph flow, and reviewer-facing presentation. Use when drafting or revising Abstract, Introduction, Related Work, Method, Experiments, or Conclusion; polishing figures/tables; checking claim-support alignment; or performing self-review before submission.
---
# Research Paper Writing

## Overview

Use this skill to rewrite a research paper into a reviewer-friendly, high-clarity draft.
By default, return manuscript-ready prose that the user can paste back into the paper directly.
Use outlines, reverse outlines, claim-evidence audits, and skeptical review as internal scaffolding unless the user explicitly asks for diagnostics.

## Core Workflow

1. Clarify the paper story before sentence-level edits.
2. Load only the section-specific guidance needed from `references/`.
3. Build a hidden mini-outline before drafting prose.
4. Rewrite paragraph-by-paragraph so each paragraph has one main message, but do not expose paragraph-role labels in the final draft.
5. Run reverse outlining internally after writing each section.
6. Check every major claim in Abstract, Introduction, and Results against the actual evidence.
7. Run adversarial self-review internally with `references/paper-review.md` before finalizing.

## Global Principles

1. Keep one paragraph for one main message.
2. Make the paragraph message clear early, but avoid formulaic topic-sentence repetition.
3. Make nouns self-contained; define new terms before reusing them.
4. Maintain sentence-to-sentence flow through cause, contrast, consequence, refinement, or example.
5. Keep terminology stable across the full paper.
6. Treat visual quality as core content, not decoration.
7. Avoid writing that makes the work look like a small patch on a naive baseline.
8. Keep formatting consistent and tidy.
9. Unless the user asks for diagnostics, the final output must read like final paper prose, not like coaching notes.
10. Do not expose role labels such as `[Opening]`, `[Challenge]`, `[Method]`, `[Advantage]`, or `[Evidence]` in the final draft.
11. Do not expose numbered wrappers, checklists, or claim maps unless the user explicitly asks for review artifacts.
12. Use section logic as hidden scaffolding, not as a visible rhetorical template.

## Paragraph Clarity Check

Use this check internally whenever the user asks whether a paragraph flows or is clear, or when a section draft feels weak.

1. Read as an external reader:
   - Does this paragraph have one explicit message?
   - Are all key nouns and terms readable without hidden context?
   - Does each sentence connect to the previous one with a clear relation?
2. Run reverse outlining for the current section:
   - Write down the thesis or main claim.
   - Write down each paragraph message.
   - Write down the evidence or explanation under each paragraph.
   - Check mapping: paragraph message -> thesis, and evidence -> paragraph message.
   - Revise or remove any paragraph that cannot be mapped cleanly.
3. If flow is still weak, use temporary transitions or headers during drafting, then remove them before finalizing.

Source reference:
- `references/does-my-writing-flow-source.md`

## Section Guides

Load only the needed section file:

- Introduction: `references/introduction.md`
- Abstract: `references/abstract.md`
- Related Work: `references/related-work.md`
- Method: `references/method.md`
- Experiments: `references/experiments.md`
- Conclusion: `references/conclusion.md`
- Paper review: `references/paper-review.md`
- Paragraph clarity source: `references/does-my-writing-flow-source.md`
- Example bank index: `references/examples/index.md`

## Paper Review Core Points

Use `references/paper-review.md` for the full checklist and workflow, but keep review artifacts internal unless the user explicitly asks for critique or audit output.

1. Treat claim-evidence alignment as a hard constraint, especially for Abstract, Introduction, and Results.
2. Perform adversarial writing: read as a skeptical reviewer and resolve high-risk questions before finalizing.
3. Use self-review to revise the prose, not to append coaching notes by default.
4. Only surface reviewer-style question lists when the user asks for review help rather than a clean draft.

## Claim-Support Calibration

Use these labels internally when judging claims:

- `supported`: the reported evidence directly matches the claim's scope, comparator, and condition.
- `suggestive`: the evidence points in that direction, but the scope is narrower, indirect, partially tested, or missing key controls.
- `deferred/unsupported`: the claim is not directly established here, depends on later sections, or is better framed as motivation, hypothesis, or future work.

Map claim strength to language:

- `supported` -> `shows`, `demonstrates`, `outperforms`, `recovers`
- `suggestive` -> `suggests`, `is consistent with`, `indicates`, `may reflect`
- `deferred/unsupported` -> weaken, move, or remove the claim rather than presenting it as an established result

Hard rules:

1. Abstract, Introduction, and Results claims must not be stronger than the evidence actually shown.
2. A claim that is only promised for a later section is not yet `supported` in the current section.
3. Definitional or derivational support does not automatically count as empirical support.
4. If evidence is mixed or partial, write the narrower claim.
5. If a strong claim cannot be cleanly defended, weaken or delete it.

## Execution Rules

1. Build a hidden mini-outline before drafting prose.
2. For each subsection, internally check motivation, design, and technical advantage when applicable, but realize them as natural prose.
3. Do not load all section references at once; load only the specific guide needed for the current edit target.
4. Keep section-local rhetorical logic, but avoid forcing every section into the same fixed pattern.
5. Vary paragraph length and sentence openings enough to avoid a template-like cadence.
6. Before finalizing, run an internal self-review for clarity, flow, terminology consistency, unsupported claims, and missing evidence.
7. When the user asks for a clean draft, revise based on that internal review and return only the cleaned prose.
8. When the user asks for critique, audit, or diagnosis, you may additionally provide outline, checklist, paragraph logic notes, or a claim-support audit.

## Output Contract

### Default drafting mode

When asked to rewrite or draft a manuscript section, return manuscript-ready prose only.
The output should be directly pasteable into the paper.
Do not include:
- outline bullets
- paragraph-role labels
- self-review checklist
- claim-evidence map
- meta commentary about what you changed

### Optional audit mode

Only when the user explicitly asks for review, critique, diagnosis, or support material, optionally add one or more of:
- a brief outline
- a short self-review checklist
- paragraph-level logic notes
- a claim-support audit

### Fallback behavior

If the requested wording would overclaim relative to the provided evidence, weaken the prose directly.
Only explain the downgrade separately if the user asked for audit-style feedback.
