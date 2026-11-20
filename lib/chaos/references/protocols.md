# CHAOS protocols

## Mode contracts

Skip/direct is the default and needs no gate. Every deliberation mode below
presupposes the `SKILL.md` gate (explicit user request or approval of a
one-sentence proposal); see `SKILL.md` for when each mode applies.

| Mode | Default shape | Required artifact | Stop condition |
|---|---|---|---|
| Skip/direct | Direct verification by parent | Brief note if useful | Answer is directly verifiable |
| Claim audit | Extract claims → test testable claims → parallel anonymized critique → status table → synthesis | Compact record (single issue) or claim ledger + decision receipt (multi-claim/audit) | Claims have statuses or evidence is insufficient |
| Council | Frame → same-question independent positions → claim summary or ledger → parent-routed cross-review → revision → synthesis (with minority report if dissent remains) | Position memos + compact record (single issue) or full ledger/receipt (multi-round/audit); escalation artifacts when used | No new material claims or useful narrowing remains |
| Review loop | Validation contract → one writer → parallel fresh reviewers → synthesized fixes → validation | Compact record or ledger/receipt plus validation evidence | No fixes worth doing now or unapproved decision appears |

## Expansion rule

When the user explicitly requests exhaustive CHAOS, all available models, or a
full council, run all suitable approved model-family advisers and useful
evidence routes through qualifying native subagents or fresh agent sessions (in
parallel when the host permits), respecting budget, provider, privacy, and
modality boundaries.

Every other activation starts with the smallest sufficient independent set
covering the decision-relevant axes (usually a broad position, a careful critic,
a task/evidence specialist, plus a counterpoint only when it adds a distinct
source, method, failure mode, or model family). Expand only when an uncovered
axis or unresolved claim could change the decision. Exclude any route that is
unavailable, unsafe, outside the data trust boundary, off-modality, not
independent, unable to reason validly about the task, or weaker than direct
verification.

- **Model selection:** inspect the host's live available models before launch.
  When choosing advisers and assigning duties, the agent may look up the
  strengths, style, and reported weaknesses of the specific models available for
  the task. Use those findings as priors for route and duty selection, never to
  override direct verification or inspected evidence.
- **Test before debate:** settle any claim a cheap direct check can answer and
  enter it as tested evidence; deliberate only what verification cannot reach.
- **Whole-frame rule:** Council first positions answer the same whole frame
  before seeing peer answers. Diversity comes from lens, evidence route,
  assumptions, method, failure mode, stakeholder criterion, or model family —
  never exclusive topic ownership. Topic-sharded research is scouting only,
  never a first position.

## Mode recipes

### Claim audit

1. Extract falsifiable or decision-relevant claims from the target.
2. Assign each claim an evidence standard and current support; settle directly
   testable claims by test before launching critics.
3. Launch independent critics against the anonymized claim set to attack weak
   evidence, invalid inference, hidden premises, missing alternatives, and
   practical risks. For a decision proposal, brief critics to steelman it first,
   then target the strongest remaining flaws.
4. Mark each claim `survived`, `narrowed`, `rejected`, `withdrawn`, `merged`,
   `unresolved`, or `dissent`.
5. Synthesize only from claims meeting the evidence standard; preserve
   unresolved gaps. The parent decides accept, revise, defer, or reject.

### Council

1. Give every adviser the same frame and output schema — never peer answers,
   model identities, or the user's leaning.
2. Each first-position memo answers the whole frame, states its diversity axis,
   and names the strongest alternative it rejected.
3. Normalize duplicate claims; build a common claim ledger when tracking
   multiple claims, revision rounds, or an audit trail (for a single contested
   issue, keep a compact claim summary instead).
4. Route anonymized, evidence-bearing critiques, prioritizing high-confidence
   claims with weak evidence.
5. Record revisions; require each change to cite the specific evidence,
   falsified premise, or corrected inference that changed the conclusion, and
   discount ungrounded reversals as conformity.
6. When first positions are unanimous, inspect them for shared blind spots.
   Launch a counter-case duty or targeted check when advisers share a decisive,
   unverified assumption or narrow evidence basis; do not automatically add a
   counter-case or lower confidence when genuinely independent evidence routes
   converge.
7. Synthesize against the frame, adding a minority report whenever live dissent
   remains.

**Escalation for high stakes:** precede with scouting; append an independent
consistency check of the near-final synthesis by a fresh adviser run; close with
a formal decision receipt and uncertainty register.

### Review loop

Use one writer. Parallelize reading, critique, and validation only. Reviewers
inspect the actual artifact, not the writer's rationale alone. The parent
accepts fixes worth doing now, rejects optional noise, and launches a single
follow-up writer only when implementation is authorized.

## Continuation rules

Continue only for new evidence, material contradiction, useful narrowing, or
unresolved decisive risk. Stop on repetition, context overload, unsupported
rhetoric, exhausted coverage, or when remaining uncertainty needs direct testing
or external expertise.
