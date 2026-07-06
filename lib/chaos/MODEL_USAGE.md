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
| Gemini | long-context reading, multimodal input, broad scanning, speed | fast broad reader: source/document passes, screenshots/UI, non-PRC counterpoint | long-context capacity ≠ faithful retrieval; require quotes, tests, or a cross-family check |
| DeepSeek | reasoning, math, code exploration, efficient first-pass problem solving | builder/proposer: architecture sketches, repair plans, code/math exploration | proposal generator, not final arbiter; require tests or cross-model critique |
| Kimi | long context, Chinese-English, code/tool orientation, long-form output | decomposer and explainer: long-document planning, bilingual analysis | verify factual claims; provider aliases may expose different parameters |
| GLM | Chinese technical and structured reasoning, code-focused critique | fast technical critic: alternate design review, Chinese-language analysis, text-only pressure testing | verify release- or route-specific claims |

## Routing notes

| Task | Default route set |
|---|---|
| Broad judgment | All suitable available families. Vote count is never truth. |
| Code | All suitable families plus direct tests. |
| Large text corpus | Live long-context routes; at least one Claude/Gemini-family reader and one non-Western-family reader when possible. |
| Image/UI | Image-capable live routes; verify actual image support before launch. |
| PRC-sensitive topic | Require Gemini/Claude-family or primary-source cross-check; never PRC-family routes alone. |
| Fact/current-events claim | Search or primary sources; models provide hypotheses, not freshness. |
| Final synthesis | Parent writes. Routes advise; none decides by seniority, confidence, or popularity. |

If all suitable routes cannot run, choose the smallest diverse set that covers
the task: one broad generalist, one careful critic, one task specialist, and one
independent regional/model-family counterpoint.

## Environment adaptation

Route discovery depends on the running agent. Validate each route against the
live environment before launch; on failure, record a degraded perspective and
retry once with the current same-family route.

- **Multi-model agents (e.g. pi):** read the live model configuration for
  available routes; it overrides this file for context window, max output,
  modality, reasoning controls, tool support, and exact parameters. Prefer
  thinking levels such as `:xhigh` when the route accepts them; do not invent
  temperature/top-p tables unless the endpoint contract is verified. Current pi
  aliases: `xwilludelu/claude-opus`, `xwilludelu/gemini-flash`,
  `xwilludelu/deepseek-pro`, `xwilludelu/kimi`, `xwilludelu/glm`.
- **Single-vendor agents (e.g. Claude Code, Codex):** cross-family routes are
  unavailable. Run independent subagents with fresh context and differentiated
  duties, using different model sizes or reasoning levels where the platform
  allows. Independence holds; family diversity collapses — record `reduced:
  single model family` (orchestration: independence).
- **No independent agents:** degraded single-agent claim audit (orchestration:
  independence).
