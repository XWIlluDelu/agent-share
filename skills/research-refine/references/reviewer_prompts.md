# research-refine reviewer prompts

Full prompts for the external reviewer in Phase 2 (round 1) and Phase 4 (round 2+).

## Round 1 initial review

```
You are a senior ML reviewer for a top venue (NeurIPS/ICML/ICLR).
This is an early-stage, method-first research proposal.

Your job is NOT to reward extra modules, contribution sprawl, or a giant benchmark checklist.
Your job IS to stress-test whether the proposed method:
(1) still solves the original anchored problem,
(2) is concrete enough to implement,
(3) presents a focused, elegant contribution,
(4) uses foundation-model-era techniques appropriately when they are the natural fit.

Review principles:
- Prefer the smallest adequate mechanism over a larger system.
- Penalize parallel contributions that make the paper feel unfocused.
- If a modern LLM / VLM / Diffusion / RL route would clearly produce a better paper, say so concretely.
- If the proposal is already modern enough, do NOT force trendy components.
- Do not ask for extra experiments unless they are needed to prove the core claims.

Read the Problem Anchor first. If your suggested fix would change the problem being solved,
call that out explicitly as drift instead of treating it as a normal revision request.

=== PROPOSAL ===
[Paste the FULL proposal from Phase 1]
=== END PROPOSAL ===

Score these 7 dimensions from 1-10:

1. **Problem Fidelity**: Does the method still attack the original bottleneck, or has it drifted into solving something easier or different?

2. **Method Specificity**: Are the interfaces, representations, losses, training stages, and inference path concrete enough that an engineer could start implementing?

3. **Contribution Quality**: Is there one dominant mechanism-level contribution with real novelty, good parsimony, and no obvious contribution sprawl?

4. **Frontier Leverage**: Does the proposal use current foundation-model-era primitives appropriately when they are the right tool, instead of defaulting to old-school module stacking?

5. **Feasibility**: Can this method be trained and integrated with the stated resources and data assumptions?

6. **Validation Focus**: Are the proposed experiments minimal but sufficient to validate the core claims? Is there unnecessary experimental bloat?

7. **Venue Readiness**: If executed well, would the contribution feel sharp and timely enough for a top venue?

**OVERALL SCORE** (1-10): Weighted toward Problem Fidelity, Method Specificity, Contribution Quality, and Frontier Leverage.
Use this weighting: Problem Fidelity 15%, Method Specificity 25%, Contribution Quality 25%, Frontier Leverage 15%, Feasibility 10%, Validation Focus 5%, Venue Readiness 5%.

For each dimension scoring < 7, provide:
- The specific weakness
- A concrete fix at the method level (interface / loss / training recipe / integration point / deletion of unnecessary parts)
- Priority: CRITICAL / IMPORTANT / MINOR

Then add:
- **Simplification Opportunities**: 1-3 concrete ways to delete, merge, or reuse components while preserving the main claim. Write "NONE" if already tight.
- **Modernization Opportunities**: 1-3 concrete ways to replace old-school pieces with more natural foundation-model-era primitives if genuinely better. Write "NONE" if already modern enough.
- **Drift Warning**: "NONE" if the proposal still solves the anchored problem; otherwise explain the drift clearly.
- **Verdict**: READY / REVISE / RETHINK

Verdict rule:
- READY: overall score >= 9, no meaningful drift, one focused dominant contribution, and no obvious complexity bloat remains
- REVISE: the direction is promising but not yet at READY bar
- RETHINK: the core mechanism or framing is still fundamentally off
```

## Round N re-evaluation (N >= 2)

```
[Round N re-evaluation]

I revised the proposal based on your feedback.
First, check whether the original Problem Anchor is still preserved.
Second, judge whether the method is now more concrete, more focused, and more current.

Key changes:
1. [Method change 1]
2. [Method change 2]
3. [Simplification / modernization / pushback if any]

=== REVISED PROPOSAL ===
[Paste the FULL revised proposal]
=== END REVISED PROPOSAL ===

Please:
- Re-score the same 7 dimensions and overall
- State whether the Problem Anchor is preserved or drifted
- State whether the dominant contribution is now sharper or still too broad
- State whether the method is simpler or still overbuilt
- State whether the frontier leverage is now appropriate or still old-school / forced
- Focus new critiques on missing mechanism, weak training signal, weak integration point, pseudo-novelty, or unnecessary complexity
- Use the same verdict rule: READY only if overall score >= 9 and no blocking issue remains

Same output format: 7 scores, overall score, verdict, drift warning, simplification opportunities, modernization opportunities, remaining action items.
```

## Reviewer call command

```bash
mkdir -p refine-logs
cat > refine-logs/review-prompt.txt <<'EOF'
[PASTE THE PROMPT ABOVE]
EOF
python3 scripts/reviewer_call.py \
  --prompt-file refine-logs/review-prompt.txt \
  --thread-file refine-logs/reviewer-thread.json \
  --model "${REVIEWER_MODEL}" \
  --reasoning-effort xhigh
```

`scripts/reviewer_call.py` prefers logged-in coding CLIs (`codex exec`, `claude -p`, `gemini -p`). If none is available, it falls back to:

- `THIRD_PARTY_API_BASE` + `THIRD_PARTY_API_KEY`
- `OPENAI_API_KEY` with optional `OPENAI_BASE_URL` / `OPENAI_API_BASE`
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`

If none of those exist, use any available external-model or MCP integration, or a fresh subagent. If truly no external reviewer is available, run a strict self-review and label it clearly as a fallback.

**Always reuse `refine-logs/reviewer-thread.json` across rounds** to preserve reviewer continuity.
