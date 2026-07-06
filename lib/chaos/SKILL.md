---
name: chaos
description: "Claim-led multi-agent deliberation for high-value ambiguous or risky judgment. Use when the user asks for CHAOS, council, multi-agent debate, structured disagreement, adversarial review, claim audit, minority report, stress-test, or evidence-standard synthesis; also use for important research/design/architecture/document-interpretation decisions needing independent dissent. Avoid simple lookup, deterministic calculation, routine low-stakes edits, raw brainstorming before pruning, or tightly coupled work better solved by direct verification."
---

# CHAOS

Use CHAOS to make an important judgment survive independent search and
adversarial criticism. The parent remains judge and final writer; agents advise.

## Gate

Before launching agents, ask whether direct verification would answer better
than plural deliberation. If yes, verify directly and skip CHAOS machinery. The
gate also applies inside a run: any claim a cheap direct check can settle is
settled by the check; deliberation handles only what verification cannot reach.

## Mode chooser

| Mode | Use when |
|---|---|
| Skip/direct | Simple lookup, deterministic calculation, routine low-stakes work, raw divergent ideation, or tightly coupled work better solved by direct verification. |
| Claim audit | An existing answer, plan, proposal, document, claim set, or diff needs claim-led stress testing or focused refutation before decision. |
| Council | Broad ambiguous decision or high-stakes research/design needs independent same-question first positions. |
| Review loop | An implementation or artifact needs parent-controlled writing plus fresh independent review. |

For full recipes, escalation, and stop rules, read
[references/protocols.md](references/protocols.md). Before choosing models, read
[MODEL_USAGE.md](MODEL_USAGE.md); project-local `MODEL_USAGE.md` overrides this
default.

## Core workflow

1. **Frame.** Fill the task frame from
   [references/artifact-schemas.md](references/artifact-schemas.md): question,
   scope, evidence standard, success criterion, mode, stop rule, perspectives.
   State the question neutrally — advisers never see the user's leaning or the
   parent's preferred answer.
2. **Separate.** Launch all suitable routes in parallel (protocols: expansion
   rule; `MODEL_USAGE.md`: suitability) and collect independent first positions
   before any agent sees peer answers. Every Council first-position adviser
   answers the same whole frame and names the strongest alternative it rejected;
   topic-sharded research is scouting only.
3. **Externalize.** Convert positions into claims, assumptions, evidence,
   confidence basis, uncertainty, and risks.
4. **Cross-examine.** The parent mediates: anonymize memos by diversity axis,
   forward only evidence-bearing critiques in `claim → evidence → consequence →
   requested change` form, drop rhetoric.
5. **Revise.** Defend, narrow, correct, merge, concede, withdraw, or preserve
   dissent. A reversal citing no new evidence is conformity, not correction; the
   parent discounts it.
6. **Synthesize.** The parent normalizes claims and writes the final answer
   against the frame. Agreement counts are never truth; unanimous first
   positions trigger a diversity-failure check, not a conclusion.
7. **Record.** For nontrivial runs, keep a claim ledger. Save substantial
   outputs, verify files exist, retry one failed perspective once with a smaller
   prompt, or record the degraded perspective. Code claims require locatable
   evidence: `file:line`, diff hunk, test output, command output, or stable
   permalink.

## Output contract

Return: decision or answer; surviving claims with support;
changed/narrowed/rejected/merged/withdrawn claims; live objections or minority
report; uncertainty and validation still needed; failed/degraded perspectives;
and why the synthesis follows from the frame. If the evidence standard is unmet,
return `unresolved after exhaustive available review`, `needs direct test`,
`needs external expertise`, or `insufficient evidence`. Use
[references/artifact-schemas.md](references/artifact-schemas.md) for durable
artifact shapes.

## References and final check

Use references by need:
[references/orchestration.md](references/orchestration.md) before multi-agent
launch, artifact handling, failure handling, or review-loop coordination;
[references/adviser-prompts.md](references/adviser-prompts.md) when writing
agent prompts;
[references/evaluation-rubric.md](references/evaluation-rubric.md) before final
synthesis; [references/philosophy.md](references/philosophy.md) only when
modifying the skill or resolving protocol-design ambiguity.

Before finishing, confirm: frame explicit and neutral; every Council first
position answered the whole frame with no scouting shard counted as one; ledger
present when nontrivial; critiques anonymized, evidence-bearing, and targeted at
claim IDs; reversals cite the evidence that changed them; parent synthesis not
majority rule; dissent and validation gaps recorded.
