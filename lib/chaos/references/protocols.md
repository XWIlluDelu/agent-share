# CHAOS protocols

## Mode chooser

Skip/direct is the default and needs no gate. Every other row presupposes the
gate (SKILL.md): the user asked for a deliberation mode by name, or said yes
to a one-sentence proposal. No mode in this file is an entry point on its own.

| Mode | Use when | Default shape | Required artifact | Stop condition |
|---|---|---|---|---|
| Skip/direct | Reading or assessing a document, diff, or answer; simple lookup; deterministic calculation; routine work; raw divergent ideation; or tightly coupled work better solved by direct verification. | Direct verification by parent | Brief note if useful | Answer is directly verifiable |
| Claim audit | An existing answer, plan, proposal, document, claim set, or diff needs claim-led stress testing or focused refutation before decision. | Extract claims → settle testable claims by test → parallel anonymized critique → status table → synthesis | Claim ledger; decision receipt when a decision follows | Claims have statuses or evidence is insufficient |
| Council | Broad ambiguous decision or high-stakes research/design needs independent same-question first positions. | Frame → same-question independent positions → ledger → parent-routed cross-review → revision → synthesis/minority report | Position memos + ledger; escalation artifacts when used | No new material claims or useful narrowing remains |
| Review loop | An implementation or artifact needs parent-controlled writing plus fresh independent review. | Validation contract → one writer → parallel fresh reviewers → synthesized fixes → validation | Ledger/receipt plus validation evidence | No fixes worth doing now or unapproved decision appears |

## Expansion rule

When the user explicitly requests exhaustive CHAOS, all available models, or a
full council, run all suitable approved model-family advisers and useful
evidence routes through qualifying native subagents or fresh agent sessions,
in parallel when the host permits. Respect any stated budget, provider,
privacy, or modality boundary.

Every other activation was explicitly requested or approved by the user — the
gate (SKILL.md) — and starts with the smallest sufficient independent set that
covers the decision-relevant axes:
usually a broad position, a careful critic, a task/evidence specialist, and a
counterpoint only when it adds a distinct source, method, failure mode, or model
family. Expand only when an uncovered axis or unresolved claim could change the
decision. A route is excluded when it is unavailable, unsafe, outside the data
trust boundary, off-modality, not independent, below the capability floor
(`MODEL_USAGE.md`), or weaker than direct verification.

**Test before debate.** Any claim a cheap direct check can settle is settled by
the check and enters the ledger as tested evidence. Deliberation handles only
claims verification cannot reach or where the check itself is contested.

**Whole-frame rule.** Council first positions require each adviser to answer the
same whole frame before seeing peer answers. Diversity comes from lens, evidence
route, assumptions, method, failure mode, stakeholder criterion, or model family
— never exclusive topic ownership. Topic-sharded evidence gathering is scouting:
a valid input appendix, never a first position.

## Mode recipes

### Claim audit

1. Extract falsifiable or decision-relevant claims from the target.
2. Assign each claim an evidence standard and current support; settle directly
   testable claims by test before launching critics.
3. Select critics under the expansion rule and launch them as independent
   subagents or fresh sessions against the anonymized claim set: attack weak
   evidence, invalid inference, hidden premises, missing alternatives, and
   practical risks. When the target is a proposal awaiting a decision, brief
   critics as refuters: steelman the proposal, then target the strongest
   remaining flaws.
4. Mark each claim `survived`, `narrowed`, `rejected`, `withdrawn`, `merged`,
   `unresolved`, or `dissent`.
5. Synthesize only from claims that meet the frame's evidence standard; preserve
   unresolved gaps. The parent decides accept, revise, defer, or reject.

### Council

1. Give every adviser the same frame and output schema — never peer answers,
   model identities, or the user's leaning.
2. Each first-position memo answers the whole frame, states its diversity axis,
   and names the strongest alternative it rejected.
3. Build a common claim ledger; normalize duplicate claims.
4. The parent routes cross-review: anonymized, evidence-bearing critiques only,
   prioritized toward high-confidence claims with weak evidence.
5. Record revisions; discount evidence-free reversals as conformity.
6. Unanimous first positions are a diversity failure: launch a counter-case duty
   (construct the strongest evidenced case against the consensus) or record
   reduced confidence in the receipt.
7. Synthesize with minority report.

**Escalation for high stakes:** precede with scouting; append an independent
consistency check of the near-final synthesis by a fresh adviser run; close with
a formal decision receipt and uncertainty register. Do not add rounds for
rhetoric; continue only when a new round can change a decision-relevant claim.

### Review loop

Use one writer. Parallelize reading, critique, and validation only, using native
subagents or fresh sessions under the orchestration contract. Reviewers inspect
the actual artifact, not the writer's rationale alone. The parent
accepts fixes worth doing now, rejects optional noise, and launches a single
follow-up writer only when implementation is authorized.

## Continuation rules

Continue only for new evidence, material contradiction, useful narrowing, or
unresolved decisive risk. Stop on repetition, context overload, unsupported
rhetoric, exhausted useful coverage, or when remaining uncertainty needs direct
testing or external expertise.
