# CHAOS model routing

## Doctrine

- A route is suitable only if it adds an operational axis (model family,
  modality, evidence route, regional bias, or capacity) and clears the
  capability floor: it must reason validly about this task. Weak routes are not
  free coverage — conforming or noisy advisers degrade cross-examination. Prefer
  the strongest available route per family over more routes; skip routes that
  add only a fluent paraphrase.
- Community reputation, public benchmarks, and model "personality" are priors
  for role assignment. They never override direct tests, inspected sources,
  citations, logs, or code evidence.
- Do not quote static context/max-token numbers. If capacity matters, inspect
  the live environment configuration or make the prompt smaller.

## Model-family priors

| Family | Prior strengths | Default duties | Cautions |
|---|---|---|---|
| Claude | careful prose, nuanced tradeoff analysis, code review, long-form critique, high-stakes reasoning | patient critic, minority-report writer, deep second-pass synthesis | slower, verbose, more cautious than needed |
| OpenAI/Codex | tool-driven code work, structured analysis, test-oriented review, concise synthesis | implementation critic, direct-verification planner, code/evidence integrator | same-family coding agents share blind spots; require fresh context and direct tests rather than counting instances as diversity |
| Gemini | long-context reading, multimodal input, broad scanning, speed | fast broad reader: source/document passes, screenshots/UI, non-PRC counterpoint | long-context capacity ≠ faithful retrieval; require quotes, tests, or a cross-family check |
| DeepSeek | reasoning, math, code exploration, efficient first-pass problem solving | builder/proposer: architecture sketches, repair plans, code/math exploration | proposal generator, not final arbiter; require tests or cross-model critique |
| Kimi | long context, Chinese-English, code/tool orientation, long-form output | decomposer and explainer: long-document planning, bilingual analysis | verify factual claims; provider aliases may expose different parameters |
| GLM | Chinese technical and structured reasoning, code-focused critique | fast technical critic: alternate design review, Chinese-language analysis, text-only pressure testing | verify release- or route-specific claims |

## Routing notes

| Task | Default route set |
|---|---|
| Broad judgment | Smallest approved set spanning the decision-relevant axes; expand under the protocol rule. Vote count is never truth. |
| Code | Selected critics plus direct tests; prefer tests when they settle the claim. |
| Large text corpus | A suitable long-context reader plus an independent retrieval/source check; add another family only for an unresolved axis or explicit exhaustive review. |
| Image/UI | Selected image-capable routes; verify actual image support before launch. |
| PRC-sensitive topic | Require Gemini/Claude-family or primary-source cross-check; never PRC-family routes alone. |
| Fact/current-events claim | Search or primary sources; models provide hypotheses, not freshness. |
| Final synthesis | Parent writes. Routes advise; none decides by seniority, confidence, or popularity. |

Apply the expansion rule in `references/protocols.md` before routing. In a
non-exhaustive run, a broad generalist, careful critic, and task specialist are
a common sufficient set; add a regional or model-family counterpoint only when
it covers a decision-relevant axis. If a selected route fails, replace it only
when needed to preserve that coverage.

## Environment adaptation

Route discovery depends on the running agent. Validate each route against the
live environment before launch; on failure, record a degraded perspective and
retry once with the current same-family route. Treat provider approval and data
handling as suitability constraints: minimize shared context, remove secrets,
and do not send private or proprietary material to another provider without the
user's authorization when it cannot be safely redacted.

- **Multi-model agents (e.g. pi):** inspect the live model/agent discovery
  surface before every run; it overrides this file for available routes,
  context capacity, modality, reasoning controls, tool support, and exact
  parameters. Select the OpenAI adviser only from that live result; when the
  built-in model ID `openai-codex/gpt-5.6-terra` is present, prefer it. This is
  a routing preference, not a cached availability claim. Never preserve
  provider-specific endpoint aliases in this reference as if they were current
  configuration. Use higher thinking levels only when the live route accepts
  them; do not invent temperature/top-p tables.
- **Single-vendor agents (e.g. Claude Code, Codex):** cross-family routes are
  unavailable. Run independent subagents with fresh context and differentiated
  duties, using different model sizes or reasoning levels where the platform
  allows. Independence holds; family diversity collapses — record `reduced:
  single model family` (orchestration: independence).
- **No independent agents:** degraded single-agent claim audit (orchestration:
  independence).
