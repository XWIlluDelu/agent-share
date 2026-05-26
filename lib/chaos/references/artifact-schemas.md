# CHAOS artifact schemas

Use Markdown tables or compact field lists. Keep artifacts proportional to the task; nontrivial runs need at least a frame, claim ledger, and decision receipt.

## Task frame

```yaml
question: ""
scope: ""
non_goals: []
evidence_standard: ""
success_criterion: ""
expansion_policy: skip/direct | all-suitable-flagship-parallel | exhaustive-flagship-review
allowed_tools: []
allowed_models: []
stop_rule: ""
decision_owner: parent/final writer unless user names another owner
run_status: full | degraded single-agent claim audit | degraded missing perspective
planned_perspectives: [] # lenses/evidence emphases for whole-frame first positions, not exclusive topic shards
launched_models_or_routes: []
failed_perspectives: []
```

## Position memo

```yaml
agent_or_source: ""
diversity_axis: "source path | method | assumptions | evidence standard | failure mode | stakeholder criterion | verification technique | model family"
answer: "" # must address the whole framed question for Council/Deep first positions
claims: []
evidence: []
assumptions: []
uncertainty: []
risks: []
confidence_basis: ""
```

## Claim ledger

| Field | Meaning |
|---|---|
| `id` | Stable claim ID. |
| `claim` | Specific claim under review. |
| `type` | `fact`, `inference`, `design`, `risk`, or `todo`. |
| `owner/source` | Agent, document, code location, source, or parent extraction. |
| `evidence` | Source, observation, calculation, test, command, `file:line`, diff hunk, or stable permalink. |
| `assumptions` | Premises needed for the claim to hold. |
| `confidence` | Level plus basis; unsupported confidence has no decision weight. |
| `attacks` | Critiques linked to claim IDs. |
| `defenses` | Responses or stronger support. |
| `revision_history` | Defended, narrowed, corrected, merged, conceded, or withdrawn changes; concede maps to withdrawn unless evidence shows the claim should be rejected. |
| `status` | `survived`, `narrowed`, `rejected`, `withdrawn`, `merged`, `unresolved`, or `dissent`. |
| `decision_impact` | What changes if this claim is true or false. |

Code-related claims require locatable code evidence: `file:line`, diff hunk, test output, command output, or stable commit/permalink. If unavailable, mark the claim as a hypothesis or validation gap.

## Critique record

```yaml
target_claim: "C-001"
flaw_type: weak evidence | invalid inference | missing alternative | hidden premise | contradiction | practical risk | validation gap
evidence: ""
consequence: ""
requested_change: "defend | narrow | correct | merge | withdraw | test | mark unresolved"
```

## Revision record

```yaml
claim_id: "C-001"
change_type: defend | narrow | correct | merge | concede | withdraw | preserve_dissent
old: ""
new: ""
reason: ""
support: ""
accepted_by_judge: "parent/final writer only"
```

Advisory agents may propose claim statuses and revisions. Only the parent/final writer fills final judge acceptance fields unless the user explicitly names another human decision owner.

## Decision receipt

```yaml
final_decision: ""
synthesizer: parent/final writer
frame_reference: ""
evidence_standard: ""
accepted_claims: []
rejected_or_changed_claims: []
withdrawn_claims: []
live_dissent: []
unresolved_gaps: []
validation_required: []
failed_or_degraded_perspectives: []
decision_despite_dissent: "why this decision follows, or unresolved after exhaustive available review"
```

## Minority report

For each live objection, record:

```yaml
objection: ""
why_it_may_matter: ""
evidence_needed_to_resolve: ""
consequence_if_true: ""
```

## Evidence appendix

Use when the main ledger would become noisy. Include claim ID, evidence type, locator, observed output or quote, expected output if relevant, validation status, and retrieval date if source freshness matters.
