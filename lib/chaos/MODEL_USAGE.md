# GENERAL INFO

- Use every suitable model-family route in parallel unless direct verification is stronger, the user narrows the run, or a route is unavailable, unsafe, off-modality, redundant, or weaker than another evidence route.
- Live Pi configuration and provider responses override this file for context window, max output, modality, reasoning controls, tool support, and exact parameters.
- Validate each executable route against live Pi config before launch; on failure, record a degraded perspective and retry once with the current same-family route.
- Do not quote static context/max-token numbers from this file. If capacity matters, inspect the live config or make the prompt smaller.
- Prefer Pi thinking levels such as `:xhigh` when the route accepts them. Do not invent temperature/top-p tables unless the endpoint contract is verified.
- Community reputation, public benchmarks, and model “personality” are priors for role assignment. They never override direct tests, inspected sources, citations, logs, or code evidence.

# SUITABILITY

A route is suitable only if it adds an operational axis (model family, modality, evidence route, regional bias, or capacity); skip routes that add only a fluent paraphrase.

# MODEL FAMILIES

## GPT-family route

- **Local call:** `xwilludelu/gpt-5.5:xhigh`
- **Community/benchmark prior:** often treated as the all-rounder baseline: strong instruction following, tool use, synthesis, coding breadth, and cross-domain arbitration.
- **Personality/use:** steady generalist; good parent/final synthesis candidate after claims are grounded; good at integrating conflicting advisers into a compact decision.
- **Risks:** can sound more certain than the evidence permits; may smooth away dissent. Require citations, tests, source inspection, or cross-model critique for factual/high-stakes claims.

## Claude-family route

- **Local call:** `xwilludelu/claude-opus:xhigh`
- **Community/benchmark prior:** commonly valued for careful prose, nuanced tradeoff analysis, code review, long-form critique, and high-stakes reasoning.
- **Personality/use:** patient critic and minority-report writer; strong for subtle failure modes, writing-sensitive review, requirements drift, and deep second-pass synthesis.
- **Risks:** can be slower, more verbose, and more cautious than needed. Use when depth or dissent quality justifies the slot.

## Gemini-family route

- **Local call:** `xwilludelu/gemini-flash:xhigh`
- **Community/benchmark prior:** often strong on long-context reading, multimodal input, broad scanning, and speed; Flash-style routes trade top-end depth for throughput.
- **Personality/use:** fast broad reader; good for source/document passes, screenshots/UI, multimodal review, and non-GPT/non-PRC counterpoint.
- **Risks:** long-context capacity does not guarantee faithful retrieval. For unknown facts or volatile claims, require source quotes, tests, or another model-family check.

## DeepSeek-family route

- **Local call:** `xwilludelu/deepseek-pro:xhigh`
- **Community/benchmark prior:** strong reputation for reasoning, math, code exploration, backend logic, and efficient first-pass problem solving.
- **Personality/use:** builder/proposer; good for architecture sketches, repair plans, whole-corpus text passes, and code/math exploration before verifier review.
- **Risks:** treat as proposal generator, not final arbiter. Require tests, source checks, or cross-model critique before adoption.

## Kimi-family route

- **Local call:** `xwilludelu/kimi:xhigh`
- **Community/benchmark prior:** strong long-context and Chinese-English reputation, with useful code/tool orientation and long-form output.
- **Personality/use:** decomposer and explainer; good for long-document planning, bilingual analysis, implementation planning, and multimodal counterpoint when the route supports images.
- **Risks:** verify factual claims and route-level reasoning controls; provider aliases may expose different parameter names.

## GLM-family route

- **Local call:** `xwilludelu/glm:xhigh`
- **Community/benchmark prior:** useful Chinese technical and structured-reasoning signal; often helpful for code-focused critique and bilingual document analysis.
- **Personality/use:** fast technical critic; good for alternate design review, Chinese-language analysis, and text-only pressure testing.
- **Risks:** verify claims that depend on a specific GLM release or provider route.

# ROUTING NOTES

| Task | Default route set |
|---|---|
| Broad judgment | All suitable available families. Do not use vote count as truth. |
| Code | All suitable families plus direct tests. Include GPT, Claude, Gemini, DeepSeek, Kimi, and GLM where live config and modality fit. |
| Large text corpus | Prefer live long-context routes; include at least one GPT/Claude/Gemini-family reader and one non-Western family reader when possible. |
| Image/UI | Use image-capable live routes; verify actual image support before launch. |
| PRC-sensitive topic | Require GPT/Gemini/Claude-family or primary-source cross-check; do not rely only on PRC-family routes. |
| Fact/current-events claim | Use search or primary sources; models provide hypotheses, not freshness. |
| Final synthesis | Parent writes. A model-family route may advise, but cannot decide by seniority, confidence, or popularity. |

If all suitable routes cannot run, choose the smallest diverse set that covers the task: one broad generalist, one careful critic, one task specialist, and one independent regional/model-family counterpoint.
