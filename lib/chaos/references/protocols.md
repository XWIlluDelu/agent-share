# CHAOS protocols

## Mode chooser

| Mode | Use when | Default shape | Expansion policy | Required artifact | Stop condition |
|---|---|---|---|---|---|
| Skip/direct | Simple lookup, deterministic calculation, routine low-stakes work, raw divergent ideation, or tightly coupled work | Direct verification by parent | No advisory agents; direct verification is stronger than deliberation | Brief note if useful | Answer is directly verifiable |
| Claim audit | One answer, plan, document, claim set, or diff needs stress testing | Extract claims → check evidence → parallel critique → status table → synthesis | Launch every suitable flagship critic/checker from `MODEL_USAGE.md` in parallel; merge duplicate attacks | Claim ledger | Claims have statuses or evidence is insufficient |
| Adversarial review | One proposal needs focused refutation before decision | Proposal memo → parallel targeted critiques → response/revision → judge decision | Launch all useful refuters across distinct model families, methods, and failure modes | Critique record + decision receipt | Decisive flaw found, proposal revised, or risk remains explicit |
| Council | Broad ambiguous decision needs independent search | Frame → same-question independent positions → ledger → cross-review → synthesis/minority report | Use all suitable flagship models from `MODEL_USAGE.md`; each first-position adviser answers the whole frame, with distinct lenses/evidence emphases | Position memos + ledger | No new material claims or useful narrowing remains |
| Review loop | An implementation or artifact needs parent-controlled writing plus fresh review | Validation contract → one writer → parallel fresh reviewers → synthesized fixes → validation | Parallelize every suitable flagship reviewer/validator that can inspect the artifact independently; keep writing serialized | Ledger/receipt plus validation evidence | No fixes worth doing now or unapproved decision appears |
| Deep deliberation | High-stakes research/design or hard tradeoff needs multiple evidence routes | Scouting if needed → same-question independent positions → cross-exam → revision → independent consistency check → formal receipt | Use all suitable flagship models for whole-frame positions plus all useful tools, source paths, stakeholder criteria, and verification techniques | Ledger + uncertainty register + decision receipt | No new information, useful narrowing, or resolvable uncertainty remains |

## Expansion rule

When CHAOS is not skipped, cost is not a constraint. Run all suitable flagship advisers and useful evidence routes in parallel unless the user narrows scope or a route is unavailable, unsafe, off-modality, not independent, or weaker than direct verification.

Topic-sharded evidence gathering is scouting. Council and Deep first positions require each adviser to answer the same whole frame before seeing peer answers.

## Mode recipes

### Claim audit

1. Extract falsifiable or decision-relevant claims from the target.
2. Assign each claim an evidence standard and current support.
3. Attack weak evidence, invalid inference, hidden premises, missing alternatives, and practical risks.
4. Mark each claim `survived`, `narrowed`, `rejected`, `withdrawn`, `merged`, `unresolved`, or `dissent`.
5. Synthesize only from claims that meet the frame's evidence standard; preserve unresolved gaps.

### Adversarial review

Use constructive friction, not theatrical hostility. The critic should steelman the proposal where needed, then target the strongest remaining flaws using `claim → evidence → consequence → requested change`. The parent decides whether to accept, revise, defer, or reject.

### Council

Give every agent the same frame and output schema, but not peer answers. Each first-position agent must answer the whole frame and state its diversity axis. Do not assign mutually exclusive chapters as first positions. After first passes are saved, build a common claim ledger, assign cross-review targets, record revisions, and write a synthesis with minority report.

### Review loop

Use one writer. Parallelize reading, critique, and validation only. Reviewers inspect the actual artifact, not the writer's rationale alone. The parent accepts fixes worth doing now, rejects optional noise, and launches a single follow-up writer only when implementation is authorized.

### Deep deliberation

Use every available distinct evidence route that fits the frame: external sources, local artifacts, quantitative checks, counterfactual/risk analysis, stakeholder criteria, independent consistency review, and all suitable flagship models. If evidence routes are split by topic, call that scouting and follow it with same-frame first positions before claiming a Council/Deep run. Do not add rounds for rhetoric. Continue only when a new round can change a decision-relevant claim.

## Continuation rules

Continue only for new evidence, material contradiction, useful narrowing, or unresolved decisive risk. Stop on repetition, context overload, unsupported rhetoric, exhausted useful coverage, or when remaining uncertainty needs direct testing or external expertise.
