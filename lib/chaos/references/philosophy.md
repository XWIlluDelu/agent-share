# Philosophy of Multi-Agent Collaboration

## 1. What this object is

CHAOS is a disciplined multi-agent deliberation protocol. It turns an important
question from one uninterrupted answer into a contest of independent judgments:
agents form positions separately, expose their claims, criticize one another,
revise under evidence pressure, and leave a record of both agreement and
unresolved dissent.

It is not a vote, a swarm, or a simulation of a meeting. Its purpose is to make
judgment harder to fool. The basic unit is the claim: something that can be
supported, attacked, narrowed, withdrawn, or preserved as dissent.

A good CHAOS result is not merely an answer. It is an answer with visible stress
marks: what survived criticism, what changed, what remains uncertain, and which
minority objections still matter.

## 2. Fundamental implementation method

Concrete tactics vary — proposer–critic–judge, parallel inquiry, adversarial
review, voting with minority reports, or claim-led artifact review — but the
invariant path is the seven-stage workflow in `SKILL.md`: frame, separate first,
externalize claims, cross-examine, revise under evidence pressure, synthesize as
a responsible judge, and retain unresolved dissent.

Background literature consulted when designing CHAOS is listed in
[`../design/source-bibliography.md`](../design/source-bibliography.md).

## 3. What it primarily leverages

**Independence.** Separate first passes reduce anchoring and widen the search
space.

**Substantive diversity.** Different models, roles, sources, methods,
assumptions, or review duties increase the chance that a useful hypothesis
appears before debate begins. Mere plurality is not enough.

**Adversarial criticism.** False or weak claims are often easier to refute once
stated than to prevent in a single generation. Debate exploits this asymmetry.

**Evidence pressure.** Claims must answer to sources, calculations,
observations, tests, or explicit reasoning. Fluency and confidence do not
substitute for support.

**Persistent artifacts.** Claims, critiques, concessions, and dissent remain
inspectable. This prevents the final answer from hiding its path.

**Responsible synthesis.** The system does not outsource judgment to the crowd.
It uses the crowd to expose the material on which judgment should be made.

## 4. What it achieves

CHAOS improves judgment by changing the shape of reasoning.

It improves **coverage**: more hypotheses, failure modes, assumptions, and
evidence paths are considered.

It improves **error correction**: hallucinations, brittle reasoning, missing
cases, and unsupported assumptions face direct attack.

It improves **calibration**: the output separates known facts, plausible
inferences, unresolved uncertainty, and live disagreement.

It improves **robustness**: the answer has already encountered counterargument
before it reaches the user.

It improves **auditability**: the final synthesis can show why a claim survived,
why another failed, and why some dissent remains.

The gain is not louder confidence. The gain is a clearer boundary between what
the system can defend and what it cannot.

## 5. Necessary precautions

**Consensus is not truth.** Agents can share biases, copy confident errors, or
suppress correct minorities. Agreement is a process signal, not proof.

**Diversity must be real.** Persona labels are cosmetic unless they produce
different hypotheses, evidence routes, standards, or failure detection.

**Confidence must be earned.** Self-reported confidence is often miscalibrated.
It should be logged and challenged, not blindly weighted.

**Evidence must beat rhetoric.** Verbosity, polish, and authority are common
failure modes. The protocol should reward correction and source quality.

**More rounds are not automatically better.** Long debates can waste tokens,
overload context, repeat arguments, or entrench wrong consensus. Continue only
while new evidence, correction, or useful distinction appears.

**Capability still bounds the system.** Debate cannot make weak agents reliably
evaluate reasoning they do not understand.

**Use it where it fits.** CHAOS is for high-value, ambiguous, adversarial,
research-heavy, design-heavy, or risk-sensitive judgment. Simple lookup,
deterministic calculation, and routine low-stakes work usually need direct
verification, not debate.

**Keep responsibility explicit.** Multi-agent deliberation informs judgment; it
must not hide who or what made the final synthesis.
