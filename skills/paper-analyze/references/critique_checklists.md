# critique checklists

Use these checklists after identifying the paper type. They are not generic questionnaires; they are prompts for where the analysis pressure should go.

## 1) Empirical methods papers

### First extract
- What problem is being solved, and why do existing methods fail?
- What is the smallest mechanism that seems to drive the claimed gain?
- Which parts are core novelty vs engineering scaffolding?

### Core critique questions
- **Problem anchor**: does the method actually solve the bottleneck stated in the title/intro, or a weaker/easier variant?
- **Mechanism of gain**: what exact component or training signal is supposed to cause improvement?
- **Baseline fairness**: are comparisons matched in backbone, data, compute, tuning budget, augmentation, and evaluation protocol?
- **Ablation causality**: do ablations isolate necessity, sufficiency, and interaction effects, or only remove pieces mechanically?
- **Metric-task alignment**: do reported metrics genuinely measure the claimed capability?
- **Failure cases**: what regimes look weak, unstable, or underexplained?
- **Reproducibility bottlenecks**: what hidden tricks, data filters, schedules, or heuristics seem load-bearing?

### Evidence standards
- Strong evidence: matched baselines, decisive ablations, robustness checks, and results that support the exact claim.
- Weak evidence: only headline gains, mismatched baselines, or ablations that do not isolate the key mechanism.

### Common failure modes
- Contribution sprawl
- Gain likely comes from scale/tuning rather than the claimed idea
- Overclaiming from small benchmark deltas
- “Novel” method is mostly a recombination of known parts

## 2) Theory / model papers

### First extract
- What is the main theorem / formal claim / model insight?
- What assumptions are load-bearing?
- What does the result explain, guarantee, or construct?

### Core critique questions
- **Question sharpness**: is the formal problem precise and worth solving?
- **Assumptions**: which assumptions are structural, which are convenience assumptions, and which make the result narrow?
- **Theorem scope**: what exactly is proved, and what remains conjectural or empirical?
- **Proof relevance**: does the proof strategy reveal mechanism, or only certify a technical fact?
- **Toy-to-general gap**: is the main insight only clean in a stylized setting?
- **Failure regimes**: when would the theory stop being informative or meaningful?
- **Empirical grounding**: if experiments exist, do they test the real theoretical claim or just show plausibility?

### Evidence standards
- Strong evidence: precise assumptions, meaningful theorem scope, proof idea tied to insight, and clear limits of applicability.
- Weak evidence: theorem statements that are technically correct but practically uninformative, or experiments that do not stress the formal claim.

### Common failure modes
- Elegant math attached to a weak question
- Main theorem depends on unrealistic assumptions but the paper speaks broadly
- Experiments only decorate the theory without testing it
- The paper “explains” more than it truly proves

## 3) Neuroscience / experimental papers

### First extract
- What neural or cognitive claim is actually being made?
- What is the unit of analysis: subject, session, neuron, voxel, trial, region?
- What distinguishes data from interpretation?

### Core critique questions
- **Task design**: does the paradigm isolate the claimed cognitive variable?
- **Controls**: what alternative explanations are ruled out, and what remains open?
- **Sample and unit-of-analysis**: are conclusions made at the right level given subjects / sessions / recorded units?
- **Statistics**: are uncertainty, effect sizes, multiple comparisons, and across-subject robustness handled credibly?
- **Causality caution**: are the claims correlational, predictive, mechanistic, or causal?
- **Interpretation discipline**: does the paper overread decoding / tuning / latent geometry as mechanism?
- **Confounds**: motor, sensory, task difficulty, arousal, selection bias, session pooling, preprocessing choices.

### Evidence standards
- Strong evidence: clean task logic, appropriate controls, correct unit of inference, statistics proportional to the claim, and explicit limits on interpretation.
- Weak evidence: decoding or trajectory geometry is treated as mechanism without ruling out simpler alternatives.

### Common failure modes
- Reverse inference
- Session pooling treated as single-trial population mechanism
- Correlational patterns described as computation
- Interpretation stronger than control conditions justify

## 4) Hybrid papers

If the paper is genuinely hybrid, do not average all routes equally.
- Name the primary route.
- State which secondary route matters.
- Use the primary route to judge the main contribution.
- Use the secondary route to audit support, not to redefine the paper.

## Output discipline

For every paper type:
- Separate `Author claims`, `Paper evidence`, and `My judgment`.
- Mark major judgments as `supported`, `weakly supported`, or `inferred`.
- Rank concerns as `Critical`, `Important`, or `Minor`.
- Prefer the smallest adequate criticism over a long grab-bag of generic complaints.
