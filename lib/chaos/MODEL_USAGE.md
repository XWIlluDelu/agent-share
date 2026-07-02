# GENERAL INFO

CHAOS is claim-led multi-agent deliberation. The parent stays judge and final writer; independent advisers expose claims, evidence routes, objections, and dissent. Evidence beats consensus.

This file is an operational routing guide, not a model specification.

- Use every suitable model-family route in parallel unless direct verification is stronger, the user narrows the run, or a route is unavailable, unsafe, off-modality, redundant, or weaker than another evidence route.
- Treat route names such as `xwilludelu/gpt-5.5` as local Pi aliases. They are executable handles, not claims about public model identity or fixed upstream capability.
- Live Pi configuration and provider responses override this file for context window, max output, modality, reasoning controls, tool support, and exact parameters.
- Do not quote static context/max-token numbers from this file. If capacity matters, inspect the live config or make the prompt smaller.
- Prefer Pi thinking levels such as `:xhigh` when the route accepts them. Do not invent temperature/top-p tables unless the endpoint contract is verified.
- Community reputation, public benchmarks, and model “personality” are priors for role assignment. They never override direct tests, inspected sources, citations, logs, or code evidence.
- Project-local `MODEL_USAGE.md` overrides this file.

# ROUTE NAMES AND VERSION WORDING

Use two names for two jobs:

| Job | Use | Rule |
|---|---|---|
| Executable call | Exact local route, e.g. `xwilludelu/gpt-5.5:xhigh` | Required when launching a model. Validate against live Pi config; if it fails, record a degraded perspective and retry once with the current same-family route. |
| Deliberation label | Family label, e.g. GPT-family, Claude-family, Gemini-family | Use in frames, ledgers, summaries, and diversity axes. Do not make public-release claims from local aliases. |

Do not replace executable calls with vague labels such as `gpt` or `gpt series`; agents cannot launch those. Do replace prose like “GPT-5.5 is best at X” with “GPT-family route is commonly strong at X” unless the backing model is verified. The stable guidance belongs at the family level; only the small call handle should change when the provider changes aliases.

# USING COMMUNITY AND BENCHMARK SIGNALS

Use public and community signals as dated, task-specific priors:

| Signal | Best use | Failure mode |
|---|---|---|
| Chatbot Arena / LMSYS-style preference | Broad user preference, instruction following, general taste | Preference is not factuality; style can beat correctness. |
| Artificial Analysis and similar scoreboards | Cross-provider intelligence, speed, price, context, modality comparisons | Provider routing and limits may differ from local upstream. |
| SWE-bench, Aider, LiveCodeBench, HumanEval-family | Coding and repair priors | Benchmark code skill may not transfer to this repository or tool harness. |
| GPQA, MMLU-Pro, math/science leaderboards | Hard reasoning priors | Scores do not prove a specific generated claim. |
| MMMU, MathVista, OCR/UI evals | Vision and multimodal priors | Screenshots and documents still need direct inspection. |
| Long-context retrieval evals | Large-document routing priors | Long context is not the same as faithful use of context. |
| Community field reports | Personality and workflow fit: cautious, terse, contrarian, verbose, fast, tool-friendly | Anecdote, release churn, and fandom bias. Convert traits into operational roles. |

Record benchmark-based claims with source and date when they materially affect routing. Otherwise keep them as uncited priors and verify the actual task directly.

# SUITABILITY CHECKLIST

A route is suitable only if it adds at least one operational axis:

- model-family independence;
- modality fit: text, image/UI, long document, code, math, search-heavy work;
- evidence route: source inspection, local test, external research, quantitative check, adversarial critique, implementation plan;
- community/benchmark prior for the task type;
- safety and regional-bias coverage;
- enough live context/output capacity for the framed task;
- runtime availability.

Skip a route when it adds only another fluent paraphrase.

# MODEL FAMILIES

## GPT-family route

- **Default local call:** `xwilludelu/gpt-5.5:xhigh` if present in live Pi config.
- **Community/benchmark prior:** often treated as the all-rounder baseline: strong instruction following, tool use, synthesis, coding breadth, and cross-domain arbitration.
- **Personality/use:** steady generalist; good parent/final synthesis candidate after claims are grounded; good at integrating conflicting advisers into a compact decision.
- **Risks:** can sound more certain than the evidence permits; may smooth away dissent. Require citations, tests, source inspection, or cross-model critique for factual/high-stakes claims.

## Claude-family route

- **Default local call:** `xwilludelu/claude-opus:xhigh` if present in live Pi config.
- **Community/benchmark prior:** commonly valued for careful prose, nuanced tradeoff analysis, code review, long-form critique, and high-stakes reasoning.
- **Personality/use:** patient critic and minority-report writer; strong for subtle failure modes, writing-sensitive review, requirements drift, and deep second-pass synthesis.
- **Risks:** can be slower, more verbose, and more cautious than needed. Use when depth or dissent quality justifies the slot.

## Gemini-family route

- **Default local call:** `xwilludelu/gemini-flash:xhigh` if present in live Pi config.
- **Community/benchmark prior:** often strong on long-context reading, multimodal input, broad scanning, and speed; Flash-style routes trade top-end depth for throughput.
- **Personality/use:** fast broad reader; good for source/document passes, screenshots/UI, multimodal review, and non-GPT/non-PRC counterpoint.
- **Risks:** long-context capacity does not guarantee faithful retrieval. For unknown facts or volatile claims, require source quotes, tests, or another model-family check.

## Qwen-family route

- **Default local call:** `xwilludelu/qwen-max:xhigh` if present in live Pi config.
- **Community/benchmark prior:** strong open-weight-style reputation for coding, math, structured output, multilingual technical work, and Chinese-English tasks.
- **Personality/use:** precise technical worker; good for repository-scale text review, code critique, structured plans, and non-Western model-family diversity.
- **Risks:** claims tied to a specific release age quickly. Verify the backing route before citing version-specific benchmark results.

## DeepSeek-family route

- **Default local call:** `xwilludelu/deepseek-pro:xhigh` if present in live Pi config.
- **Community/benchmark prior:** strong reputation for reasoning, math, code exploration, backend logic, and efficient first-pass problem solving.
- **Personality/use:** builder/proposer; good for architecture sketches, repair plans, whole-corpus text passes, and code/math exploration before verifier review.
- **Risks:** treat as proposal generator, not final arbiter. Require tests, source checks, or cross-model critique before adoption.

## Grok-family route

- **Default local call:** `xwilludelu/grok-multi-agent:xhigh` if present in live Pi config.
- **Community/benchmark prior:** often associated with contrarian framing, freshness-oriented tasks, informal critique, and alternate hypotheses.
- **Personality/use:** adversarial checker; good for “what are we missing?”, hallucination-risk sanity checks, and non-GPT/non-PRC diversity.
- **Risks:** freshness claims require active search and citations. Do not treat contrarian tone as evidence.

## Kimi-family route

- **Default local call:** `xwilludelu/kimi:xhigh` if present in live Pi config.
- **Community/benchmark prior:** strong long-context and Chinese-English reputation, with useful code/tool orientation and long-form output.
- **Personality/use:** decomposer and explainer; good for long-document planning, bilingual analysis, implementation planning, and multimodal counterpoint when the route supports images.
- **Risks:** verify factual claims and route-level reasoning controls; provider aliases may expose different parameter names.

## GLM-family route

- **Default local call:** `xwilludelu/glm:xhigh` if present in live Pi config.
- **Community/benchmark prior:** useful Chinese technical and structured-reasoning signal; often helpful for code-focused critique and bilingual document analysis.
- **Personality/use:** fast technical critic; good for alternate design review, Chinese-language analysis, and text-only pressure testing.
- **Risks:** verify claims that depend on a specific GLM release or provider route.

## MiMo-family route

- **Default local call:** `xwilludelu/mimo-pro:xhigh` if present in live Pi config.
- **Community/benchmark prior:** thinner global signal than the families above; use only when local availability and task fit justify another independent non-Western text route.
- **Personality/use:** extra reasoning/checking slot for math, code, or Chinese-English technical work when it adds coverage.
- **Risks:** weaker public reputation base means direct validation matters more.

# ROUTING NOTES

| Task | Default route set |
|---|---|
| Broad judgment | All suitable available families. Do not use vote count as truth. |
| Code | All suitable families plus direct tests. Include GPT, Claude, Gemini, Qwen, DeepSeek, Grok, Kimi, GLM, and MiMo where live config and modality fit. |
| Large text corpus | Prefer live long-context routes; include at least one GPT/Claude/Gemini-family reader and one non-Western family reader when possible. |
| Image/UI | Use image-capable live routes; verify actual image support before launch. |
| PRC-sensitive topic | Require GPT/Gemini/Claude-family or primary-source cross-check; do not rely only on PRC-family routes. |
| Fact/current-events claim | Use search or primary sources; models provide hypotheses, not freshness. |
| Final synthesis | Parent writes. A model-family route may advise, but cannot decide by seniority, confidence, or popularity. |

If all suitable routes cannot run, choose the smallest diverse set that covers the task: one broad generalist, one careful critic, one task specialist, and one independent regional/model-family counterpoint. Add a contrarian route only when it will attack claims rather than produce noise.

# STOP RULE

Continue rounds only for new evidence, material contradiction, useful narrowing, or resolvable decisive risk. Stop when remaining disagreement needs direct testing, a primary source, external expertise, or a decision owner.
