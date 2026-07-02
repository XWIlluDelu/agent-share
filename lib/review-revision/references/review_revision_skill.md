# Review Revision Skill Framework

Use this reference for deep paper critique, revision planning, detailed editing, and final checklist work on existing manuscripts, rejected papers, review packages, and paper ideas that already have a concrete direction.

Sections 1-7 cover the core research spine (problem -> insight -> novelty -> idea -> method -> theory -> experiments). Sections 8-13 cover the evidence-presentation and compliance layers that reviewers attack even when the science is sound (statistics, figures, writing, naming, ethics, paper-type fit). Sections 14-17 cover reflection, revision planning, and the final checklist.

Do not assume every section applies. Pick the audits that match the paper type (see Section 13) and the user's requested mode.

## 1. Problem Selection Audit

Judge whether the paper sits on a real problem migration in the field rather than a local trick.

Ask:

- Does the problem affect a class of tasks, not one convenient experiment?
- Does the failure appear repeatedly across settings, models, data regimes, or task conditions?
- Would solving it change how others model, evaluate, or understand the direction?
- Does the paper identify a cognitive gap, not only a performance gap?
- Can the key variable be defined, controlled, and verified?
- Can the evidence chain be completed with stress tests, subgroup analysis, oracle tests, or boundary tests?
- Is the claim scope clear enough for reviewers to judge the contribution?

Useful distinction:

- **A-tier venue**: connect to a field-level question migration and expose a mechanism or evaluation shift.
- **B-tier venue**: constrain the problem to a clear task setting and prove the gap carefully.
- **C-tier venue**: make the boundary small but clean; create a reliable observation or benchmark-like failure case.

## 2. Insight Audit

Reject correct-but-useless insights.

Weak insight examples:

- "The model should capture long- and short-term dependencies."
- "Multimodal alignment is important."
- "RAG hallucination should be reduced."

Strong insight pattern:

> A method fails systematically in a specific condition because it mishandles a controllable variable.

Ask:

- Does the insight explain a concrete class of failures?
- Can it become a variable?
- Can ablation, subgroup analysis, or oracle experiments verify it?
- Does it distinguish when a signal helps from when it becomes noise?

Example:

In time-series forecasting, longer context does not always help. Historical value depends less on temporal distance and more on whether the historical pattern is structurally similar to the current forecasting scenario. This creates experiments around context length, similar-history retrieval, holiday type, horizon, and noise.

## 3. Novelty Audit

Flag weak novelty types:

1. **Module stitching**: A + B + C with a new framework name but no new mechanism.
2. **Terminology packaging**: ordinary operations renamed as semantic planning, uncertainty-aware selection, reflective reasoning, etc., without a new variable.
3. **Gain-as-novelty**: treating metric improvements as innovation without proving why the method works.
4. **Overclaimed novelty**: broad claims from narrow evidence, such as model-agnostic from one backbone or general hallucination from two QA datasets.

Look for strong novelty types:

1. **Clarified failure mode**: a vague problem becomes a reproducible, testable failure.
2. **Controllable key variable**: the paper isolates a variable that explains model behavior.
3. **Revealing setting**: a new evaluation setting shows that old high scores missed the real difficulty.

Self-test:

> If the method name and pipeline diagram disappear, can the failure mode, variable definition, and experimental conclusion still teach the field something?

If yes, novelty may be real. If no, the paper probably relies on packaging.

**Contribution-dilution check.** When a paper claims many parallel contributions (probing + graph + vocabulary + adversarial head + RL reward), reviewers read it as a stitched pipeline. Force a hierarchy: name the one core contribution, then demote every other module to a *supporting mechanism* that serves the core claim (evidence extraction, leakage control, auditability). A clean "one core, three supporting" structure survives review; five co-equal contributions usually do not.

## 4. Idea Audit

A novelty point is not yet a paper. A paper needs a claim-experiment spine.

Require:

- **Main claim**: one sentence the paper wants reviewers to believe.
- **Contribution type**: problem definition, mechanism explanation, method improvement, benchmark, dataset, theory, system, empirical analysis.
- **Core figure**: show where old methods break, what the paper changes, and how evidence verifies the change.
- **Claim-experiment matrix**: each major claim maps to experiments; each experiment has an interpretation if it fails.
- **Boundary**: what the paper does not solve.

Questions:

- What does the reviewer need to believe after reading?
- Which experiment proves each belief?
- What alternative explanation could still explain the result?
- Does the paper prove mechanism or only show a gain?

## 5. Method Audit

Method sections fail when they read like product manuals.

Each module must answer:

- Which failure mode does it target?
- Which variable does it control or transform?
- What observable prediction follows if the module is correct?
- Which experiment will test that prediction?

Preferred method-writing order:

1. failure mode
2. key variable
3. operation that changes the variable
4. prediction
5. implementation detail

Avoid adding modules that can only be justified by "it improves performance." Reviewers will ask whether the gain comes from more parameters, better prompts, a stronger backbone, cleaner data, or a changed evaluation setting.

**Implementation completeness.** A mechanism is not specified until a competent reader could reproduce it. Check that the paper actually gives: how the key variable is computed, how calibration/normalization maps are built, how context or prompts are constructed, how thresholds are chosen, how losses are weighted, and how each external dependency (OCR, retriever, detector, frozen model) is configured. A beautiful mechanism story with missing operational detail reads as hand-waving.

## 6. Theory & Proof Audit

Apply this when the paper states propositions, theorems, bounds, guarantees, or formal claims. Reviewers attack theory more harshly than prose because it is checkable.

Ask:

- Is every assumption stated explicitly, and is each realistic for the actual deployment setting (not just a clean abstraction)?
- Does the theorem describe what the method *actually does*, or an idealized proxy the implementation never realizes?
- Is the bound non-vacuous and tight enough to matter, or could it be satisfied trivially?
- Does the proof genuinely use each assumption, or are some assumptions decorative?
- If the theorem were false, would the method still work? If yes, the theory is intuition, not a guarantee — say so.
- Are regularity conditions, constants, and edge cases handled, or hidden in "it can be shown"?

Common failure pattern:

> Proposition assumes an optimal adversarial head, or a perfectly calibrated conditional model, that the implementation never enforces. The ablation (remove module → score drops) is then offered as proof of the theoretical claim. A score drop is not evidence that the assumed quantity (mutual information, likelihood ratio, calibration) actually behaves as claimed.

Repair moves:

- Downgrade wording: "estimator" → "calibrated plug-in surrogate under stated assumptions"; "guarantee" → "holds when assumption X is met"; "decouples" → "reduces measured leakage."
- Add direct measurement of the quantity the theory is about (calibration curve / ECE / Brier; mutual-information or HSIC / MINE estimate; leakage probe predicting the nuisance variable from the representation; threshold-transfer across datasets).
- State the assumption-violation regime as an explicit boundary.

Theory–practice alignment table:

| Formal claim | What it assumes | What the implementation guarantees | Direct evidence the assumption holds | Gap / wording fix |
| --- | --- | --- | --- | --- |
| likelihood-ratio ordering | calibrated conditional, monotone LR | uncalibrated frozen model output | reliability diagram, ECE | call it a surrogate prior |
| decoupling guarantee | optimal adversary | finite adversarial head, fixed training | leakage probe AUC, MI/HSIC | call it measured leakage reduction |

## 7. Experiment Audit

Experiments should remove reviewer doubts, not fill pages.

Required experiment roles:

1. **Problem validation**: prove the failure mode is not a single cherry-picked case.
2. **Core setting main result**: test the setting named in the claim, not only ordinary benchmarks.
3. **Mechanism ablation**: control variables and exclude alternative explanations.
4. **Oracle test**: give perfect retrieval, perfect evidence, text-converted visual evidence, or other idealized inputs to locate the bottleneck.
5. **Boundary test**: show where the method works, weakens, or fails.
6. **Case analysis**: explain which errors changed and why.

Bad ablation:

> Remove module A, drop 1 point. Remove module B, drop 2 points. Therefore each module works.

Better ablation:

> Fix backbone, data, prompt, and retrieval. Change only the claimed key variable. Then use random labels, shuffled evidence, single-evidence samples, or conflict-free samples to test whether the explanation still holds.

Claim-experiment matrix template:

| Claim | Needed Experiment | Alternative Explanation | Control |
| --- | --- | --- | --- |
| The error comes from evidence composition | oracle evidence + conflict split | retrieval quality caused the gain | fixed retriever |
| The verifier handles conflict | shuffled verifier signal | extra computation caused the gain | same compute budget |
| The method is robust across models | multiple backbones | one backbone artifact | matched prompts and checkpoints |

**Subgroup / breakdown analysis.** When the method's logic depends on a property that varies across the data (e.g., "works when context predicts the field"), an aggregate number hides where it fails. Break results down by the property the mechanism depends on (field type, language, template, difficulty, length) and report per-group performance, not just the mean.

## 8. Statistical Rigor & Reproducibility Audit

Aggregate point estimates are the easiest target for a skeptical reviewer.

Ask:

- Are results averaged over multiple seeds, with std / variance / confidence intervals reported?
- Is the improvement over baselines statistically significant, or could it sit inside the noise band?
- Are compute, parameter count, training data, and inference budget matched across compared methods?
- Did baselines get equal hyperparameter-search effort, or were they run once with defaults while the proposed method was tuned?
- Was the test set used once, or repeatedly tuned on (test-set leakage by iteration)?
- Is the reported number a single best run cherry-picked from many?
- For LLM/generation work: is the prompt, decoding temperature, and judge model held fixed and disclosed?

Reproducibility checklist:

- Code, configs, and seeds released or promised.
- Data splits, preprocessing, and license stated.
- Exact model versions / checkpoints / API snapshot dates.
- Prompts and templates in an appendix.
- Hardware and wall-clock cost reported.
- Enough detail that an independent group could rebuild the result without emailing the authors.

Red flag: a result that is "too good." Suspect train/test contamination, label leakage, an evaluation that rewards a shortcut, or a metric that does not measure the claimed capability. Add a contamination check or a shortcut-breaking control.

## 9. Figures & Tables Audit

Reviewers form an opinion from the teaser figure and the main table before they read the method. Treat visual evidence as a first-class claim carrier.

Teaser / page-1 figure:

- Does one figure make the problem or insight undeniable on first glance?
- Does it show the failure mode old methods suffer and the variable the paper introduces — not just a system block diagram?
- Is it honest (no exaggerated axes, no hand-picked best case presented as typical)?

Every figure:

- Caption is self-contained: a reader who jumps to the figure understands it without hunting through the text.
- Notation in the figure matches the text exactly.
- Axes labeled with units; legends readable; colorblind-safe palette; legible at print size and in grayscale.
- No chartjunk; the visual encodes the comparison the claim needs.

Main and ablation tables:

- The setting named in the claim is the highlighted comparison, not buried.
- Best result bolded; second-best marked if relevant; variance / error bars shown.
- Baselines are current and fairly configured (same OCR/split/compute as the proposed method).
- Column and metric definitions are stated; arrows (↑/↓) indicate direction.
- The table does not bury the one comparison a reviewer most wants to see.

## 10. Writing Audit

### Abstract

Write five functional sentences:

1. specific problem or contradiction
2. missing assumption in prior work
3. paper insight
4. method mechanism
5. strongest evidence and boundary

Avoid generic first sentences such as "Large language models have achieved remarkable success." Also avoid an abstract that lists every module as a buzzword — that signals a stitched pipeline before the reviewer reaches the method.

### Introduction

Use four paragraphs:

1. real contradiction in a task
2. why existing methods do not address it
3. why the failure mode is not an isolated case
4. paper's core judgment and contribution

Introduction should make reviewers accept the problem before asking them to accept the method.

### Related Work

Group by assumptions, not author lists.

For each closest group:

- what it solves
- what assumption it makes
- why that assumption leaves the paper's core question unanswered

Do not hide the closest prior work. If the reviewer finds it first, trust drops.

### Method

Do not write only input-module-output. Tie each module to a hypothesis and an experiment.

### Experiments

Order experiments by reviewer question:

1. Does the problem exist?
2. Does the method solve the core setting?
3. Does the mechanism hold?
4. Where are the boundary and cost?

### Conclusion and Limitations

Do not repeat the abstract.

Answer:

- What did the field misunderstand before this paper?
- What evidence changes that understanding?
- What remains unresolved?

Limitations must be honest enough to make the claims credible. A limitations paragraph that only lists generic future work reads as evasive. Name the specific conditions under which the method weakens (the same boundaries found in Sections 6–8), and the assumptions a follow-up must relax.

### Terminology and notation hygiene

- Every symbol is defined before use; notation is consistent across text, equations, figures, and tables.
- Acronyms are expanded on first use.
- One concept has one name throughout; do not alternate synonyms for the same module.
- Overclaiming words ("general", "robust", "universal", "model-agnostic", "guarantee", "first") are used only where evidence supports them.

## 11. Title, Naming & Positioning Audit

- **Title** states the contribution or insight, not only the domain. A reader should guess the claim from the title.
- **Method name** is memorable but does not overclaim a property the paper does not prove.
- **Positioning vs concurrent work**: identify recent arXiv / same-cycle papers; state what is genuinely different rather than ignoring them. Concurrent work that the reviewer knows but the paper omits damages trust.
- **Double-blind hygiene** (for blind venues): no deanonymizing links, repo names, acknowledgements, or "in our prior work [self-cite]" phrasing; self-citations are in third person.
- **Venue fit**: the contribution type matches the venue's expectations (mechanism-oriented A-tier work vs careful single-setting B-tier work vs benchmark or systems track). A strong paper aimed at the wrong track still gets rejected.

## 12. Ethics, Compliance & Responsible Research Audit

Most major venues now gate acceptance on these even when the science is strong.

- **Ethics / broader-impact statement** present and specific to the work, not boilerplate.
- **Data**: licensing, terms-of-use, consent, and provenance stated; no scraped data used against its license.
- **Personal / sensitive data**: PII handling, anonymization, and human-subjects / IRB approval where applicable.
- **Dual use and harm**: foreseeable misuse discussed for capabilities that enable it (forgery, surveillance, deception, security exploits); release decisions justified.
- **Reproducibility / responsible-AI checklist** required by the venue is completed truthfully.
- **Documentation artifacts**: dataset datasheet or model card where the contribution is a dataset or model.
- **Attribution**: prior code, data, and ideas credited; license compliance for reused assets.

For dual-use security or forensics work specifically, state the authorized / defensive framing and the intended-use boundary explicitly.

## 13. Paper-Type-Specific Audits

The core spine (Sections 1–7) is method-paper-centric. Re-weight the audit by contribution type.

- **Method / model paper**: emphasize Sections 5–8 (mechanism, theory, experiments, statistics). The risk is stitched-pipeline novelty.
- **Benchmark / evaluation paper**: emphasize construction validity, coverage, leakage resistance, annotation quality and agreement (inter-annotator κ), baseline saturation, and what the benchmark reveals that existing ones miss. Novelty lives in the revealing setting, not a method.
- **Dataset paper**: emphasize collection protocol, licensing/consent (Section 12), datasheet, bias and representativeness, splits, and maintenance/availability plan.
- **Theory paper**: Section 6 is primary. Emphasize assumption realism, proof correctness, tightness, and whether the result changes how the field should think — not just whether it is true.
- **Empirical study / analysis paper**: emphasize hypothesis clarity, controlled comparison, statistical rigor (Section 8), and that conclusions are not overgeneralized beyond the studied conditions. There may be no new method — the contribution is understanding.
- **Survey / position paper**: emphasize a defensible organizing taxonomy, coverage without bias, and a forward claim the field can act on — not a flat literature list.
- **System / applied paper**: emphasize the real-world constraint solved, deployment evidence, cost/latency, and ablations that isolate which design choice mattered.

## 14. Deep Reflection Prompts

Use these prompts when the user asks for deep reflection or when a paper feels superficially complete.

- What would remain valuable if the method were removed?
- Which claim would the harshest reviewer attack first?
- Which result could be explained by a stronger backbone, cleaner data, prompt changes, or metric choice?
- Is the strongest table testing the strongest claim?
- Does the closest related work already answer the real question?
- Which figure should appear on page one to make the problem undeniable?
- What is the smallest experiment that could falsify the paper's story?
- Is the paper solving the problem or only avoiding hard cases?
- Are limitations honest enough to make the claims credible?
- Would each theorem survive its own assumptions being false in the real setting?
- Is any gain inside the noise band once seeds and variance are considered?
- Is any result "too good" — explainable by contamination, leakage, or a shortcut?
- Are there five co-equal contributions where there should be one core and three supporting?
- What single sentence will the area chair remember and repeat in the meta-review?
- If a reviewer ran one breakdown the authors did not show, where would the method fail?

## 15. Rebuttal / Review Response Boundary

Use this workflow to predict likely reviewer objections before submission or to plan manuscript revisions after reviews. Post-review manuscript revision is in scope; writing the response letter is not. For actual rebuttal drafting, review-response letters, AC-facing summaries, reviewer concern triage, or tone repair after reviews arrive, use the `rebuttal-response` skill.

## 16. Revision Plan Template

| Priority | Issue | Why It Matters | Exact Fix | Section/Figure/Table | Reviewer Risk Addressed |
| --- | --- | --- | --- | --- | --- |
| P0 | Main claim unclear | Reviewers cannot judge contribution | Rewrite abstract sentence 1 and intro paragraph 4 | Abstract, Intro | novelty unclear |
| P1 | Ablation only deletes modules | Mechanism unsupported | Add variable-controlled ablation | Table 4 | claims unsupported |
| P2 | Related work is a list | Novelty boundary hidden | Regroup by assumptions | Related Work | similar prior work |

Priority definitions:

- **P0**: paper-level issue that can cause rejection (unclear main claim, collapsed novelty, unsupported claim, wrong core setting, missing closest prior work, broken theory assumption).
- **P1**: evidence-chain issue that weakens confidence (weak ablation, missing oracle/boundary test, no variance/significance, uncontrolled variables, no subgroup breakdown).
- **P2**: writing or presentation issue that reduces clarity (vague abstract, generic intro, literature-list related work, manual-style method, figure/table problems, notation drift).

## 17. Final Checklist

Use Pass, Risk, Blocker, or Unknown.

### Problem and Insight

- The paper names a concrete failure mode.
- The failure is important beyond one toy setting.
- The insight explains why the failure happens.
- The key variable can be controlled.

### Novelty and Idea

- Closest prior work is acknowledged.
- Novelty does not rely on naming or pipeline complexity.
- The contribution type is clear.
- Main claim fits the evidence scope.
- Boundaries are explicit.
- There is one core contribution, not five co-equal ones.

### Method

- Each module maps to a failure mode.
- Each module changes a defined variable.
- Each module has a corresponding experiment.
- No module exists only because it improves performance.
- Implementation detail is sufficient to reproduce the mechanism.

### Theory (if any)

- All assumptions are stated and realistic for the actual setting.
- The theorem describes what the method does, not an idealized proxy.
- The proof uses its assumptions; bounds are non-vacuous.
- The quantity the theory is about is measured directly, not inferred from a score drop.
- Wording matches what is proven (no "guarantee" without one).

### Experiments

- Problem validation exists.
- Main result tests the core setting.
- Ablation excludes alternative explanations.
- Oracle or stress tests locate the bottleneck.
- Boundary and subgroup breakdowns report where the method weakens.
- Case studies explain metric changes.

### Statistics and Reproducibility

- Multiple seeds with variance / significance reported.
- Compute, parameters, data, and search effort matched across methods.
- No test-set tuning; no cherry-picked single run.
- No "too good" result left unexplained (contamination / leakage / shortcut checked).
- Code, configs, prompts, model versions, and cost are released or promised.

### Figures and Tables

- A page-1 figure makes the problem or insight undeniable and is honest.
- Captions are self-contained; notation matches the text.
- The claimed setting is the highlighted comparison; variance is shown; baselines are fair.

### Writing

- Abstract states problem, gap, insight, method, evidence, and boundary.
- Introduction makes the problem feel necessary.
- Related work is grouped by assumptions.
- Method explains judgments before details.
- Experiments follow reviewer questions.
- Conclusion states what changed in understanding and what remains open.
- Notation and terminology are consistent; overclaiming words are justified.

### Title, Positioning, and Compliance

- Title and method name reflect the contribution without overclaiming.
- Concurrent work is positioned, not ignored.
- Double-blind hygiene is intact (blind venues).
- Ethics / broader-impact / data-license / reproducibility checklist requirements are met.
- Venue and track fit the contribution type.

### Submission Risk

- List the top three reviewer objections.
- For each objection, name the planned fix or explain why the risk is acceptable.
