# Systems and cognitive neuroscience: Core concepts

> This guide helps agents acquire shared scientific background, recognize the field's terminology and writing conventions, and develop informed research judgment. It focuses on higher cognition, with particular attention to mathematics, physics, reasoning, and language.

Systems neuroscience studies how interacting neurons and circuits support behavior. Cognitive neuroscience connects their activity with the organization of perception, memory, knowledge, and thought. Behavioral experiments, neural recordings, computational models, and interventions provide complementary ways to study these relationships. The organizing questions are what information is available, how it is structured, how experience changes it, and how it becomes useful for the current task.

## 1. Neural systems, experiments, and data

### Organization across scales

Neurons integrate synaptic inputs and generate action potentials, or **spikes**. Membrane properties, dendrites, and synaptic interactions shape their responses. Feedforward pathways transform inputs, feedback returns information to earlier processing stages, and recurrent connections allow previous activity to influence subsequent processing. A recorded **population** is a sample of jointly analyzed neurons; a **circuit** additionally concerns their connectivity and interactions.

Functional specialization coexists with distributed processing. Sensory and association systems transform and combine information; hippocampal systems contribute to episodic and relational memory; temporal systems support aspects of conceptual knowledge and language. The **multiple-demand (MD) network**, spanning frontal and parietal regions, participates across tasks with different content. Its activity can reflect the organization of relevant information, rules, and successive subgoals. As goals change, these populations can flexibly express different task variables.

Language-selective and MD populations can occupy nearby territory while having different response profiles. **Functional localizers** use task contrasts to identify populations with particular response profiles, typically in data independent of the target comparison. They complement anatomical labels. This matters when comparing language, mathematics, and reasoning: understanding a verbal instruction, representing a mathematical relation, maintaining an intermediate result, and selecting an answer make different demands within one trial.

Evidence from functional imaging and some patients with severe language impairment shows that particular nonlinguistic calculations or reasoning abilities can remain available when language processing is disrupted. Such dissociations motivate distinguishing the mature systems used for these operations. Language can nevertheless contribute to acquiring concepts, communicating explanations, or using a verbal strategy. Adult functional organization and the developmental role of language are therefore complementary questions.[^functional-organization]

### What the measurements capture

| Measurement | Common data | Scientific interpretation |
|---|---|---|
| Behavior, eye tracking, and movement | Choices, reaction times, continuous reports, gaze, pupil size, trajectories | Performance, information sampling, strategy, and process timing. Movement and arousal can be explanatory variables rather than merely nuisance signals. |
| Intracellular electrophysiology | Membrane voltage and currents | Current clamp records voltage under controlled current injection; voltage clamp measures the current required to hold a command voltage. |
| Extracellular electrophysiology | Waveforms, sorted spike times, single-unit and multi-unit activity | Event-based samples of neuronal output. Spike sorting estimates which events belong to which putative units. |
| Local field potentials (LFP), electrocorticography (ECoG), stereo-EEG (sEEG), electroencephalography (EEG), and magnetoencephalography (MEG) | Electrical or magnetic time series | Population currents observed at different locations and spatial scales; source geometry and signal mixing shape the measurements. |
| Calcium imaging | Fluorescence movies, cellular traces, inferred events | Indicator-dependent activity signals. Motion correction, cell extraction, and activity inference introduce successive estimation steps. |
| Functional MRI (fMRI) | Blood-oxygen-level-dependent (BOLD) time series and voxel patterns | Hemodynamic responses from which task effects or activity patterns are estimated. |

Field potentials are not measurements of mean firing rate. Referencing, volume conduction, spatial summation, and recording geometry affect their relationships.[^fields]

Calcium indicator kinetics spread the fluorescence response to brief spiking over time. Deconvolution uses an assumed response model to estimate underlying activity. A fluorescence trace, inferred spike activity, and a fitted latent trajectory are therefore distinct quantities, each with its own uncertainty.[^neural-data]

Optogenetics, electrical stimulation, pharmacology, transcranial magnetic stimulation (TMS), and lesions are **interventions** that alter neural systems. Their effects are studied through behavioral changes and neural responses.

### Tasks and sampling

A **trial** is an experimental repetition, a **condition** specifies task-variable settings, and a **session** is a recording period. Delayed comparison tasks separate sample presentation, retention, comparison, and response; contextual judgments vary which stimulus dimension matters; feedback tasks expose learning from successive outcomes. These relatively simple human and nonhuman-primate tasks make useful bridges to richer cognition.

Event alignment is part of an analysis. A brief response occurring just before an action can appear sustained when averaged relative to stimulus onset if reaction times vary. Trial averages emphasize reproducible structure; single trials preserve timing variation, errors, movement, and internal state.

Trials, cells, sessions, stimuli, and individuals provide different sampling units. A **pseudo-population** assembled across sessions preserves condition-related responses but not actual shared trial fluctuations. Intracranial human recordings additionally reflect clinically determined coverage. Cross-species comparisons are most useful when they specify the task, learned competence, and computation being compared.

## 2. Cognition: Knowledge, structure, and use

### Memory, attention, and control

**Episodic memory** concerns particular experiences; **semantic memory** supports concepts and knowledge that can be used across situations. Semantic cognition includes both knowledge organization and the controlled retrieval of task-relevant information. Recognizing a hammer as a tool and judging whether it is metallic draw on different aspects of the same concept. The hub-and-spoke framework connects modality-related features with cross-modal conceptual integration.

**Attention** prioritizes information. **Working memory** keeps information available for ongoing activity. **Cognitive control** allows goals and context to organize processing and action. Remembering an item, giving it priority, selecting it for an operation, and executing the resulting response are distinguishable accomplishments. Persistent firing, changing population patterns, and altered responses to subsequent inputs offer different windows onto these processes.

Panichello and Buschman asked monkeys to remember colors at two locations and later select one for report. Color information initially occupied location-dependent population structures; after selection, the selected information became better aligned for a common readout. Varying the report color wheel's orientation dissociated remembered color from a fixed saccade direction. Selection thus involved both priority and a change in the format available for use. These subspaces are defined by weighted combinations of neurons; a neuron can contribute to more than one encoding direction.[^memory-selection]

### Number, mathematical structure, and space

Approximate quantity discrimination, exact counting, symbolic notation, and mathematical inference are related but distinct abilities. Reciting a number sequence does not by itself establish cardinal meaning. Counting coordinates one-to-one assignment, stable order, and the relation between the final number word and the size of the set.

Mathematical learning reorganizes units and operations. Place value allows 402 to be regrouped as three hundreds, nine tens, and twelve ones. Fractions require coordinating a quantity with its unit and revising familiar whole-number expectations: multiplication by one half reduces a positive quantity. Conceptual and procedural knowledge can develop reciprocally, as understanding supports operations and their use reveals new relationships.

Geometry similarly distinguishes familiar appearance, transformation, category membership, and proof. Rotation preserves shape properties while changing orientation; an inclusive definition makes a square a special case of a rectangle. Checking examples supports a conjecture, whereas proof establishes why a conclusion holds for arbitrary instances satisfying the premises. Symbols, diagrams, and spatial arrangements help organize these operations by making quantities, groupings, and intermediate results available for manipulation.

### Learning, development, and expertise

Learning can change knowledge, the efficiency of an operation, or the probability of selecting a strategy. Faster arithmetic may reflect more frequent fact retrieval rather than uniformly faster calculation. Retention tests ask what remains available; transfer tests ask whether it can be recognized and used in a new setting. Errors also help distinguish these processes: retrieving a neighboring fact differs from applying a correct procedure to the wrong intermediate quantity.

Qin and colleagues related longitudinal changes in children's arithmetic strategies to fMRI responses during addition. Greater use of retrieval was accompanied by increased hippocampal responses and decreased responses in parts of frontoparietal cortex. Adolescent and adult comparison groups showed lower hippocampal responses and more stable patterns across different problems. Within-child change and between-age comparisons provide different parts of this developmental picture. Establishing retrievable knowledge and using established knowledge can therefore involve different neural changes.[^learning]

**Plasticity** concerns changes in the neural system, including synaptic efficacy and cellular excitability; learning describes changes in behavior or computation. **Consolidation** concerns processes that stabilize and reorganize memories over time. Practice can strengthen a useful operation, but flexible expertise also involves recognizing its conditions of application and reorganizing a problem when familiar procedures no longer fit.

### Physical understanding and causal reasoning

Physical prediction involves objects, relations such as support or collision, uncertain initial states, and possible outcomes. Simulation models propagate estimated states forward; rules and learned regularities can also support prediction. The required output matters: drawing a released pendulum's trajectory can elicit different judgments from choosing when to release it or where to catch it. These differences help explain how accurate action predictions can coexist with poor explicit accounts.[^physics]

Causal knowledge includes **structure**—which variables influence which—and **strength**—the magnitude of an influence under an assumed mechanism. Observing a variable differs from intervening on its generating process. Counterfactual reasoning additionally uses evidence about what actually happened to infer how that event would have unfolded under a change.

Scientific learning can introduce variables, reorganize explanations, and change when existing knowledge is retrieved. Retrieval of scientific knowledge remains sensitive to time pressure, wording, and familiarity. Expertise also changes which similarities are informative: problems may be grouped by a solution principle rather than by their visible objects.

### Relations, logic, and language

A relation distinguishes **roles** from their current **fillers**. A teacher lending a book to a student and a librarian lending a camera to a photographer share a structure despite different participants. Analogical transfer involves retrieving a relevant example, mapping its relationships, and adapting its solution. Understanding a supplied analogy and spontaneously finding one are different abilities.

**Compositionality** concerns how an interpretation depends on components and their organization. “The dog chased the person” and its role-reversed counterpart share words but express different events. Scope also matters: “Every student read a book” can allow different books for different students, whereas “There is a book every student read” requires a shared book. Reusable components must coexist with the bindings that determine the current instance.[^composition]

Deductive validity concerns what follows from premises; cognitive accounts additionally explain how premises are interpreted, which possibilities are considered, and why particular errors occur. Sentence comprehension likewise builds usable structure over time: several words can become a phrase that participates as a unit in a larger expression. Across number concepts, phrases, and action plans, researchers can ask how components become larger units and how those units enter subsequent operations.

## 3. Models and scientific explanation

### Explanatory roles and model families

Marr's levels distinguish the computational problem, the representations and algorithms used to solve it, and the physical implementation. A separate distinction concerns explanatory role: descriptive models establish regularities, process or mechanistic models specify how they arise, and normative models ask what solution is appropriate under stated objectives and constraints. Each can contribute to an explanation, and one model can serve several roles.

| Model family | Retained variables and operations | Typical explanatory work |
|---|---|---|
| Signal detection and evidence accumulation | Noisy evidence, criterion, starting point, decision boundary | Sensitivity, bias, choices, and reaction-time distributions. |
| Learning and probabilistic models | Values, beliefs, prediction errors, state estimates, updating rules | Feedback effects, adaptation, uncertainty, and causal inference. |
| Relational and compositional models | Objects, roles, bindings, rules, structured operations | Analogy, systematic generalization, reasoning, and interpretation. |
| Neural response models | Stimulus features, task variables, spike history, observation distributions | Predicting measured responses and separating conditional relationships. |
| Population and task-trained network models | Shared states, inputs, connectivity, dynamics, and readouts | Candidate computations and their correspondence with behavior and neural activity. |

A diffusion decision model links evidence quality, response caution, and nondecision time to joint predictions of choices and reaction times. Considering accuracy together with the shapes of correct and error reaction-time distributions helps distinguish changes in these processes.

Bayesian inference combines prior beliefs with the likelihood of evidence to obtain a posterior. A simple learning rule, $Q_{t+1}=Q_t+\alpha(r_t-Q_t)$, updates the selected option's value $Q$ toward outcome $r$ at learning rate $\alpha$. Learning rate, choice policy, forgetting, and choice persistence are separate modeling decisions. Values or prediction errors can then enter neural analyses as model-generated regressors, carrying their behavioral assumptions with them.[^behavior-models]

### Population dynamics and readout

A population activity pattern is a point in state space; its evolution forms a trajectory. A state-space model specifies both how hidden states evolve and how they generate observations. A trajectory describes a particular realization, while dynamics describe the updating process. Low-dimensional coordinates become cognitively informative through their relationships with task variables, behavior, and model operations.[^neural-data]

A continuous-time description is $\dot{\mathbf x}=F(\mathbf x,\mathbf u)$, with state $\mathbf x$ and input $\mathbf u$. With input held fixed, a **fixed point** has zero state derivative. An **attractor** is a set toward which nearby trajectories converge; an attracting fixed point is one example. Attractor models provide accounts of memory maintenance and recovery, while transient dynamics can organize sequential processing. External inputs can also drive trajectories, and changing a cue can change the effective dynamics. Recurrent computation and input-driven evolution are therefore often studied together.

A stable memory need not imply an unchanging activity pattern. If activity changes along directions that do not affect a content-sensitive readout, that readout can remain stable while individual neurons vary. Conversely, selecting an item can reformat its population representation for a subsequent operation. These relationships between content and neural activity can be studied through task timing and cross-time or cross-condition readouts. A **subspace** is linear; a **manifold** can be curved.

In Mante and colleagues' contextual decision task, monkeys judged either motion or color in the same stimulus. Prefrontal recordings and a trained recurrent network suggested how context could change the influence of incoming information on subsequent integration. Irrelevant information could enter activity without controlling the choice.[^context]

### Perturbations and causal contribution

In a mouse delayed-action task, Li and colleagues found that a choice-related population component could recover after transient unilateral inhibition while other components remained displaced.[^perturbation]

Optogenetic targeting and stimulation timing help identify contributions of cells, pathways, and task stages. Actual neural effects can spread through a network and outlast the input. Behavioral bias, sensitivity, reaction time, and recovery help specify what changed.

### Choosing abstractions and evaluating explanations

A useful abstraction preserves the distinctions required by the question. Mathematical learning may require units and operations; analogy requires relational correspondence; a decision task may require evidence, context, and readout. Explanatory economy depends on what the model makes understandable, not only on its size.

Scientific progress often makes a vague question concrete: separating knowledge from retrieval, giving a cognitive operation a time-varying predictor, or identifying which activity component recovers with behavior. A reproducible phenomenon, an improved estimator, and a candidate mechanism can each be substantive contributions.

Evidence is interpreted at the level and stage of the claim. Exploratory structure can merit investigation before its mechanism is settled, and a model can reveal useful variables while its biological implementation remains open. Alternative accounts become informative when they differ on errors, timing, learning, transfer, or intervention responses. These comparisons help identify what an explanation accounts for and where further work would be informative.

## 4. Analyzing behavior and neural data

### Behavioral and neural response measures

| Question | Common analyses | What the result describes |
|---|---|---|
| How does evidence affect behavior? | Psychometric curves, thresholds, signal detection measures | Sensitivity, choice bias, and lapse-related changes; threshold definitions depend on the task. |
| What process produces a response? | Reaction-time distributions, continuous-error models, trial-history models | Timing, precision, wrong-item reports, strategy mixture, and learning. |
| How does a neuron respond? | Raster plots, peristimulus time histograms (PSTHs), tuning curves, regression, point-process models | Event timing, condition effects, and responses conditional on inputs and history. |
| How variable are responses within and across neurons? | Fano factor (count variance/mean), signal and noise correlations, covariance | Count variability, similarity of mean tuning, and shared within-condition fluctuations. |
| How is activity organized in time? | Event-related responses, time-frequency power, phase consistency, burst analysis | Event locking, spectral structure, and intermittent activity. |
| How are regions related? | Cross-correlation, coherence, conditional-history and effective-connectivity models | Statistical dependence or model-based influence under specified observations and assumptions. |

Signal detection theory separates **sensitivity** from **criterion**. Under the equal-variance Gaussian model, $d'=\Phi^{-1}(H)-\Phi^{-1}(F)$, where $H$ and $F$ are hit and false-alarm rates and $\Phi^{-1}$ is the standard-normal quantile function. A participant can become more willing to answer “present” without gaining sensitivity. Psychometric functions relate stimulus strength to response probability; slope, position, and lapse parameters summarize different features of that relationship.

Firing-rate estimates, usually in spikes/s, depend on the counting window. In a teaching example, eight spikes across forty trials in a 20 ms window give 0.2 spikes/trial, or 10 spikes/s. The raster still contains information about which trials contributed spikes and their timing. The Fano factor describes count variability for a specified condition and window; changing either can change the estimated variability.

### Signal processing and response models

Filtering and normalization shape the analyzed quantity. A filter's temporal extent can blur event boundaries, and zero-phase filtering can spread an event-related change into earlier samples. Baseline subtraction preserves the signal's units; ratios, percentage changes, and z-scores express other comparisons. Standardizing each neuron before PCA changes its contribution to the variance structure.

Generalized linear models for spikes specify an observation distribution and link function. In a log-linked spike model, a coefficient expresses a change in log rate; exponentiation gives the corresponding rate ratio. In fMRI's general linear model, event regressors are commonly convolved with a hemodynamic response function to predict BOLD. Coefficients depend on the design's scale and assumptions, while a t-statistic additionally incorporates uncertainty. A coefficient, a standardized statistic, and a raw signal amplitude therefore answer different questions despite appearing as similar-looking maps. The shared abbreviation **GLM** covers different modeling conventions.

Power, oscillation frequency, burst occurrence, and firing rate are different quantities. Averaging trial-wise power differs from taking the power of the averaged signal: strong activity with variable phase can yield substantial total power but a weak event-related average. **Inter-trial phase coherence (ITPC)** measures phase consistency across repetitions, whereas power retains amplitude information. Time-frequency estimates trade temporal against frequency precision. Spectral changes can involve rhythmic peaks, the aperiodic background, or more frequent brief events rather than continuous oscillation. Coherence measures a frequency-specific relationship between signals; its interpretation depends on the estimator, signal mixing, and possible common input.[^connectivity]

### Population structure and information

Principal component analysis (PCA) finds high-variance directions; factor analysis separates shared variability from unit-specific variance; latent dynamical models describe state evolution. PCA **loadings** give the weights defining an axis, while **scores** locate observations along it. Centering, scaling, and using single trials versus condition averages change the structure presented to the method.[^neural-data]

**Encoding** predicts activity from specified features; **decoding** predicts a variable from activity. **Representational similarity analysis (RSA)** compares condition relationships through a **representational dissimilarity matrix (RDM)**. RDM comparisons relate systems through matched stimuli or conditions, even when their neurons or measurement channels do not correspond.[^representations]

One source of discriminability is the separation of condition means relative to within-condition variability. Large mean differences can coexist with substantial overlap; modest differences can be reliable when variability along the distinguishing directions is small. High overall variance is therefore not equivalent to high task information. Information can also be carried by differences in temporal pattern or distribution shape.

Distance choice determines what is retained. Correlation distance emphasizes pattern shape; Mahalanobis distance measures differences relative to noise covariance. **Whitening** expresses activity in coordinates where the estimated noise covariance is the identity. Cross-validated distances such as **crossnobis** use independent estimates to reduce noise bias. Sampling variation can produce negative estimates even though the underlying squared distance is nonnegative. RDM entries share conditions, so their apparent number does not equal the number of independent observations.

Cross-decoding asks whether a readout transfers across stimuli, contexts, or response mappings. Temporal generalization trains at one time and tests at others on held-out trials, describing when a readout remains usable or reappears. Comparing neural generalization with behavioral transfer helps relate changes in representation to changes in performance.

### Prediction and statistical inference

| Target | Common measures | Interpretation |
|---|---|---|
| Classification | Accuracy, balanced accuracy, ROC-AUC | Correct decisions, class-balanced performance, or ranking ability. |
| Continuous responses | MSE, RMSE, MAE, correlation, test-set $R^2$ | Numerical error versus covariation; high correlation can coexist with scale and offset errors. |
| Probabilistic models | Held-out log-likelihood, predictive density, deviance | Probability assigned to observations, including the modeled variability. |
| Representational models | RDM correspondence, held-out response prediction, reliability, noise ceilings | Agreement under a particular measurement, noise level, and generalization target. |

MSE averages squared prediction errors; RMSE takes their square root and returns to the response's units; MAE averages absolute errors. Test-set $R^2=1-\mathrm{SSE}/\mathrm{SST}$ compares summed squared prediction error with variation about a specified mean reference. It can be negative and is not generally squared correlation. Likelihood improvement in bits/spike is relative to a specified baseline; it is not automatically stimulus–response mutual information. A noise ceiling estimates the level of agreement attainable given the reliability of the measurements and the chosen comparison.

Training, model selection, and testing have different roles. Leaving out trials, stimuli, time blocks, sessions, or individuals asks different questions. Data-dependent preprocessing, feature selection, and alignment belong to the evaluated procedure. Parameter recovery and predictive checks help establish what a model can distinguish and which behavioral patterns it actually reproduces.[^behavior-models]

Statistical inference should preserve repeated measurements and their sampling units. More neurons are not more independent animals. Hierarchical models, suitable resampling, and design-respecting permutations offer ways to retain this structure. Within-person contrasts exploit paired observations; **partial pooling** estimates individual differences while sharing information across individuals. Multiple-comparison procedures address different error-control targets; a significant cluster is not a separate corrected test of every point or a precise estimate of effect onset. Effect sizes and uncertainty remain informative alongside significance.

## 5. Terminology and reporting

Several recurring terms refer to different objects or comparisons across tasks and measurement scales.

| Terms | Useful distinction |
|---|---|
| Representation / readout | How information is organized versus how it is used by a downstream operation. |
| Selectivity / mixed selectivity | Differential responses to conditions versus sensitivity to several variables, including their interactions. |
| Abstraction / invariance / generalization | Reusable structure, preservation under a specified transformation, and performance across specified unseen conditions. |
| Recurrent / recursive | Loops of neural interaction versus rules applied within structures they generate. |
| Inhibition / suppression | May concern synapses, activity, actions, or competing knowledge; the biological and cognitive usages have different objects. |
| Signal / noise | Defined relative to measured conditions and the model; unexplained variation need not be biologically irrelevant. |
| Reliability / robustness / recovery | Consistency across repetitions, preservation under specified changes, and return of a specified property. |

Research language is most informative when it names the measured quantity, comparison, and scope. Illustrative formulations include: “Rule decoding generalized to a new response mapping”; “Adding spike-history terms improved held-out likelihood”; and “Choice-related activity recovered while other population components remained displaced.”

## 6. Selected references

These reviews and empirical anchors are entry points, not an exhaustive bibliography.

[^functional-organization]: Fedorenko, Piantadosi & Gibson (2024). [Language is primarily a tool for communication rather than thought](https://doi.org/10.1038/s41586-024-07522-w). *Nature*. Language-selective systems and nonlinguistic cognition; the paper also advances a broader functional thesis.

[^fields]: Buzsáki, Anastassiou & Koch (2012). [The origin of extracellular fields and currents—EEG, ECoG, LFP and spikes](https://doi.org/10.1038/nrn3241). *Nature Reviews Neuroscience*. Signal generation and recording scales.

[^memory-selection]: Panichello & Buschman (2021). [Shared mechanisms underlie the control of working memory and attention](https://doi.org/10.1038/s41586-021-03390-w). *Nature*. Selection and the population format of remembered information.

[^learning]: Qin et al. (2014). [Hippocampal-neocortical functional reorganization underlies children's cognitive development](https://doi.org/10.1038/nn.3788). *Nature Neuroscience*. Arithmetic strategies and developmental neural change.

[^physics]: Smith, Battaglia & Vul (2018). [Different Physical Intuitions Exist Between Tasks, Not Domains](https://doi.org/10.1007/s42113-018-0007-3). *Computational Brain & Behavior*. Task-dependent physical judgments.

[^composition]: Frankland & Greene (2020). [Concepts and Compositionality: In Search of the Brain's Language of Thought](https://doi.org/10.1146/annurev-psych-122216-011829). *Annual Review of Psychology*. Roles, binding, and structured thought.

[^behavior-models]: Wilson & Collins (2019). [Ten simple rules for the computational modeling of behavioral data](https://doi.org/10.7554/eLife.49547). *eLife*. Behavioral models and their evaluation.

[^neural-data]: Paninski & Cunningham (2018). [Neural data science: accelerating the experiment-analysis-theory cycle in large-scale neuroscience](https://doi.org/10.1016/j.conb.2018.04.007). *Current Opinion in Neurobiology*. Observation models and population analysis.

[^context]: Mante, Sussillo, Shenoy & Newsome (2013). [Context-dependent computation by recurrent dynamics in prefrontal cortex](https://doi.org/10.1038/nature12742). *Nature*. Context, population activity, and selective integration.

[^perturbation]: Li, Daie, Svoboda & Druckmann (2016). [Robust neuronal dynamics in premotor cortex during motor planning](https://doi.org/10.1038/nature17643). *Nature*. Population recovery and behavior after perturbation.

[^connectivity]: Bastos & Schoffelen (2016). [A tutorial review of functional connectivity analysis methods and their interpretational pitfalls](https://doi.org/10.3389/fnsys.2015.00175). *Frontiers in Systems Neuroscience*. Cross-signal relationships and recording effects.

[^representations]: Diedrichsen & Kriegeskorte (2017). [Representational models: A common framework for understanding encoding, pattern-component, and representational-similarity analysis](https://doi.org/10.1371/journal.pcbi.1005508). *PLOS Computational Biology*. A unified treatment of representational hypotheses.
