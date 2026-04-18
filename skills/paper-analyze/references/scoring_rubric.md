# scoring rubric

Use this rubric to make the final judgment more discriminative. The overall score is **not** a mechanical average; it must reflect the most severe unresolved concern.

## Global rules

- Score only after the paper type has been identified.
- Tie every subscore to concrete evidence from the paper.
- Distinguish `paper says` from `I conclude`.
- Penalize claim inflation: if conclusions are stronger than evidence, lower **interpretation discipline** first, then cap overall score if needed.
- A `Critical` flaw usually caps the overall score at **7.5/10** unless the paper’s main contribution survives the flaw cleanly.
- Multiple unresolved `Important` concerns usually cap the overall score at **8.2/10**.
- A paper with elegant framing but weak evidence should not receive a high overall score.

## Dimensions

### 1) Problem importance / question clarity
**What it measures**: whether the paper addresses a sharp, meaningful question rather than a vague or inflated one.

- **9-10**: tackles an important question with unusually clear framing and a well-defined target.
- **7-8**: meaningful question, mostly clear, some framing looseness.
- **5-6**: decent question but partly fuzzy, derivative, or weakly motivated.
- **3-4**: poorly framed or low-value question.
- **1-2**: trivial, confused, or misframed question.

Route notes:
- **Theory**: does the formal question actually matter, or only produce elegant math?
- **Methods**: is the claimed bottleneck real and current?
- **Neuroscience**: is the cognitive/neural claim sharp enough to be tested by the task?

### 2) Novelty / contribution sharpness
**What it measures**: whether there is a real dominant contribution rather than a pile of loosely related additions.

- **9-10**: clear, distinctive, mechanism-level contribution or conceptual advance.
- **7-8**: solid improvement or synthesis with a clear center of gravity.
- **5-6**: moderate or incremental contribution.
- **3-4**: mostly recombination or reframing.
- **1-2**: little genuine novelty.

Route notes:
- **Theory**: separate theorem novelty from packaging.
- **Methods**: separate mechanism novelty from tuning/scale effects.
- **Neuroscience**: separate analysis novelty from stronger interpretation.

### 3) Method or theoretical soundness
**What it measures**: whether the core technical object is coherent, internally justified, and not obviously broken.

- **9-10**: technically rigorous, well-specified, and conceptually tight.
- **7-8**: strong core with minor weaknesses.
- **5-6**: workable but with notable assumptions or underspecified pieces.
- **3-4**: substantial technical fragility.
- **1-2**: unsound core method or theory.

Route notes:
- **Theory**: inspect assumptions, theorem scope, proof relevance, and failure regimes.
- **Methods**: inspect interfaces, training signal, and whether the claimed mechanism is really the one being tested.
- **Neuroscience**: inspect design logic, model-analysis fit, and whether the analysis supports the claim type.

### 4) Evidence strength
**What it measures**: whether the evidence directly supports the main claims.

- **9-10**: decisive evidence for the core claims; claim-to-evidence alignment is strong.
- **7-8**: good evidence with some gaps.
- **5-6**: partial support; some key claims are under-tested.
- **3-4**: weak or indirect support.
- **1-2**: evidence does not support the main claims.

Route notes:
- **Theory**: experiments, if present, should test the theoretical claim rather than decorate it.
- **Methods**: matched baselines and decisive ablations matter more than benchmark breadth.
- **Neuroscience**: controls and correct unit of inference matter more than a striking visualization.

### 5) Experimental / analytical rigor
**What it measures**: whether evaluation design, statistics, and diagnostics are appropriate and careful.

- **9-10**: rigorous evaluation or analysis design with strong controls and careful uncertainty handling.
- **7-8**: generally sound with manageable weaknesses.
- **5-6**: acceptable but incomplete or under-controlled.
- **3-4**: weak rigor; important checks missing.
- **1-2**: seriously inadequate rigor.

Route notes:
- **Theory**: if empirical sections exist, ask whether they stress the formal claim.
- **Methods**: check fairness, ablation causality, robustness, and failure analysis.
- **Neuroscience**: check controls, subject/session structure, multiple comparisons, and across-subject robustness.

### 6) Interpretation discipline
**What it measures**: whether the paper’s conclusions are proportional to its evidence.

- **9-10**: claims are carefully calibrated; speculation is labeled.
- **7-8**: mostly disciplined with minor overreach.
- **5-6**: noticeable inflation or conflation of result and interpretation.
- **3-4**: frequent overclaiming.
- **1-2**: conclusions substantially outrun evidence.

Route notes:
- **Theory**: do not let broad language exceed theorem scope.
- **Methods**: do not let small gains imply paradigm shifts.
- **Neuroscience**: do not let decoding, tuning, or latent geometry automatically imply mechanism or causality.

### 7) Reproducibility / transparency
**What it measures**: whether a careful reader could understand, reproduce, or at least audit the work.

- **9-10**: assumptions, setup, and implementation details are unusually transparent.
- **7-8**: enough detail to follow with modest ambiguity.
- **5-6**: important details missing.
- **3-4**: hard to reproduce or audit.
- **1-2**: opaque.

Route notes:
- **Theory**: are assumptions and notation explicit enough to audit the reasoning?
- **Methods**: are data filters, tuning budgets, and implementation tricks exposed?
- **Neuroscience**: are preprocessing, exclusion criteria, and analysis choices clear?

### 8) Scientific or practical impact
**What it measures**: whether the paper is likely to matter beyond the immediate benchmark or case study.

- **9-10**: field-shaping or broadly reusable insight.
- **7-8**: strong likely downstream relevance.
- **5-6**: moderate impact, local relevance.
- **3-4**: narrow or short-lived relevance.
- **1-2**: little likely impact.

Route notes:
- **Theory**: impact can come from a better language for thinking, not only direct application.
- **Methods**: impact depends on whether gains are robust and portable.
- **Neuroscience**: impact depends on whether the study changes how we interpret a broader class of findings.

## Score shaping rules

### Fatal flaw / score cap examples
- The main claim is not actually tested.
- Baselines are fundamentally unfair.
- Theorem scope is narrow but the paper speaks broadly without acknowledging it.
- The neuroscience claim relies on an invalid unit of analysis or missing critical controls.
- Correlational evidence is presented as mechanism or causality.

### Concern severity interaction
- `Critical`: likely changes the headline takeaway or score cap.
- `Important`: weakens confidence materially but may not overturn the main result.
- `Minor`: improves clarity or robustness but does not change the main judgment.

### Relationship labels for related work
- `improves`: clear improvement over prior work on a comparable target
- `extends`: extends an existing route or framework
- `compares`: directly contrasts with another route
- `follows`: belongs to the same trajectory without clear improvement claim
- `cites`: cited or historically connected
- `related`: conceptually connected but looser relation
