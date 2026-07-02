# Rebuttal Response Playbook

Use this reference for full rebuttal planning, evidence prioritization, response drafting, and tone repair.

## 1. Rebuttal Goal

A rebuttal should provide a decision-ready evidence package for the AC and reviewers.

The goal is not to prove that reviewers are wrong. The goal is to show that:

- core concerns have been clarified, weakened, or resolved
- the main contribution remains sound
- the acceptance risk has decreased
- remaining issues are fixable in the revision or camera-ready

For borderline papers, the reviewer usually does not hate the idea. The paper lacks enough positive reason for acceptance. The rebuttal should create that reason by removing uncertainty around novelty, evidence, scope, and writing.

## 2. First-Pass Review Triage

Do not draft immediately. Build a problem table first.

| Concern | Reviewer | Severity | Is it factually wrong? | Can evidence fix it? | Best response |
| --- | --- | --- | --- | --- | --- |
| novelty unclear | R1, R3 | high | no | yes, with prior-work table | rebuild distinction |
| missing baseline | R2 | high | partial | yes | add comparison |
| notation unclear | R1 | medium | no | no experiment needed | revise definition |
| extra setting requested | R4 | low/medium | no | hard | clarify scope and add limitation |

Concern classes:

1. **Decision blockers**: novelty, contribution, missing key baseline, unfair protocol, unsupported main claim, invalid theory, invalid metric.
2. **Misunderstandings**: the reviewer missed an experiment, confused notation, misunderstood scope, or criticized a claim the paper does not make.
3. **Fixable issues**: unclear writing, missing definition, weak figure caption, related work not positioned, appendix result not referenced.
4. **Scope mismatches**: the requested experiment is valuable but tests a different problem from the paper's stated claim.
5. **Low-value comments**: cosmetic or vague issues that should be answered briefly.

## 3. Priority Rules

Rebuttal space is limited. Allocate words by decision impact.

Priority order:

1. Shared concerns across multiple reviewers.
2. The lowest-score reviewer's main blocker.
3. Concerns from positive reviewers that could weaken their support.
4. Concerns the AC may see as decision-critical.
5. Small clarity or formatting items.

A strong rebuttal protects supporters, converts persuadable reviewers when possible, and gives the AC a clean basis for the meta-review.

## 4. Recommended Overall Structure

Use a hybrid structure unless the venue forces per-reviewer replies.

### AC-Facing Executive Summary

Open with a short paragraph that frames the decision.

Template:

```text
We thank the reviewers and AC for their careful reading and constructive feedback. The reviews raise three main concerns: [novelty / baseline / clarity]. We address them by clarifying [X], adding [Y], and revising [Z]. The new evidence shows [main result], supporting our central claim that [claim].
```

This paragraph is not decoration. It tells the AC what changed and how to read the rest of the response.

### Issue-Centered Response Blocks

Organize by the concerns that decide the outcome:

```text
1. Novelty and relation to prior work
Addresses R1-Q2 and R3-Q1.

2. Experimental setup and baselines
Addresses R2-Q1, R2-Q3, and R4-Q2.

3. Method motivation and ablation
Addresses R1-Q4.
```

This structure lets the AC see the major issues while preserving traceability to reviewers.

### Closing

Keep it short:

```text
We hope these clarifications, additional results, and planned revisions address the concerns and make the contribution and reliability of the work clearer.
```

Avoid unsupported statements such as "We strongly believe the paper deserves acceptance."

## 5. Single-Concern Response Formula

Use:

```text
Concern -> Acknowledge -> Clarify/Evidence -> Action -> Impact
```

Example:

```text
Concern. R2 asks whether our method is sufficiently different from XXX.
Response. We agree that the relation to XXX should be made clearer. The key difference is that XXX assumes [A], whereas our method addresses [B]. This difference leads to [technical consequence]. Under the same setting, our method improves over XXX by [number]. We will add this comparison to Sec. 2.3 and Table 1.
```

Do not treat "acknowledge" as "admit the reviewer is right." Acknowledge the importance of clarity, comparison, or evidence.

## 6. Novelty Objections

Do not answer novelty concerns by saying the method is novel.

Rebuild the difference along specific dimensions:

- problem setting
- assumption
- mechanism
- scope
- theoretical target
- experimental setting
- failure mode prior work cannot handle
- evidence that the difference matters

Template:

```text
We agree that the relation to XXX should be clarified. While both methods use [shared component], they address different problems. XXX assumes [A], whereas our method targets [B]. This distinction is important because [reason]. We will add a paragraph in Sec. X and a comparison table to make the difference explicit.
```

If some reviewers recognized the novelty:

```text
The reviews suggest that this point should be positioned more clearly. R2 and R3 appreciated [specific aspect], while R1 raised a concern about the distinction from XXX. We will revise the introduction and related work to emphasize the key distinction: [problem / assumption / mechanism].
```

Use disagreement as a positioning signal, not as a weapon against a reviewer.

## 7. Experiment and Baseline Objections

Experiment objections are often decisive because they are concrete.

Preferred order:

1. Add the experiment if it is feasible and central.
2. If not feasible, explain why it tests a different setting.
3. Provide alternative evidence for the underlying concern.
4. State the exact revision.

Added experiment template:

```text
Following the reviewer's suggestion, we added XXX as a baseline under the same protocol. The result shows [number], outperforming XXX by [number]. This supports our claim that [conclusion]. We will include this result in Table X.
```

Cannot-add template:

```text
We appreciate this suggestion. The proposed experiment evaluates [different setting], whereas our paper focuses on [current scope]. To address the underlying concern about [robustness / fairness / generalization], we provide [alternative analysis/result]. We will also add this scope discussion to Sec. X.
```

Avoid "due to time limitations" as the main reason. That tells the AC the concern remains open.

## 8. Method Motivation Objections

For comments such as "motivation unclear", "why does this work", or "design seems ad hoc", build a mechanism chain.

Use:

```text
failure mode -> module purpose -> prediction -> evidence -> revision
```

Template:

```text
The motivation for module XXX is to address [specific failure mode]. Without this module, the model tends to [problem]. To verify this, we added an ablation removing XXX. Performance drops from [A] to [B], supporting the necessity of the component. We will add this explanation to Sec. X and the ablation to Table Y.
```

If no ablation exists, do not overclaim. State what evidence is available and what will be added.

## 9. Clarity and Writing Objections

These are easy places to gain trust. Be specific.

Weak:

```text
We will improve the writing.
```

Strong:

```text
We will define XXX before Eq. (2), move the discussion of YYY from Appendix B to Sec. 3.2, and revise the caption of Fig. 2 to explain the dashed line.
```

Best when space allows:

```text
We will revise the paragraph as follows: "[revised paragraph]".
```

## 10. Factual Errors and Misunderstandings

Correct facts without humiliating the reviewer.

If the paper includes the requested result:

```text
We respectfully clarify that this comparison is included in Table 2 under the same protocol described in Sec. 4.1. We agree that the result should be easier to locate, and we will revise the table caption and Sec. 4.2 to highlight it.
```

If notation caused confusion:

```text
Our notation may have caused confusion. In our method, XXX refers to [definition], not [misinterpreted definition]. We will revise the notation and add an explicit definition before Eq. (3).
```

If the review contains a serious factual inconsistency:

```text
We would like to draw the AC's attention to a factual inconsistency in R2's comment. R2 states that [claim], but [Table/Figure/Section] reports [fact]. We will revise the manuscript to make this point easier to locate, and we respectfully hope this concern will be evaluated in light of the existing evidence.
```

Use this AC-facing version only for important factual errors. Do not use it for minor misunderstandings.

## 11. Scope Mismatches

Do not write only "beyond the scope." That sounds dismissive.

Use:

```text
valuable suggestion -> different setting -> current claim -> current evidence -> limitation or future work
```

Template:

```text
We appreciate this suggestion. However, this experiment evaluates [different task/setting], whereas our paper focuses on [current scope]. Our main claim is [claim], supported by [evidence]. We will add a discussion in Sec. X to clarify this boundary and include [suggested direction] as future work.
```

If the requested experiment is central to the paper's claim, do not call it scope mismatch. Add evidence or mark it as a real blocker.

## 12. Reviewer Disagreement

Reviewer disagreement can help, but handle it with care.

Bad:

```text
R2 and R3 understood our novelty, so R1 is wrong.
```

Good:

```text
The reviews suggest that our positioning could be made clearer. R2 and R3 appreciated [specific novelty], while R1 raised concerns about its distinction from XXX. We will revise Sec. 2.2 to contrast our work with XXX along three dimensions: assumption, mechanism, and setting.
```

This helps the AC see that the disagreement may come from positioning, not from a nonexistent contribution.

## 13. Expressions to Prefer and Avoid

Prefer:

- "We would like to clarify that..."
- "To avoid ambiguity, we will make this point explicit in Sec. X."
- "Our current presentation may not have sufficiently highlighted..."
- "We respectfully disagree with the conclusion that..."
- "The key distinction is..."
- "Following the reviewer's suggestion, we added..."
- "This addresses the underlying concern about..."

Avoid:

- "The reviewer is wrong."
- "This is obvious."
- "As clearly stated in the paper..."
- "The reviewer misunderstood..."
- "We apologize for everything."
- "Due to time limitation, we cannot do this."
- "We strongly believe our paper deserves acceptance."

Excessive apology can accidentally confirm the reviewer's negative framing. Correct facts and commit to specific revisions instead.

## 14. Templates

### General Opening

```text
We thank the reviewers and AC for their careful reading and constructive feedback. The reviews raise several important concerns regarding [novelty / experiments / clarity]. We address these concerns below by clarifying [X], adding [Y], and revising [Z]. The new evidence supports our main claim that [claim].
```

### Novelty

```text
We agree that the relation to XXX should be made clearer. While XXX and our method both involve [shared component], they differ in [problem setting / assumption / mechanism]. Specifically, XXX assumes [A], whereas our method addresses [B]. This distinction is important because [reason]. We will add a comparison in Sec. X and a summary table to make this difference explicit.
```

### Misunderstanding

```text
Our current presentation may have made this point difficult to notice. We would like to clarify that [fact]. This is shown in [Table/Figure/Section]. To avoid ambiguity, we will revise Sec. X by adding [specific sentence/explanation].
```

### Factual Correction

```text
We respectfully clarify that the paper does include [XXX]. It appears in [Table/Figure/Section] under [setting]. We agree that this result should be made more visible, and we will revise [specific location] accordingly.
```

### Added Experiment

```text
Following the reviewer's suggestion, we conducted an additional experiment on [XXX]. The results show [specific number/result], which supports our claim that [conclusion]. We will include this result in [Table/Figure/Section].
```

### Unable to Add Requested Experiment

```text
We appreciate this valuable suggestion. The proposed experiment evaluates [different setting], while our current work focuses on [current scope]. To address the underlying concern about [robustness/fairness/generalization], we provide [alternative analysis/result]. We will also add a discussion of this limitation in Sec. X.
```

### Reviewer Disagreement

```text
The reviews suggest that this point should be positioned more clearly. While R2 and R3 appreciated [positive aspect], R1 raised a concern about [negative aspect]. We will revise the introduction and related work to better highlight [key distinction], especially compared with [prior work].
```

### AC Factual Reminder

```text
We would like to draw the AC's attention to a factual inconsistency in R2's comment. R2 states that [claim], but [evidence in paper] shows [fact]. We will revise the manuscript to make this point easier to locate, and we respectfully hope this concern will be evaluated in light of the existing evidence.
```

## 15. Common Failure Modes

### Turning the rebuttal into an apology letter

Weak:

```text
We apologize for the unclear writing. We will revise it.
```

Better:

```text
We agree this point should be clearer. The intended meaning is [X]. We will revise Sec. 3.1 by adding [specific explanation].
```

### Treating the reviewer as the opponent

Weak:

```text
The reviewer did not understand our method.
```

Better:

```text
Our notation may have caused confusion. We clarify that XXX refers to [definition], and we will revise Eq. (2) accordingly.
```

### Making vague promises

Weak:

```text
We will add more experiments.
```

Better:

```text
We added a comparison with XXX on Dataset Y under the same protocol. The result improves from A to B and will be added to Table 3.
```

### Spending equal words on every comment

Use short answers for typos, formatting, and minor writing issues. Save space for novelty, evidence, and the main claim.

### Writing only to reviewers, not to the AC

Every response should let the AC judge:

- whether the concern still holds
- whether the negative review rests on a factual mistake
- whether the acceptance risk has decreased

## 16. Final Workflow

1. Read reviews calmly and separate correct criticism, misunderstanding, and unreasonable requests.
2. Build the issue table.
3. Write the AC summary before writing individual replies.
4. Add the highest-impact evidence first: key baseline, ablation, fairness check, robustness check, comparison table, or revised paragraph.
5. Compress language. Keep evidence; cut emotion.
6. Run a tone check for hostile, defensive, vague, or falsely apologetic phrasing.
7. Track every camera-ready promise.

## 17. Final Quality Checklist

Use this before delivery:

- The rebuttal has a clear AC-facing thesis.
- The main blockers are handled before minor comments.
- Each high-severity issue has evidence, action, and impact.
- Every reviewer concern is traceable to at least one response.
- No response invents an experiment result or overstates planned evidence.
- Factual corrections cite exact paper locations.
- Scope boundaries are honest.
- Positive reviewer comments are used to clarify positioning, not to attack another reviewer.
- The tone is calm and professional.
- Camera-ready promises are specific and feasible.
