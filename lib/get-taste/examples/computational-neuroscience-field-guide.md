# Computational neuroscience: Core concepts

> This note helps agents acquire foundational knowledge of computational neuroscience, become familiar with the field's terminology and writing conventions, and develop informed research judgment (research taste). Its purpose is to improve their understanding of the project in its scientific context and help them use more natural and accurate language in their work.

Computational neuroscience studies how nervous systems generate activity, process information, learn, and guide behavior. Its questions range from the ionic basis of a spike to the circuit computations underlying perception and cognition. Mathematical theory, simulation, statistical analysis, and behavioral modeling make complementary contributions: models can explain how interactions produce a phenomenon, while statistical methods establish what structure is supported by noisy, incomplete observations. Neural data analysis is itself a central part of the field. A useful account of computational neuroscience therefore includes biophysics, network theory, coding, learning, and cognition, rather than identifying the field with any one model class.[^statistics]

## 1. Neurons, experiments, and data

### Neurons and circuits

Neurons integrate synaptic input and generate action potentials, usually called **spikes**. Membrane capacitance, ion channels, dendritic morphology, and synaptic conductances shape their excitability and response dynamics. Excitatory and inhibitory inputs promote or suppress spiking through effects that depend on synaptic reversal potentials, conductances, and the postsynaptic state. Dendrites can perform nonlinear integration rather than simply relay signals to the soma.

A coarser description uses **firing rate**, usually expressed in spikes/s or Hz. Depending on the analysis, this may mean a spike count divided by a time window, a time-varying rate estimated across repeated trials, or activity averaged over a population. These averaging operations retain different information. Spike timing, refractoriness, and spike-frequency adaptation describe temporal structure that a single mean rate cannot capture.[^spikes]

Circuit organization matters at every level. Feedforward pathways carry signals along a processing hierarchy; feedback pathways return signals to earlier stages; recurrent connectivity creates loops of interaction. A circuit can contain all three. Likewise, a model unit may represent a neuron, a neuronal population, or an abstract computational variable, depending on the approximation being made.

### What the measurements capture

| Recording or measurement | Common quantities | Interpretation |
|---|---|---|
| Intracellular electrophysiology | Membrane potential, ionic currents, synaptic currents | Current clamp measures voltage responses while controlling injected current; voltage clamp measures currents while controlling voltage. |
| Extracellular electrophysiology | Spike trains, spike counts, single-unit and multi-unit activity | Spike sorting assigns extracellular events to putative units. The recorded population samples only part of the underlying circuit. |
| Calcium imaging | Fluorescence, calcium transients, $\Delta F/F$ | Signals depend on calcium and indicator kinetics. Deconvolution or spike inference estimates underlying activity; it is not a direct measurement of spike times. |
| Local field potentials (LFP), electroencephalography (EEG), and magnetoencephalography (MEG) | Electrical or magnetic signals; spectral power, phase, coherence | These reflect population currents and their spatial summation. Source geometry, volume conduction, and recording configuration shape the signals; they are not measurements of mean firing rate. |
| Functional MRI (fMRI) | Blood-oxygen-level-dependent (BOLD) responses, voxel patterns, functional connectivity | An indirect hemodynamic measure, with spatial and temporal scales distinct from electrophysiology. |
| Behavior and psychophysics | Choices, reaction times, movement kinematics, psychometric functions | Measurements of performance and strategy that constrain computational accounts of behavior, not merely labels attached to neural recordings. |

Raw measurements, estimates of neural activity, and inferred latent variables are different quantities. For example, a fluorescence trace, a deconvolved activity estimate, and a fitted latent trajectory need not share the same interpretation. Binning and smoothing set the temporal resolution of an analysis; normalization and baseline correction also affect the quantities being compared.

### Trials, variability, and behavior

A **trial** is an individual task attempt or experimental repetition, a **condition** specifies a combination of stimulus or task settings, and a **session** is a recording period. Trial-averaged responses, often summarized by a peristimulus time histogram (**PSTH**), reveal event-locked structure. Single-trial analyses additionally resolve fluctuations in response magnitude, timing, and internal state. A **pseudo-population** assembled from nonsimultaneous recordings can support analyses of condition-averaged responses, but does not recover the actual trial-by-trial covariation between neurons.

Neural responses depend on stimuli, actions, task rules, learning history, and internal state. **Evoked** and **spontaneous** activity distinguish recording conditions, not meaningful signals from meaningless fluctuations. Trial-to-trial variability can reflect stochastic spiking, unobserved inputs, movement, arousal, or changes in strategy. In a statistical analysis, **noise** is defined relative to a conditioning set or mean model: variation treated as noise in one analysis may become predictable when additional variables are measured.[^coding]

Controlled tasks help isolate particular variables; natural behavior exposes richer interactions between sensory input, action, and internal state. Interpreting a tuning curve or a population trajectory requires its experimental context, including the task, time window, recorded signals, and variables included in the analysis.

## 2. Neural computation

### Coding, representation, and readout

**Neural coding** concerns the relationship between neural responses and variables such as stimuli, position, choice, or movement. A **receptive field** characterizes the stimulus locations, features, and temporal structure that affect a response. A **tuning curve** describes the mean response as a function of a variable; **selectivity** refers to differential responses across stimuli or conditions.

Population codes distribute information across neurons. **Mixed selectivity** refers to sensitivity to several variables, often including nonlinear combinations of them. **Sparse coding** concerns the distribution of activity: population sparseness describes responses across neurons for a given stimulus, whereas lifetime sparseness describes one neuron's responses across stimuli. A representation can be both sparse and distributed.

An **encoding model** predicts neural responses from stimuli or other covariates, often through a conditional distribution $p(\mathbf r\mid\mathbf s)$. **Decoding** estimates a stimulus, choice, or behavioral variable from neural activity. **Readout** emphasizes how a downstream system uses that activity; a linear readout forms a weighted sum of population responses. An analyst's decoder measures information accessible to that decoder. Whether a biological circuit uses the same readout is a further question.

**Representational geometry** describes distances, similarities, and separability among population responses to different stimuli or conditions. Heterogeneous single-neuron responses can jointly support a simple readout at the population level. Complex tuning at the level of individual cells is therefore compatible with a compact account of the computation, as illustrated by population analyses of context-dependent decisions.[^mante]

### Circuit computation and population dynamics

Circuit models relate connectivity, cellular properties, and inputs to collective activity. Common computational motifs include integration, gain modulation, divisive normalization, competition, and recurrent amplification. Gain modulation changes response amplitude or sensitivity; divisive normalization expresses a response relative to a pooled activity signal. Such descriptions capture an effective computation without necessarily specifying a unique cellular implementation.

Dynamical systems describe state evolution, for example through $\dot{\mathbf x}=F(\mathbf x,\mathbf u)$, where $\mathbf x$ is the state and $\mathbf u$ the input. A population activity pattern defines a point in **neural state space**; its evolution traces a **trajectory**. A trajectory is a particular realization, whereas the dynamics specify how states evolve under particular inputs. Both recurrent interactions and external drive can organize population trajectories.

With inputs held fixed, a **fixed point** is a state at which the dynamics vanish. An **attractor** is a set toward which nearby trajectories converge; examples include stable fixed points and attracting limit cycles. Attractor models are used to study persistent activity and memory, including the maintenance of continuous variables in continuous-attractor networks. Oscillatory and transient dynamics provide accounts of rhythms and time-varying or sequential computations. These are useful modeling connections, not exclusive assignments of functions to dynamical structures. **Balanced networks** study regimes in which strong excitation and inhibition largely cancel; asynchronous, irregular spiking is an important associated phenomenon. Balance refers to inputs and network operation, not equal numbers of excitatory and inhibitory cells.

Dimensionality reduction describes population activity with fewer coordinates. **Principal component analysis (PCA)** identifies directions of greatest variance; **factor analysis (FA)** models shared variability while allowing neuron-specific noise; latent dynamical models impose structure on how hidden states evolve. In empirical work, a **neural manifold** usually denotes a low-dimensional set around which population activity is concentrated. It may be curved, whereas a subspace is linear. The inferred coordinates need not correspond individually to cognitive variables. Representational analyses characterize distinctions among activity patterns; dynamical analyses address how those patterns arise and change. The two perspectives are often used together.[^statistics]

### Goals, constraints, and inference

**Normative models** ask what computation or strategy is appropriate given an objective, environmental statistics, and constraints. Optimality is conditional on these assumptions. Coding capacity, noise, metabolic cost, response time, and the cost of an action can all enter the problem being solved.

**Efficient coding** asks how limited resources should be allocated to represent inputs, with applications to receptive-field organization, redundancy reduction, and adaptation. **Bayesian inference** combines prior knowledge with a likelihood to obtain or approximate a posterior distribution. **Predictive coding** often refers to inference schemes in which predictions and prediction errors interact to update internal representations; the term also has a redundancy-reduction meaning in sensory coding. These ideas can be connected within explicit models, but an objective for a code, a principle of inference, and an algorithm for carrying out inference are different kinds of account.[^prediction]

At the behavioral level, **signal detection theory** distinguishes sensitivity from decision criterion, while **evidence-accumulation models** describe how noisy evidence is integrated over time. **Reinforcement learning** studies learning through interaction with an environment: a value function represents expected return, and a policy specifies how actions are selected. Reward prediction errors compare received rewards—and, in temporal-difference learning, updated predictions of future reward—with earlier expectations. **Optimal control**, including optimal feedback control, relates action selection and state estimation to a cost function, and is widely used in sensorimotor modeling.[^cognition]

### Learning and plasticity

Learning describes changes in behavior or computation with experience. **Plasticity** refers to changes in the underlying neural system: synaptic plasticity changes synaptic efficacy, whereas intrinsic plasticity changes cellular excitability. Short-term facilitation and depression describe activity-dependent changes in transmission. Long-term potentiation (**LTP**) and long-term depression (**LTD**) refer to persistent increases and decreases in synaptic efficacy. Homeostatic plasticity helps regulate activity and maintain stable function.

**Hebbian learning** relates synaptic changes to pre- and postsynaptic activity. **Spike-timing-dependent plasticity (STDP)** makes relative spike timing explicit, with the learning window depending on the synapse, cell type, and experimental conditions. **Three-factor learning rules** combine local pre- and postsynaptic activity with a modulatory signal. An **eligibility trace** retains a temporary, synapse-specific record of recent activity so that delayed feedback can modify the relevant synapses.[^learning]

**Credit assignment** concerns which connections, units, or past actions should change to improve an outcome. Biological credit assignment adds questions about the origin, routing, and local availability of learning signals. Backpropagation computes gradients; gradient descent uses gradients to update parameters. These are useful tools for training neuroscience models. Explaining the computation performed by a trained network and explaining how a biological circuit learns that computation are distinct modeling goals.[^cognition]

## 3. Models and explanation

### Levels of analysis and explanatory roles

Marr's levels distinguish the computational problem and why it is appropriate, the representations and algorithms used to solve it, and the physical implementation. They are not anatomical scales or successive stages of a research program.[^statistics]

A separate distinction concerns what a model contributes to an explanation:

| Explanatory role | Main question | Examples |
|---|---|---|
| Descriptive or phenomenological | What regularities and statistical structure characterize the phenomenon? | Tuning curves, statistical encoding models, descriptions of population activity. |
| Mechanistic | What components and interactions generate the phenomenon? | Ionic-current models, feedback circuits, networks implementing a computation. |
| Normative | What solution is appropriate for a specified objective and set of constraints? | Efficient coding, Bayesian observers, optimal control. |

These roles overlap and do not form a hierarchy of scientific value. A descriptive model can reveal an important regularity; a mechanistic account can operate at an effective circuit level rather than reconstruct every synapse. Calling a model mechanistic identifies the process it proposes, not the degree to which that process has been uniquely established in the biological system.[^models]

### Common model classes

| Model class | Key abstraction | Typical applications |
|---|---|---|
| Conductance-based and compartmental models, including Hodgkin–Huxley models | Membrane voltage and ionic conductances; multicompartment models also represent morphology and spatial coupling. | Excitability, firing patterns, dendritic integration, electrophysiological and pharmacological effects. |
| Integrate-and-fire models, including leaky (LIF) and adaptive exponential (AdEx) models | Input integration, threshold crossing, reset, and sometimes adaptation. | Spike generation and spiking networks at reduced computational cost. |
| Rate models, including Wilson–Cowan models and rate-based recurrent neural networks (RNNs); attractor networks such as Hopfield networks | Interacting activity variables, with the retained dynamics depending on the model. | Population feedback, associative memory, decisions, and time-dependent computation. |
| Linear–nonlinear (LN), linear–nonlinear–Poisson (LNP), and generalized linear models (GLMs) for spike responses | Stimulus filters, response nonlinearities, an observation model, and optional spike-history or coupling terms. | Receptive-field estimation, response prediction, and analysis of measured covariates. |
| Latent-variable and state-space models: FA, Gaussian-process factor analysis (GPFA), linear dynamical systems (LDS), hidden Markov models (HMM), switching LDS (SLDS) | Hidden structure and an observation model; model classes differ in smoothness assumptions, dynamics, and discrete states. | Denoising, single-trial inference, shared variability, population dynamics, and behavioral-state analysis. |
| Drift-diffusion, Bayesian observer, reinforcement-learning, and control models | Evidence, beliefs, values, policies, state estimates, or action costs. | Choices, reaction times, learning curves, and control of movement. |
| Task-trained artificial neural networks, including convolutional networks (CNNs), RNNs, and Transformers | Representations and computations shaped jointly by architecture, objective, training data, and learning procedure. | Studying task constraints and comparing candidate computations with neural and behavioral data. |

A model class does not fix its explanatory role. A GLM coupling filter describes a conditional statistical relationship, not necessarily an anatomical synapse. An RNN may be used as a predictor, a candidate circuit model, or a task-solving system. **Data-driven** modeling learns structure or parameters from observations; it still relies on assumptions and can incorporate task knowledge or biological constraints.[^coding]

Model reduction and coarse-graining seek an effective description that retains the responses or dynamical features relevant to a question. Reduced models can expose regularities and make analysis or simulation tractable. Their parameters may summarize several microscopic processes, so an effective parameter need not have a one-to-one counterpart among channel or synaptic parameters.

### Task-driven modeling and NeuroAI

Task-driven modeling begins with a computational demand, obtains a system that meets it, and analyzes the resulting solution. Mante and colleagues combined prefrontal population recordings with a task-trained RNN to study selective integration in context-dependent decisions. Yamins and colleagues optimized hierarchical models for object recognition, then tested their ability to predict visual cortical responses to held-out images. These examples illustrate how task constraints can yield both analyzable computational mechanisms and quantitatively predictive representations.[^mante][^yamins]

**NeuroAI** includes neuroscience-inspired AI, AI methods for neuroscience, and artificial networks used as models of brain computation. In model–brain comparisons, task performance, neural predictivity, representational similarity, and behavioral similarity characterize different aspects of correspondence. Better neural prediction is a substantive result. An account of shared algorithms, learning rules, or biological implementation makes additional claims that require the corresponding analysis and evidence.[^cognition]

## 4. Modeling choices and scientific progress

A useful abstraction preserves what matters for the question. Ionic currents may be essential to an explanation of spike initiation, while effective feedback and readout structure may be more informative for a population-level decision computation. Simplicity is relative to the explanatory task: omitting irrelevant detail can reveal a principle, but explaining a demanding perceptual or cognitive function may genuinely require a large model. Parameter count alone is a poor measure of explanatory economy.[^models][^cognition]

Scientific progress can take the form of a reproducible tuning relationship, a characteristic timescale, a circuit interaction that accounts for a phenomenon, or a method that makes previously inaccessible structure estimable. Theory connects observations and identifies consequential assumptions. Methods improve what can be measured or inferred. Descriptive work establishes phenomena that subsequent explanations must address. These contributions can stand on their own as well as support one another.

Biological variability and nonuniqueness can be objects of study rather than merely obstacles to fitting. Different combinations of conductances or connections can produce similar activity, revealing compensation, robustness, and common organization across distinct implementations. Marder and Taylor emphasize studying populations of plausible models instead of relying on a single representative parameter set. This motivates model comparison and sensitivity analysis without making a complete solution to identifiability a prerequisite for useful work.[^biophysics]

The appropriate evidential standard depends on the claim and the stage of research. An exploratory observation, a candidate mechanism, a validated analysis method, and an established theory make different commitments. A promising explanation can merit investigation while alternatives remain open. Failure in one setting primarily constrains the account in that setting; success does not automatically extend to other tasks, areas, or species. Stating what a result explains, under which conditions, is more informative than repeatedly noting that a mechanism has not been proved.

## 5. Terminology in context

| Term | Common usage and distinctions |
|---|---|
| Activity / response | Activity is general; a response is usually defined relative to an input, event, or condition. An enhanced response is enhanced relative to a specified comparison or baseline. |
| Encoding / representation | Statements that neurons encode or represent a variable are often supported by tuning, information, or decoding analyses. The wording need not imply a symbolic code or a particular downstream decoder. |
| Signal / noise | A distinction relative to the variables and mean model used in the analysis. Noise correlation refers to correlated deviations across trials at fixed conditions, not neural correlation in general. |
| State / latent state | A state describes the system at a given time; a latent state is unobserved in the model. Brain state can also refer to physiological conditions such as wakefulness or sleep. |
| Neural dynamics / learning dynamics | Neural dynamics usually concern activity evolving over time. Learning dynamics concern changes in parameters, representations, or behavior during learning. The processes can interact without being interchangeable. |
| Adaptation / plasticity | Adaptation often denotes adjustment to recent input or environmental statistics. Plasticity is a broader capacity for neural change. Their meanings overlap and are not separated by a universal timescale boundary. |
| Anatomical / functional / effective connectivity | Anatomical connections are physical pathways; functional connectivity describes statistical dependence; effective connectivity concerns model-dependent directed influences. Interpretation depends on the estimator and assumptions. |
| Inference | An analyst may infer parameters or latent states from data; an organism may infer properties of the world from sensory evidence. Shared mathematics does not establish a shared biological algorithm. |
| Prediction error / residual | A prediction error may be a computational signal in an inference or learning model. A residual is an observed-minus-predicted discrepancy in a fit. Similar formulas do not establish the same neural implementation. |
| Dimensionality / subspace / manifold | These concern degrees of freedom and geometric structure. High-dimensional recordings can contain low-dimensional shared activity. A two-dimensional visualization is not an estimate of intrinsic dimensionality. |
| Low-rank / low-dimensional | Rank is a property of a matrix, such as a connectivity matrix; low dimensionality often describes activity or representation. Low-rank connectivity and low-dimensional activity are related possibilities, not equivalent observations. |
| Stability / robustness / reliability | Dynamical stability concerns the response to perturbations; robustness concerns preservation of a property under specified changes; reliability concerns consistency across repetitions. Stable representation can also mean empirical persistence across time or days. |
| Identifiability / degeneracy | Identifiability asks whether observations distinguish parameters or structures within a model class. Degeneracy often describes different biological components or configurations supporting similar functions. Neither is simply a synonym for estimation uncertainty. |
| Ablation / perturbation | Model ablation removes or disables components; biological ablation can remove cells or tissue. Perturbation more broadly changes inputs, activity, parameters, or circuitry. Model and biological perturbations address different systems. |
| Generalization / transfer | Generalization concerns performance on unseen data or conditions. Transfer concerns reuse of learned parameters or representations across tasks or domains. Holding out random trials and holding out entire conditions test different forms of generalization. |

Research language is usually most informative when it names the quantity and the comparison: “Adding spike-history terms improved held-out log-likelihood”; “The leading principal components captured most of the variance in condition-averaged responses”; “Task training produced a representational geometry resembling that of the neural population.” Established terms, together with the relevant scope, can express a new result without a new label.

## 6. Common analyses and evaluation measures

Summary statistics characterize data; evaluation measures quantify performance against a target. Some quantities serve both purposes. The field has established choices for many questions, but no single score captures every aspect of a model or dataset.

### Spiking, variability, and temporal structure

| Property | Common measures | Interpretation |
|---|---|---|
| Response magnitude and structure | Firing rate, PSTH, tuning curve, response latency, gain | Describe responses across time and conditions. Counting windows, event alignment, and averaging procedures are part of the definition. |
| Spiking variability | Fano factor: $\mathrm{Var}(N)/\mathbb E[N]$; interspike-interval (ISI) CV: $\mathrm{SD}(\mathrm{ISI})/\mathbb E[\mathrm{ISI}]$ | The Fano factor usually summarizes count variability across trials at fixed conditions and window length; the coefficient of variation (CV) summarizes interval irregularity. Poisson statistics provide a reference, not a universal account of spiking. |
| Covariation across neurons | Signal correlation, noise correlation, covariance | Signal correlation typically compares condition-averaged tuning; noise correlation compares within-condition trial deviations. They capture different sources of covariation. |
| Temporal dependence and rhythms | Autocorrelation, cross-correlation, power spectral density, coherence, phase locking | Characterize temporal, spectral, and phase relationships. Coherence alone does not identify directed causal influence. |
| Information in neural responses | Mutual information, information rate, Fisher information | Mutual information measures statistical dependence. Fisher information quantifies local sensitivity of a response distribution to a parameter and relates to estimation precision. Estimates depend on sampling, response representation, and model assumptions. |

### Prediction, decoding, and behavior

| Target | Common measures | Interpretation |
|---|---|---|
| Continuous-valued responses | MSE, RMSE, MAE, $R^2$, Pearson correlation $r$ | Used for voltage, rates, or behavioral trajectories. Prediction errors assess numerical discrepancies; correlation assesses covariation and can remain high despite errors in scale or offset. |
| Probabilistic predictions and spike models | Held-out log-likelihood, predictive log density, deviance explained, bits/spike | Assess predictive distributions relative to observations or a baseline. The observation model and information available at prediction time are part of the comparison. |
| Classification and detection | Accuracy, balanced accuracy, ROC-AUC, $d'$ | Accuracy evaluates decisions, AUC summarizes discrimination across thresholds, and $d'$ expresses sensitivity within signal detection theory, separately from response criterion. |
| Behavioral models | Choice likelihood, psychometric threshold and slope, reaction-time distributions, trajectory error | Assess choices, sensitivity, decision timing, and movement. Matching aggregate accuracy is different from accounting for error patterns or reaction-time distributions. |

For prediction, the usual coefficient of determination is $R^2=1-\mathrm{SSE}/\mathrm{SST}$. It can be negative on test data and is not generally equal to squared Pearson correlation. Explained variance, fraction of explainable variance explained, and noise-corrected predictivity can use different normalizations; the paper's or benchmark's formula determines the quantity being reported.

A common likelihood-based score for spike prediction is

$$
\mathrm{bits/spike}
=\frac{\ell_{\mathrm{model}}-\ell_{\mathrm{baseline}}}
{N_{\mathrm{spikes}}\ln 2},
$$

where the log-likelihoods use natural logarithms and a common baseline assigns each neuron its constant mean firing rate. The score measures predictive improvement over that baseline; it is not automatically stimulus–response mutual information. Neural Latents Benchmark uses a Poisson observation model to score **co-smoothing**: predicting held-out neurons from the neurons available in test trials. **Forward prediction** instead holds out future time points. The same scoring rule can evaluate different prediction tasks.[^nlb]

### Population structure and model–brain comparisons

| Property | Common methods and measures | Interpretation |
|---|---|---|
| Linear dimensionality and variance structure | Explained variance ratio, eigenspectrum, participation ratio | The participation ratio $D_{\mathrm{PR}}=(\sum_i\lambda_i)^2/\sum_i\lambda_i^2$, for covariance eigenvalues $\lambda_i$, summarizes effective dimensionality of the spectrum. It is not a general estimator of nonlinear manifold dimension. |
| Representational geometry | Representational similarity analysis (RSA), representational dissimilarity matrix (RDM) comparisons | Compare the distance structure among responses to matched stimuli or conditions. The distance function, comparison statistic, and noise treatment matter. |
| Correspondence between representations or subspaces | Canonical correlation analysis (CCA), principal angles, centered kernel alignment (CKA) | CCA finds highly correlated linear projections, principal angles compare subspaces, and CKA compares centered sample-similarity matrices. Their invariances differ; they are not interchangeable measures of overall brain similarity.[^cka] |
| Reliability and explainable variation | Split-half reliability, noise ceilings, fraction of explainable variance explained | Relate model performance to the reproducible component of the data. A noise ceiling is an estimate for a particular measurement and comparison, not a ceiling on mechanistic understanding.[^yamins] |

Evaluation also depends on the split and conditioning information. Held-out trials, stimuli, neurons, and sessions test different forms of generalization. For temporally correlated data, random time-point splits and independent trials or time blocks are different evaluations. If a readout is fitted, performance depends on both the representation and the readout's capacity. A meaningful score is attached to a specified target, available information, and test set—not simply to the model's name.[^coding][^nlb]

Established measures make results easier to interpret and compare. When a new statistic is useful, its scientific content lies in the property being measured, the definition, and its relationship to existing quantities. Renaming a familiar measure does not add information.

## 7. References

[^statistics]: Kass et al. (2018). [Computational neuroscience: Mathematical and statistical perspectives](https://pmc.ncbi.nlm.nih.gov/articles/PMC6454918/). *Annual Review of Statistics and Its Application*. Connects neuronal and network models with statistical analysis and neuroscience questions.

[^spikes]: Gerstner, Kistler, Naud & Paninski (2014). [Neuronal dynamics: From single neurons to networks and models of cognition](https://neuronaldynamics.epfl.ch/online/). Cambridge University Press. Textbook treatment of neuronal models, spike statistics, and learning; Chapter 7 clarifies firing rate, variability, and neural codes.

[^coding]: Aljadeff, Lansdell, Fairhall & Kleinfeld (2016). [Analysis of neuronal spike trains, deconstructed](https://pmc.ncbi.nlm.nih.gov/articles/PMC4970242/). *Neuron*. Connects experimental variables, spike statistics, encoding models, and model evaluation.

[^models]: Levenstein et al. (2023). [On the role of theory and modeling in neuroscience](https://pmc.ncbi.nlm.nih.gov/articles/PMC9962842/). *Journal of Neuroscience*. Explanatory roles, levels of abstraction, and the complementary contributions of models.

[^biophysics]: Marder & Taylor (2011). [Multiple models to capture the variability in biological neurons and networks](https://pmc.ncbi.nlm.nih.gov/articles/PMC3686573/). *Nature Neuroscience*. Parameter variability, compensation, and populations of plausible models.

[^prediction]: Aitchison & Lengyel (2017). [With or without you: Predictive coding and Bayesian inference in the brain](https://pmc.ncbi.nlm.nih.gov/articles/PMC5836998/). *Current Opinion in Neurobiology*. Relationships among efficient coding, predictive coding, and probabilistic inference.

[^learning]: Frémaux & Gerstner (2016). [Neuromodulated spike-timing-dependent plasticity, and theory of three-factor learning rules](https://pmc.ncbi.nlm.nih.gov/articles/PMC4717313/). *Frontiers in Neural Circuits*. Local synaptic activity, modulatory signals, and eligibility traces in theory and experiment.

[^cognition]: Kriegeskorte & Douglas (2018). [Cognitive computational neuroscience](https://pmc.ncbi.nlm.nih.gov/articles/PMC6706072/). *Nature Neuroscience*. Relates neural data analysis, task-performing networks, and cognitive models through the computations they explain.

[^mante]: Mante, Sussillo, Shenoy & Newsome (2013). [Context-dependent computation by recurrent dynamics in prefrontal cortex](https://pmc.ncbi.nlm.nih.gov/articles/PMC4121670/). *Nature*. Population analysis and a task-trained RNN used to study selective integration.

[^yamins]: Yamins et al. (2014). [Performance-optimized hierarchical models predict neural responses in higher visual cortex](https://pmc.ncbi.nlm.nih.gov/articles/PMC4060707/). *PNAS*. Task optimization linked to neural response prediction and representational geometry.

[^cka]: Kornblith, Norouzi, Lee & Hinton (2019). [Similarity of neural network representations revisited](https://proceedings.mlr.press/v97/kornblith19a.html). *ICML*. Representation-comparison methods and their invariance properties, including CCA and CKA.

[^nlb]: Pei et al. (2021). [Neural Latents Benchmark ’21: Evaluating latent variable models of neural population activity](https://arxiv.org/abs/2109.04463). *NeurIPS Datasets and Benchmarks*. Explicit evaluation protocols for co-smoothing, forward prediction, behavioral decoding, and PSTH matching.
