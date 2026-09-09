# Neural control: Dynamics, computation, and experiments

> This guide develops shared scientific background, fluency in the field's terminology, and informed research judgment. It connects control of biological and artificial neural systems, neural computation for control, and neural networks used as models or controllers.

## 1. Control problems and neural models

### Identify the system and its role

Control theory studies how inputs influence a dynamical system and how to choose those inputs to achieve an objective. The **plant** is the system being controlled; a **controller** generates its inputs. In **closed-loop control**, measurements of the evolving system influence subsequent actions. An open-loop input is specified without using those subsequent measurements.

Several research traditions share this language:

| Research problem | Role of the neural system | Typical question |
|---|---|---|
| Controlling neural activity | Plant | Can stimulation regulate firing, change an oscillation, or guide a population trajectory? |
| Neural control of behavior | Controller within a body–environment loop | How are sensory information, task goals, and motor commands combined? |
| Neural-network-based control | Model, estimator, or controller | Can a learned component improve prediction or action selection? |
| Control-theoretic analysis of neural computation | Dynamical computational system | How do inputs and learned connections shape memory, stability, and computation? |

An anatomical feedback connection is not automatically an error-correcting controller. Likewise, **cognitive control** names capacities such as task selection and flexible behavior; identifying a control-theoretic mechanism requires specifying the relevant states, inputs, information, and objective. **Network control theory** often concerns how network structure and dynamics distribute the influence of external inputs. These terms acquire their precise meaning from the model and task.

### State, observation, and target

A useful starting point is a state-space model:

\[
\dot{x}=f_\theta(x,u),\qquad y=h_\theta(x)+v,\qquad z=g(x).
\]

Here, \(x\) is the state, \(u\) the input, \(\theta\) the parameters, \(y\) the observation with measurement noise \(v\), and \(z\) a task variable to be controlled. Process disturbances, discrete updates, and event-triggered resets require appropriate extensions. A state summarizes the information needed to predict the system's evolution given future inputs. An observation samples or transforms that state; the target may concern only part of it.

For a conductance-based neuron, state variables include membrane voltage and channel-gating variables. Two neurons at the same voltage can respond differently if their channels have different activation states. Current injection acts in physical units; a normalized network input need not have the same interpretation. **Integrate-and-fire models** retain subthreshold integration, a firing threshold, and a reset while omitting the action-potential waveform. They are hybrid systems: continuous evolution is interrupted by discrete events.[^neuronal-dynamics]

At the population level, rate and neural-mass models summarize collective activity. A common continuous-time recurrent model is \(\tau\dot{x}=-x+W\phi(x)+Bu\): leak competes with recurrent drive and external input, \(\tau\) sets a timescale, and \(\phi\) maps activation variables to outputs. Related equations describe biological circuit approximations and artificial recurrent neural networks (RNNs), although their variables and constraints differ. A feedforward artificial network instead implements a static mapping; when it controls a physical plant, the overall feedback system still has dynamics.

A **latent state** inferred from recordings can make high-dimensional activity tractable. Its usefulness for control depends on whether it captures relevant memory and input responses. Principal components identify directions of variance; a dynamical model additionally specifies how activity evolves. An anatomical connectome, a fitted effective interaction matrix, and the recurrent weights of a trained RNN describe different relationships.

Changing activity through \(u\), changing the plant's connections, estimating its parameters, and training a controller are distinct operations. Estimation changes our model; plasticity can change the system itself. Keeping these roles separate makes their interactions easier to understand.

## 2. Dynamics, stability, and what inputs can reach

### Attractors, transients, and input-driven computation

A **fixed point** is a state at which the dynamics vanish. A **limit cycle** is an isolated periodic orbit. When these objects are attracting, their basins contain initial conditions that converge to them. These structures help explain persistent activity, oscillations, and switching between regimes. Other computations depend on transient trajectories or continuing external drive rather than convergence to an attractor.

Stability specifies a response to perturbation. Local asymptotic stability means sufficiently nearby trajectories remain nearby and eventually converge to the target; global stability extends the relevant property across the state space. A stable periodic orbit can recover its shape while retaining a phase shift. Regulating its phase is therefore a different objective from maintaining the oscillation.

Linearization describes small deviations around an operating point. For continuous-time linear dynamics, eigenvalues with negative real parts imply asymptotic stability, but non-normal coupling can still produce substantial transient amplification. This distinction matters when interpreting brief neural responses. A **Lyapunov function** provides another approach: a scalar function that vanishes at the target, is positive nearby, and decreases along nonstationary trajectories can certify stability and identify a region of attraction without solving every trajectory.[^control-foundations]

Stability belongs to the specified system, including its feedback. In a normalized teaching example, the plant \(\dot{x}=-x+u\) is stable without input, but the feedback \(u=kx\) produces \(\dot{x}=(k-1)x\), which is unstable for \(k>1\). Even a memoryless controller can therefore change stability through the sign and gain of feedback.

For input-driven networks, **contraction** concerns convergence between trajectories receiving the same input. It formalizes forgetting of initial conditions, useful for reproducible state estimation and recurrent prediction. Revay and Manchester construct recurrent model classes with sufficient contraction conditions using a learned metric rather than only restricting Euclidean weight norms.[^contracting-rnn] The metric determines how deviations are measured. Global contraction also excludes coexisting persistent states under the same constant input, so it is a substantive modeling choice when studying memory. Stability constraints should preserve the dynamics a task needs.

### Phase as a useful reduced state

Near a stable oscillation, sufficiently weak perturbations can often be described by a phase model:

\[
\dot{\varphi}=\omega+Z(\varphi)u.
\]

The phase \(\varphi\) locates the system within its cycle, \(\omega\) is its unforced angular frequency, and the **phase response curve (PRC)** \(Z\) describes sensitivity to input at each phase. The units of \(Z\) convert applied input into an angular rate. Depending on the PRC, a pulse can advance or delay the next event according to its timing. Larger pulses may require a finite-amplitude phase response function or a model that also retains displacement away from the cycle.

Stigen and colleagues used phase-response-based feedback to control spike timing and synchrony in neuronal models and brain-slice experiments.[^spike-timing] This is an informative reduction: the controller uses timing sensitivity rather than reconstructing every ionic variable. It works because the chosen description retains the input–response relationship needed for the task.

### Reachability depends on inputs and time

For an \(n\)-state linear model \(\dot{x}=Ax+Bu\), **controllability** asks whether inputs can move the state between arbitrary points within the model. The columns of \(B\) specify direct input directions; \(AB,A^2B,\ldots,A^{n-1}B\) describe how dynamics distribute their influence. Full rank of their concatenation gives the familiar controllability criterion. **Stabilizability** is weaker: uncontrollable modes may be acceptable if they already decay.

The finite-horizon **controllability Gramian** summarizes the accumulated influence of inputs. For unconstrained inputs, quadratic effort \(\int_0^T u^\top u\,dt\), and an invertible Gramian \(W_c(T)\), the minimum effort to produce a displacement \(\delta\) from the unforced endpoint is \(\delta^\top W_c(T)^{-1}\delta\). Small Gramian eigenvalues identify expensive directions. Thus, full-rank controllability can coexist with practically prohibitive effort or sensitivity to error.

This analysis depends on the dynamics, input channels, horizon, and coordinate scaling. Input limits, nonnegative light intensity, and restricted stimulation sites change the reachable set. A quadratic input cost is not automatically energy in joules or a biological damage measure. **Structural controllability** addresses generic parameter choices consistent with a connectivity pattern; a particular weighted network and an implementable stimulation protocol require further specification. Nonlinear systems additionally depend on operating region and the order in which inputs are applied.

Control-oriented reduction consequently differs from retaining the largest principal components. A low-variance activity direction may carry a strong response to stimulation or strongly influence a downstream readout. Removing it can preserve a convincing picture of natural activity while changing predicted control effects. Selecting recording and stimulation channels likewise concerns access to task-relevant directions, not simply the number of sites.

## 3. Observing and identifying a feedback system

### Estimation from incomplete measurements

**Observability** asks whether states can be distinguished through outputs over time under known inputs. For a linear observation \(y=Cx\), the matrix \(C\) and the dynamics \(A\) jointly determine which distinctions become visible. **Detectability** permits unobservable modes that decay. **Identifiability** concerns a different unknown: whether candidate parameter values or models can be distinguished from the available experiments.

A state estimator alternates prediction from the previous estimate and known input with correction from new observations. In a Kalman filter, the **innovation** is the observed output minus its predicted value; the gain weights that discrepancy using uncertainty in the prediction and measurement. Nonlinear filters approximate this recursion or represent the state distribution with samples. A smoother also uses later observations and is useful offline; a real-time controller must operate on information already available.

Spikes are events, while a firing rate is an estimated intensity. In a basic count model, \(n_k\sim\mathrm{Poisson}(\lambda_k\Delta t)\), where \(\lambda_k\) is a rate in spikes per second and \(\Delta t\) is the bin duration in seconds. A short bin with no spikes is compatible with a nonzero rate. For a roughly constant rate, longer bins reduce rate-estimation variance at the cost of temporal resolution. The observation model and estimator therefore help determine the bandwidth of feedback.

Bolus and colleagues combined linear dynamical models, an adaptive Kalman estimator, and linear–quadratic feedback with integral action to regulate individual thalamic neurons' firing rates in awake mice.[^optogenetic-state-space] Integral action accumulates persistent tracking error and helps compensate for offsets. Their models connected target rates, noisy spike observations, and a constrained optical input. Simultaneously recorded neighbors responded heterogeneously; the extension to multi-output control was examined in simulations. This separates an experimentally controlled output from the wider population affected by stimulation.

### Learn responses to inputs, not only familiar trajectories

**System identification** estimates dynamical relationships from input–output data. Mechanistic, black-box, and grey-box models differ in how much structure is specified before fitting. Model choice should retain the responses relevant to the intended operating conditions.[^identification]

A simple teaching example shows why recording inputs matters. If a linear system receives state feedback \(u=-Kx\), then its observed evolution is governed by \(A-BK\). Fitting autonomous dynamics to that activity can recover the closed-loop behavior rather than the original plant. Feedback also correlates inputs with disturbances, affecting identification assumptions. Recorded commands and deliberately varied reference signals can help separate these contributions.

**Persistent excitation** means that inputs contain enough variation to identify the modeled relationships. Repeating one stimulus precisely may estimate that response well while leaving other directions unresolved. Frequency content, amplitude, initial state, and operating regime determine which aspects of the system are probed. In nonlinear systems, matching input power spectra alone does not ensure equivalent state-space coverage.

One-step prediction uses frequent observational correction. Multi-step prediction and free simulation test what happens when the model evolves further on its own; controlled prediction additionally asks about new input sequences. Residual temporal structure and correlations with past inputs can reveal missing dynamics. A useful model need not explain every fluctuation, but its errors should be understood where control will use it. Actions that improve regulation and actions that improve knowledge can differ; **dual control** explicitly considers both consequences.

## 4. Computing actions and learning controllers

### Objectives determine what counts as an error

An illustrative finite-horizon planning problem is

\[
\min_{u_{0:T-1}}\sum_{k=0}^{T-1}\ell(x_k,u_k)+\ell_T(x_T),
\qquad x_{k+1}=f_\theta(x_k,u_k).
\]

The running cost \(\ell\) and terminal cost \(\ell_T\) encode the task and input expenditure. Constraints specify admissible states and actions. Under uncertainty, a controller may optimize expected cost, risk, or worst-case performance. **Regulation**, **tracking**, and **state transfer** emphasize maintaining a target, following a reference over time, and reaching an endpoint, respectively.

The objective also matters in biological explanations. Todorov and Jordan's optimal-feedback account of motor coordination predicts task-dependent correction: variation can persist in redundant dimensions while task-relevant errors are corrected.[^motor-control] For example, many joint configurations can place the hand at the same target. Correcting every deviation from one prescribed trajectory spends effort on distinctions the task may not require. Their minimal intervention principle connects task geometry, motor variability, and feedback responses, supported by modeling and behavioral experiments. It is a computational account of coordination; identifying how neural circuits acquire and implement such policies is a further research problem.

### From tractable solutions to numerical optimization

For linear dynamics and quadratic costs, the **linear–quadratic regulator (LQR)** yields a linear feedback law. A Riccati equation or recursion computes the quadratic value function—the optimal remaining cost—and the associated feedback gain. This makes LQR a useful reference solution and a local building block for nonlinear control. In the classical linear–Gaussian setting with the usual independent noise assumptions and quadratic objective, estimation and regulation can be designed separately and combined as **linear–quadratic–Gaussian control (LQG)**. Signal-dependent noise, input constraints, or nonlinear observations generally change this separation.

More generally, **dynamic programming** expresses the value of a state through current cost and optimal future cost; its continuous-time form is the Hamilton–Jacobi–Bellman equation. Pontryagin's maximum principle instead gives necessary optimality conditions along candidate trajectories using costates, which propagate sensitivity of future cost to changes in state. These formulations connect feedback policies, value functions, and trajectory optimization, but their computational costs differ sharply with dimension.

| Computational route | Main operation | Typical output |
|---|---|---|
| Shooting | Simulate candidate inputs and improve their objective | Control sequence and simulated trajectory |
| Collocation | Optimize states and inputs jointly while enforcing discretized dynamics | A dynamically consistent trajectory approximation |
| Iterative LQR (iLQR) / differential dynamic programming | Build local dynamics and cost approximations; alternate backward updates and forward rollouts | An improved trajectory with local feedback corrections |
| Policy optimization | Update parameters of a reusable action-selection rule | A feedback policy |

Initialization, regularization, and constraint handling affect which solution a nonlinear optimizer finds. Differentiating through a model supplies sensitivities of predicted outcomes to actions. For spiking models, threshold crossings and resets affect those sensitivities. Event-aware differentiation accounts for changes in event timing; surrogate gradients substitute tractable derivatives for problematic threshold operations. The relevant question is which dynamics and objective the update actually follows.

### Replanning and learning

**Model predictive control (MPC)** repeatedly estimates the current state, optimizes a finite future, executes the first action or short action segment, and replans. It is a feedback architecture, not a particular optimizer. It can use linear models, nonlinear neural models, gradient methods, or sampling. Replanning compensates for some prediction errors, while the horizon, constraints, and available computation still shape performance.

In PETS, Chua and colleagues train an ensemble of probabilistic neural dynamics models and propagate sampled trajectories through them.[^pets] Candidate action sequences are evaluated across these predicted futures. The cross-entropy method refits a sampling distribution toward promising sequences, and MPC executes only the next action before updating the plan. Neural networks provide the model; online optimization supplies the control decision. Ensemble disagreement approximates **epistemic uncertainty** from limited knowledge of the dynamics; each model's output distribution also represents **aleatoric uncertainty**, or variability remaining under a specified state and action. The distinction guides data collection: further observations may resolve a poorly known relationship, whereas genuinely stochastic outcomes remain variable even with a well-estimated model. Shared model bias can still escape ensemble disagreement, so predictive uncertainty needs evaluation on relevant held-out inputs.

Policy learning moves more computation into training. With a differentiable model, gradients can pass through predicted trajectories. In an **actor–critic** method, the actor selects actions and the critic estimates future return to guide updates. Model-free reinforcement learning dispenses with an explicit transition model in its policy or value updates; it can still be trained using a simulator. Model-based learning, MPC, and reinforcement learning consequently overlap rather than forming mutually exclusive categories.

Data efficiency, training cost, and action-selection latency are different resources. A method can need few interactions yet perform expensive optimization between them. Another can spend heavily on training and execute a cheap policy online. Comparisons become informative when they specify what information each method receives, which computations happen during interaction, and whether the task requires immediate responses.

**Robust control** designs for specified uncertainty; **adaptive control** updates model or controller parameters during operation. Neither is synonymous with deep learning. Constraints can also be enforced by modifying a proposed action: a control barrier function can support an online optimization that keeps the modeled state within an admissible set. The certificate's assumptions, input feasibility, and runtime determine what this construction guarantees. A well-matched linear controller is often a more informative baseline than an unnecessarily elaborate learned one.

## 5. Shaping neural dynamics through training and feedback

### Learning a computation changes more than a readout

A recurrent network can transform inputs through rich internal dynamics while a simple readout extracts task variables. **Reservoir computing** emphasizes this division by retaining a largely fixed recurrent network and training an output mapping. Its useful memory depends on how past inputs persist while initialization effects fade.

Training recurrent connections changes the vector field itself. In **full-FORCE**, a separate target-generating network receives task inputs, desired outputs, and sometimes additional hints. Recursive least squares adjusts the task-performing network's recurrent weights to match target internal drives. The trained network must then generate useful dynamics without receiving the desired output as an input.[^full-force] This connects supervised learning with constructing and stabilizing a dynamical computation. It also explains why accurate teacher-driven behavior and autonomous task performance are different tests.

Training a biological model by backpropagation or least squares specifies how a researcher obtained its weights. A proposal about biological learning additionally concerns the information available to synapses, temporal credit assignment, and the source of teaching signals. Algorithmic success and physiological implementation can inform each other without being identical research questions.

### State availability does not imply arbitrary temporal ordering

Brain–computer interfaces (BCIs) provide an unusually direct way to connect population activity with consequences. A chosen mapping converts neural activity into cursor motion or another output, and the animal adapts within that feedback loop. Researchers can therefore make particular activity patterns behaviorally useful and test which changes are readily achieved.

Oby and colleagues challenged monkeys to produce familiar motor-cortical population patterns in altered temporal order.[^bci-dynamics] Feedback exposed dimensions with direction-dependent trajectories, and subsequent tasks encouraged time-reversed paths. The monkeys showed limited flexibility: they often followed the characteristic flow before approaching a target, and tighter path constraints increased failures rather than producing arbitrary reversals. The observations concern the tested mappings, inputs, and within-session learning timescale. They reveal temporal constraints beyond the availability of individual activity patterns.

This connects neural population geometry to control. A set of visited states describes a repertoire; the vector field and accessible inputs govern movement through it. Learning may expand a repertoire, alter dynamics, change input strategies, or adjust a readout. These possibilities predict different trajectories and transfer patterns, making interventions on feedback structure useful for studying computation itself.

## 6. Measurements, interventions, and closed-loop evidence

### The physical loop is part of the system

A real loop includes acquisition, signal processing, estimation, computation, actuation, and the plant's response. Electrical stimulation, optogenetics, and intracellular current injection differ in spatial recruitment, kinetics, and usable input ranges. **Dynamic clamp** measures membrane voltage, computes a model current or conductance, and injects the resulting current in real time, creating a hybrid biological–computational system.

Timing changes the effect of feedback. Filtering and finite windows introduce delay; a fixed delay produces a larger phase shift at higher frequencies. A high sampling rate alone does not imply a fast effective loop. Offline zero-phase filtering or smoothing can help characterize a signal, but the deployed estimator must be evaluated with its actual causal processing and latency.

For a stable linear approximation, the **frequency response** describes how steady sinusoidal inputs are scaled and phase-shifted at each frequency. Bode plots display these gain and phase relationships. Closed-loop **bandwidth** characterizes the frequency range over which a specified response, such as reference tracking, remains effective. Increasing feedback gain can improve tracking while amplifying measurement noise, approaching actuator limits, or reducing tolerance to delay. For single-input, single-output loops, gain and phase margins quantify specified changes that would bring the linear loop to a stability boundary. These tools connect recordings and stimulation responses to the timescales that a controller can use.

Zaaimi and colleagues used phase-shifted field-potential feedback to drive excitatory optogenetic stimulation in mouse slices and anesthetized nonhuman primates.[^phase-feedback] Depending on the feedback phase, stimulation enhanced or suppressed oscillatory activity. The result illustrates a genuinely dynamical intervention: activating cells does not prescribe the sign of the resulting change in a population rhythm. Their models and experimental measurements connect timing, oscillation structure, and sensitivity to perturbations. Concurrent electrical recording supported the loop; wavelength and opsin-negative controls helped distinguish neural responses from optical recording artifacts.

Artificial controllers provide a complementary example of the complete loop. Degrave and colleagues trained neural policies in a plasma simulator and deployed a compact feedforward policy for magnetic control on the TCV tokamak.[^plasma-control] Training used a larger recurrent critic than could be deployed at the control rate. Sensor and actuator modeling, parameter variation, and executable inference latency helped bridge simulation and hardware. Training-time computation and online control were deliberately different.

### Compare effects at the level of the scientific claim

Tracking error, recovery time, input expenditure, saturation, and constraint violations describe different aspects of control. Mean-square error weights large deviations strongly; average performance can obscure intermittent failures or adaptation. Firing rate, oscillatory power, and phase locking also measure different properties: power concerns signal amplitude, whereas phase locking concerns timing consistency. An independent neural or behavioral readout can establish whether a controlled proxy tracks the intended outcome.

Open-loop, replay, and yoked comparisons answer different questions. Replaying a successful stimulus sequence can test the contribution of its contingency on ongoing activity, but a new initial state or noise realization changes the resulting trajectory. Matching total input expenditure helps isolate one resource difference; temporal structure and recruitment may still differ.

Validation should reflect the intended transfer: new trials, input regimes, sessions, animals, network realizations, or environments. Randomly splitting adjacent time points can leave nearly identical dynamical contexts on both sides. Cells and time bins within one session do not provide independent replication across subjects. Preserve these levels when estimating uncertainty and interpreting variation.

The most useful studies make a specific connection sharper: a reduced model captures a stimulation response, feedback reveals otherwise hidden dynamics, a learning rule constructs a reproducible computation, or a controller transfers across meaningful changes. Mathematical guarantees, controlled simulations, and biological experiments contribute different knowledge. Their value comes from how well they answer the stated question and support the next inference.

## Selected references

[^neuronal-dynamics]: Gerstner, Kistler, Naud & Paninski (2014). [Neuronal Dynamics: From Single Neurons to Networks and Models of Cognition](https://neuronaldynamics.epfl.ch/). *Cambridge University Press*. Foundations for spiking neurons, population models, and neural computation.

[^control-foundations]: Tedrake (n.d.). [Underactuated Robotics](https://underactuated.mit.edu/). *Online textbook, MIT*. Accessible development of dynamics, optimal control, Lyapunov analysis, and trajectory optimization.

[^contracting-rnn]: Revay & Manchester (2020). [Contracting Implicit Recurrent Neural Networks: Stable Models with Improved Trainability](https://proceedings.mlr.press/v120/revay20a.html). *Proceedings of Machine Learning Research*, 120, 393–403. A concrete connection between contraction metrics, recurrent model structure, and learning.

[^spike-timing]: Stigen, Danzl, Moehlis & Netoff (2011). [Controlling spike timing and synchrony in oscillatory neurons](https://doi.org/10.1152/jn.00898.2011). *Journal of Neurophysiology*, 105, 2074–2082. Phase-response-based control in models and biological neurons.

[^optogenetic-state-space]: Bolus, Willats, Rozell & Stanley (2021). [State-space optimal feedback control of optogenetically driven neural activity](https://doi.org/10.1088/1741-2552/abb89c). *Journal of Neural Engineering*, 18, 036006. Identification, estimation, and feedback linked to optogenetic regulation of firing.

[^identification]: Schoukens & Ljung (2019). [Nonlinear System Identification: A User-Oriented Road Map](https://doi.org/10.1109/MCS.2019.2938121). *IEEE Control Systems*, 39(6), 28–99. Experiment design, model choice, and validation for nonlinear input–output systems.

[^motor-control]: Todorov & Jordan (2002). [Optimal feedback control as a theory of motor coordination](https://doi.org/10.1038/nn963). *Nature Neuroscience*, 5, 1226–1235. Task-dependent variability and correction as consequences of an optimal-feedback account.

[^pets]: Chua, Calandra, McAllister & Levine (2018). [Deep Reinforcement Learning in a Handful of Trials using Probabilistic Dynamics Models](https://arxiv.org/abs/1805.12114). *Advances in Neural Information Processing Systems*, 31. Probabilistic neural models combined with trajectory sampling and MPC.

[^full-force]: DePasquale et al. (2018). [full-FORCE: A target-based method for training recurrent networks](https://doi.org/10.1371/journal.pone.0191527). *PLOS ONE*, 13(2), e0191527. Training recurrent dynamics through target internal drives.

[^bci-dynamics]: Oby et al. (2025). [Dynamical constraints on neural population activity](https://doi.org/10.1038/s41593-024-01845-7). *Nature Neuroscience*, 28, 383–393. BCI manipulations distinguish accessible activity patterns from flexible temporal trajectories.

[^phase-feedback]: Zaaimi et al. (2023). [Closed-loop optogenetic control of the dynamics of neural activity in non-human primates](https://doi.org/10.1038/s41551-022-00945-8). *Nature Biomedical Engineering*, 7, 559–575. Phase-dependent effects of excitatory feedback on population dynamics.

[^plasma-control]: Degrave et al. (2022). [Magnetic control of tokamak plasmas through deep reinforcement learning](https://doi.org/10.1038/s41586-021-04301-9). *Nature*, 602, 414–419. Neural policy learning connected to real-time physical control.
