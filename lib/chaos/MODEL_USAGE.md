# GENERAL INFO

CHAOS is claim-led multi-agent deliberation: the parent stays judge/final writer; independent flagship advisers expose claims, evidence routes, objections, and dissent; evidence beats consensus.

- Use every suitable flagship below in parallel unless modality does not fit, direct verification is stronger, or the user narrows the run.
- Call shape is usually `model-id:xhigh`; `xhigh` maps to each endpoint’s reasoning tier shown below.
- Cost is not a routing constraint; capability, modality, independence, evidence route, and safety constraints matter.
- Project-local `MODEL_USAGE.md` overrides this file; live Pi config overrides stale IDs/limits.
- This file records flagship routing only, not every possible endpoint.

# MODELS

## `xwilludelu/gpt-5.5`

- **Call:** `xwilludelu/gpt-5.5:xhigh`; text+image; 272k context; 128k max output; reasoning yes; tier `xhigh`.
- **Traits:** default generalist; broad synthesis, agentic planning, tool use, coding, multimodal review, and cross-source adjudication.
- **Use:** parent/final synthesis; high-stakes arbitration after claims are grounded; complex multi-step work where broad competence matters most.
- **Constraint:** not a fact oracle; require citations, tests, source inspection, or cross-model critique for factual/high-stakes claims.

## `xwilludelu/gemini-3.5-flash`

- **Call:** `xwilludelu/gemini-3.5-flash:xhigh`; text+image; 1,048,576 context; 65,535 max output; reasoning yes; tier `high`.
- **Traits:** fast Gemini-family multimodal adviser; long-context source/screenshot/UI reading, coding and agentic planning, grounding-aware reasoning, and broad non-GPT/non-PRC counterpoint.
- **Use:** same-frame independent adviser; multimodal/source inspection; long-context second reading; fast broad scans; coding/agentic workflow critique; safety/risk checks.
- **Constraint:** Flash endpoint, not Pro-line top-end; require source/test/cross-model checks for unknown facts or volatile claims.

## `xwilludelu/claude-opus-4-6-thinking`

- **Call:** `xwilludelu/claude-opus-4-6-thinking`; text+image; 200k context; 64k max output; reasoning yes; thinking built into endpoint.
- **Traits:** CLAUDE-OPUS-4.6 route; nuanced judgment, prose quality, careful review, complex coding/debugging, and high-stakes reasoning.
- **Use:** difficult critique, minority-report generation, writing-sensitive review, complex codebase reasoning, deep second-pass synthesis, and high-stakes Claude-family perspective.
- **Constraint:** use when the added depth and model-family diversity justify the slower/heavier route.

## `xwilludelu/qwen`

- **Call:** `xwilludelu/qwen:xhigh`; text only; 1M context; 65,536 max output; reasoning yes; tier `max`.
- **Traits:** Qwen-family alias; coding, tool-oriented workflows, multilingual technical work, structured output, and long-context text review.
- **Use:** coding review/generation, repository-scale text scans, structured technical tasks, and independent non-Western counterpoint.
- **Constraint:** avoid specific-release benchmark claims unless the backing model is verified.

## `xwilludelu/deepseek`

- **Call:** `xwilludelu/deepseek:xhigh`; text only; 1M context; 128k max output; reasoning yes; tier `max`.
- **Traits:** DeepSeek-family alias; cost-efficient reasoning, math/code exploration, backend logic, and long-context text work.
- **Use:** large-context proposer, architect, repair planner, batch critique, whole-corpus text pass, and code/math exploration before verifier review.
- **Constraint:** prefer builder/proposer role; require tests, source checks, or cross-model critique before final adoption.

## `xwilludelu/grok`

- **Call:** `xwilludelu/grok:xhigh`; text only; 1M context; 65,536 max output; reasoning yes; tier `xhigh`.
- **Traits:** Grok-family alias; alternate/contrarian framing, long-context reasoning, adversarial checking, and freshness-oriented work when search tools are active.
- **Use:** adversarial pass, alternate hypothesis generation, hallucination-risk sanity check, and non-GPT/non-PRC diversity.
- **Constraint:** do not treat outputs as current without active search tools and citations; verify factual claims.

## `xwilludelu/kimi`

- **Call:** `xwilludelu/kimi:xhigh`; text+image; 262k context; 98,304 max output; reasoning yes; tier `max`.
- **Traits:** Kimi-family alias; long-form output, code/tool orientation, Chinese-English analysis, agentic decomposition, and multimodal input.
- **Use:** independent proposer, implementation planner, code reviewer, long-form explainer, bilingual analyst, and multimodal non-Western counterpoint.
- **Constraint:** not sole fact arbiter; require citations/tests for factual claims.

## `xwilludelu/glm`

- **Call:** `xwilludelu/glm:xhigh`; text only; 200k context; 131,072 max output; reasoning yes; tier `max`.
- **Traits:** GLM-family alias; technical/code critique, bilingual text analysis, structured reasoning, and open-weight-style independent review.
- **Use:** fast technical critic, code-focused critique, alternative design review, Chinese-language document analysis, and text-only pressure testing.
- **Constraint:** verify claims that depend on a specific GLM release.

# ROUTING NOTES

- **Broad judgment:** use all suitable flagships.
- **Code:** use all suitable flagships plus tests; include GPT, Claude Opus, Gemini, Qwen, DeepSeek, Grok, Kimi, and GLM where modality fits.
- **Large text corpus:** include long-context text routes such as Qwen, DeepSeek, Grok, and Gemini Flash.
- **Image/UI:** use image-capable routes: GPT-5.5, Kimi, Gemini Flash, and Claude Opus.
- **PRC-sensitive topics:** require GPT/Gemini/Claude-family or primary-source cross-check, not only PRC-family models.
- **Stop:** continue rounds only for new evidence, material contradiction, useful narrowing, or resolvable decisive risk.
