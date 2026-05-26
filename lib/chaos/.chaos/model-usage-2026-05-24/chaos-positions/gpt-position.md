# GPT-position research: Pi flagship alias routing for `MODEL_USAGE.md`

## 1. Diversity axis
GPT-family generalist/synthesis lens: prefer routing guidance that treats `gpt-5.5` as the conservative default for synthesis, ambiguous multi-step work, cross-source judgment, and agentic task completion, while explicitly preserving model-family diversity for review, coding, long-context/multimodal, low-cost open-weight, and adversarial/hallucination-sensitive checks.

## 2. Short answer: what `MODEL_USAGE.md` should emphasize
`MODEL_USAGE.md` should avoid a single “best model” claim. It should present alias-style routing: `gpt-5.5` for generalist synthesis and hard agentic work; `claude` / `claude-opus-4-6-thinking` for prose, nuanced review, and codebase reasoning; `gemini-3.5-flash` for fast long-context agentic/coding loops; `grok` for alternate reasoning and real-time/X-search-adjacent work when tools are available; and `deepseek`, `qwen`, `kimi`, `glm` as strong open/open-adjacent alternatives for cost-sensitive, coding, or independent review passes. Claims should be phrased as “good default”, “likely strong”, or “useful for” because public benchmarks are volatile, alias backing models may change, and local provider behavior is not independently verified.

## 3. Family table

| Family / local alias | Public impression | Strongest likely CHAOS role | Cautions | Source links |
|---|---|---|---|---|
| GPT / `gpt-5.5` | Broad frontier generalist; OpenAI frames GPT-5.5 as built for complex goals, tool use, checking its work, coding, research, data analysis, documents, spreadsheets, and operating software. Artificial Analysis says GPT-5.5 led its Intelligence Index and Terminal-Bench Hard/GDPval-AA/APEX-Agents-AA at release, but also notes hallucination concerns on its Omniscience benchmark. | First-pass synthesis, final arbitration, complex multi-step agentic work, research consolidation, ambiguous planning, cross-source judgment. | Do not imply best at every subtask. AA reported high factual accuracy but also a high hallucination rate in one benchmark; require citations and verification for factual claims. Cost/latency may be higher than open or flash alternatives. | [OpenAI](https://openai.com/index/introducing-gpt-5-5/), [Artificial Analysis GPT-5.5](https://artificialanalysis.ai/articles/openai-gpt5-5-is-the-new-leading-AI-model) |
| Claude / `claude`, `claude-opus-4-6-thinking` | Strong public reputation for writing quality, nuanced judgment, code review, long-running work, and coding agents. Google Cloud’s Claude Opus 4.6 announcement describes complex coding, agentic tasks, financial/legal analysis, 1M context, adaptive thinking, effort controls, and 128k output. LMArena-style public summaries frequently place Claude Opus variants near the top for human preference. | High-stakes critique, prose/document polishing, codebase reasoning, review passes, “does this read right?” judgment, long-form planning; Opus section can be reserved for expensive/deep thinking. | `claude` and `claude-opus-4-6-thinking` should be separate docs entries if both aliases exist. Avoid saying Claude is always best at coding or reasoning; benchmark leaders vary by benchmark and date. | [Google Cloud Vertex AI Claude Opus 4.6](https://cloud.google.com/blog/products/ai-machine-learning/expanding-vertex-ai-with-claude-opus-4-6), [Claude context engineering cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools), [LMArena May summary](https://tovren.com/best-llms-right-now-may-2026/) |
| Gemini / `gemini-3.5-flash` | Gemini family has strong multimodal, long-context, tool, and price/performance reputation. Google positions Gemini 3 as its most intelligent model with improved reasoning, multimodality, coding, and tool use; Gemini 3.5 Flash public developer material describes 1M context, thinking, agentic execution, coding, long-horizon tasks, and GA production use. | Fast long-context triage, broad document/code scanning, multimodal-aware work, inexpensive second opinion, high-throughput agentic loops. | Local alias is Flash, not Pro; document should emphasize speed/throughput and long-context utility rather than assuming top frontier reasoning. “Computer Use” is reportedly not supported in the Gemini 3.5 Flash guide. | [Google Gemini 3](https://blog.google/products-and-platforms/products/gemini/gemini-3/), [Gemini 3.5 Flash guide](https://dev.to/googleai/gemini-35-flash-developer-guide-1i46) |
| Grok / `grok` | xAI docs describe Grok 4.3 as its most intelligent and fastest general model for chat and coding, with 1M context and selectable reasoning effort. Public impressions often place Grok as a strong alternative frontier model, sometimes associated with long context, real-time/X-search workflows, and contrarian reasoning. | Independent adversarial pass, alternate hypothesis generation, freshness-oriented work when web/X search tools are enabled, coding/general reasoning backup. | xAI docs state no real-time event access without search tools and note knowledge cutoff limitations for older Grok generations; do not imply live knowledge unless tools are active. Public benchmark claims vary sharply across Grok versions. | [xAI Models](https://docs.x.ai/developers/models), [xAI Reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning) |
| GLM / `glm` | Z.ai/GLM public materials emphasize agentic coding, terminal tasks, tool use, reasoning, interleaved/preserved thinking, and open-weight availability. GLM-4.7 material reports gains over GLM-4.6 on SWE-bench, SWE-bench Multilingual, Terminal Bench 2.0, tool use, and HLE. | Cost-conscious coding agent, terminal/code repair review, open-weight independent check, structured reasoning alternate. | Public docs use specific GLM versions, while local alias is versionless. Avoid importing exact benchmark numbers into alias guidance unless local backing model is known. Treat as “strong open/open-adjacent coding-reasoning candidate,” not a guaranteed frontier peer. | [Z.ai GLM repository](https://github.com/zai-org/GLM-4.5/) |
| Kimi / `kimi` | Moonshot’s Kimi K2 materials frame Kimi as a 1T-parameter MoE family optimized for agentic capabilities, tool use, reasoning, autonomous problem solving, and coding; later public discussion emphasizes long-horizon coding and agent swarms. Artificial Analysis’ open-weight roundup places Kimi K2.6 among the leading open-weight models near proprietary frontier scores. | Long-horizon coding/planning alternate, agentic decomposition, cheap/independent review, open-weight style second opinion. | Kimi public claims span K2/K2.5/K2.6; local alias version is unknown. Do not claim multimodal/swarm/256k+ behavior unless the configured alias is verified. | [MoonshotAI Kimi-K2](https://github.com/MoonshotAI/Kimi-K2), [Artificial Analysis open weights](https://artificialanalysis.ai/articles/recent-open-weights-model-launches) |
| DeepSeek / `deepseek` | Strong open-weight/value reputation, especially reasoning/coding per dollar. DeepSeek V3.1 materials describe hybrid thinking/non-thinking modes, 128k context, improved tool calling and agent tasks, and better thinking efficiency than earlier R1-style reasoning. Artificial Analysis’ open-weight roundup places DeepSeek V4 Pro near top open-weight intelligence but flags weaker hallucination/omniscience versus proprietary leaders. | Budget reasoning/coding pass, batch critique, independent reproduction, low-cost adversarial check, fallback for routine synthesis. | Be explicit that hallucination/factuality may need stronger verification. Some DeepSeek variants have tool/function-calling limitations in reasoning mode depending on host/version; local alias backing model is unknown. | [DeepSeek V3.1 readme mirror](https://replicate.com/deepseek-ai/deepseek-v3.1/readme), [Artificial Analysis open weights](https://artificialanalysis.ai/articles/recent-open-weights-model-launches) |
| Qwen / `qwen` | Alibaba/Qwen has strong open-model and coding reputation. Qwen3-Coder announcement describes a 480B/35B active MoE, agentic coding/browser/tool-use strengths, 256k native context extendable to 1M, repository-scale understanding, and support for many coding languages. Public leaderboards often treat Qwen as a high-value open/open-adjacent coding option. | Code generation/review alternate, repository-scale scan, local/open-weight style second opinion, cost-sensitive agentic coding. | Qwen has many model sizes and modes; versionless alias must not inherit Qwen3-Coder Max/large-model claims without verification. Use conservative wording around “often strong for code/open-model workflows.” | [Qwen3-Coder](https://openlm.ai/qwen3-coder/), [Artificial Analysis open weights](https://artificialanalysis.ai/articles/recent-open-weights-model-launches) |

## 4. Claims ledger

| Claim | Evidence/source | Confidence basis | Uncertainty |
|---|---|---|---|
| GPT-5.5 is the safest conservative default for generalist synthesis and complex agentic tasks. | OpenAI states GPT-5.5 is built to understand complex goals, use tools, check work, code, research, analyze data, create docs/spreadsheets, and operate software; Artificial Analysis says it led its Intelligence Index and several agentic/economic-work evaluations at release. [OpenAI](https://openai.com/index/introducing-gpt-5-5/), [AA](https://artificialanalysis.ai/articles/openai-gpt5-5-is-the-new-leading-AI-model) | Primary vendor claims plus independent benchmark summary align on broad generalist/agentic strength. | Vendor claims are promotional; AA also reports hallucination concerns. Local hosted alias may differ from official model behavior. |
| GPT-5.5 should not be documented as globally best or safest for factuality. | AA reports GPT-5.5 had highest Omniscience accuracy but a much higher hallucination rate than Claude Opus 4.7 and Gemini 3.1 Pro Preview in that benchmark. [AA](https://artificialanalysis.ai/articles/openai-gpt5-5-is-the-new-leading-AI-model) | Directly relevant caution from independent evaluator. | Single benchmark; hallucination behavior depends on prompt, tools, and model effort. |
| Claude deserves separate versionless and Opus-thinking entries. | Parent supplied both `claude` and `claude-opus-4-6-thinking`; Google Cloud describes Opus 4.6 feature availability and high-end enterprise/coding/agentic use cases. [Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/expanding-vertex-ai-with-claude-opus-4-6) | Config fact plus official cloud partner description. | `claude` backing model is unknown; route should remain generic. |
| Gemini Flash should be positioned for fast long-context agentic/coding throughput, not simply “best model.” | Gemini 3.5 Flash guide describes GA production use, 1M context, thinking, agentic execution, coding, long-horizon tasks, and Flash positioning; Google Gemini 3 announcement emphasizes reasoning, multimodality, coding, and tool use at family level. [Gemini 3.5 Flash](https://dev.to/googleai/gemini-35-flash-developer-guide-1i46), [Google](https://blog.google/products-and-platforms/products/gemini/gemini-3/) | Source is model-family/vendor documentation and local alias is explicitly Flash. | The Gemini 3.5 Flash guide was surfaced via DEV; exact official-doc parity should be checked if parent wants only first-party URLs. |
| Grok is useful as an alternate reasoning/adversarial/freshness route only when search tools are configured for current information. | xAI docs say Grok 4.3 is the recommended model for chat/coding and supports reasoning effort; docs also state no real-time events without search tools. [xAI Models](https://docs.x.ai/developers/models), [xAI Reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning) | First-party docs directly support role and caution. | Local `grok` alias version unknown. |
| DeepSeek/Kimi/Qwen/GLM should be described as strong open/open-adjacent value and independent-review candidates, not guaranteed frontier replacements. | Artificial Analysis says top open weights including Kimi and DeepSeek are close to proprietary leaders on its Index but still show gaps on hardest reasoning/agentic coding and hallucination/omniscience; Qwen and GLM official materials emphasize coding/agentic strengths. [AA open weights](https://artificialanalysis.ai/articles/recent-open-weights-model-launches), [Qwen](https://openlm.ai/qwen3-coder/), [GLM](https://github.com/zai-org/GLM-4.5/), [Kimi](https://github.com/MoonshotAI/Kimi-K2) | Cross-source consistency: strong capability, especially coding/value, but measurable gaps and version ambiguity. | Local aliases may point to closed, hosted, distilled, or older variants; exact cost/performance unknown. |
| Alias docs should avoid concrete versions except GPT-5.5, GEMINI-3.5-FLASH, and CLAUDE-OPUS-4.6. | Parent explicitly supplied documentation constraint. | Direct task requirement. | None, except source citations necessarily mention concrete upstream models. |

## 5. Concrete wording suggestions for `MODEL_USAGE.md`

Use alias-style entries and keep claims deliberately conservative:

```md
### GPT-5.5 (`gpt-5.5`)
Use as the default high-capability generalist for synthesis, complex planning, multi-source research consolidation, ambiguous agentic tasks, and final arbitration. Strong first choice when the task needs broad reasoning across context plus tool-use discipline. Still require source checks for factual claims; public evaluations report strong capability but not perfect hallucination resistance.
```

```md
### Claude (`claude`)
Use for nuanced critique, prose quality, review, codebase reasoning, and judgment-heavy tasks where readability and careful instruction following matter. Treat this as the general Claude-family route; prefer the explicit Opus thinking alias when the task is expensive, high-stakes, or requires deeper sustained reasoning.
```

```md
### Claude Opus thinking (`claude-opus-4-6-thinking`)
Use for difficult review, long-form reasoning, complex coding/debugging, legal/financial-style analysis, and high-stakes synthesis where extra thinking cost is justified. Good as a second-pass reviewer after GPT-family synthesis or as the primary route for prose-sensitive critique.
```

```md
### Gemini Flash (`gemini-3.5-flash`)
Use for fast long-context triage, high-throughput agentic/coding loops, broad document/code scanning, and multimodal-adjacent workflows. Prefer it when speed, context, or cost/throughput matters more than maximum deliberative depth.
```

```md
### Grok (`grok`)
Use as an independent alternate-reasoning route, adversarial sanity check, or freshness-oriented route when web/X-search tools are enabled. Do not rely on it for current events unless search tools are active and citations are checked.
```

```md
### DeepSeek (`deepseek`)
Use for cost-sensitive reasoning, coding, batch critique, and independent reproduction passes. Good for routine or parallel review work where citations/tests can verify the result. Avoid treating it as the sole authority for high-stakes factual synthesis.
```

```md
### Qwen (`qwen`)
Use for coding-oriented review/generation, repository-scale scanning, and open-model-style independent checks. Good candidate for cost-sensitive code and structured technical tasks; verify the actual hosted alias before assuming specific context length or benchmark behavior.
```

```md
### Kimi (`kimi`)
Use for long-horizon coding/planning alternatives, agentic decomposition, and independent review where an open/open-adjacent model family is useful. Keep claims generic unless the backing Kimi version is verified.
```

```md
### GLM (`glm`)
Use for agentic coding, terminal/code repair review, structured reasoning, and independent open-weight-style checks. Treat as a strong alternate technical reviewer, not as a guaranteed replacement for the default frontier route.
```

Suggested policy note:

```md
Routing guidance is heuristic. Aliases may be remapped by provider configuration, public leaderboards move quickly, and benchmark wins rarely transfer perfectly to local workflows. For high-stakes work, use at least two model families and verify outputs with tests, citations, or direct source inspection.
```

## 6. Live objections / minority risks and what parent should avoid overstating

1. **Alias opacity risk** — The supplied aliases are versionless except `gpt-5.5`, `gemini-3.5-flash`, and `claude-opus-4-6-thinking`. Parent should not copy benchmark numbers from specific Qwen/Kimi/DeepSeek/GLM releases into `MODEL_USAGE.md` unless the provider alias backing model is verified.
2. **Leaderboard volatility risk** — Current public impressions split by benchmark: GPT often leads composite/agentic measures, Claude often leads human-preference/writing/review impressions, Gemini often leads long-context/multimodal/value narratives, and open-weight models dominate price-performance. Parent should avoid “X is best overall” language.
3. **Hallucination-risk objection** — GPT-5.5’s strong public showing does not mean maximum factual caution; Artificial Analysis specifically reports high hallucination rate on one Omniscience benchmark. Parent should say GPT is a synthesis default, not a fact oracle.
4. **Flash-vs-Pro mismatch** — `gemini-3.5-flash` should not inherit all Gemini Pro leaderboard claims. Parent should emphasize throughput, long context, and production agentic/coding loops, not top-end reasoning supremacy.
5. **Grok freshness misconception** — xAI docs explicitly require search tools for current/realtime information. Parent should not describe `grok` as inherently live or current without tool qualification.
6. **Open-weight generalization risk** — DeepSeek, Qwen, Kimi, and GLM each have strong public coding/agentic narratives, but many public claims are release-specific and model-size-specific. Parent should use them as alternate/check/value routes, not as unqualified frontier equivalents.
7. **Documentation tone risk** — `MODEL_USAGE.md` should be operational, not promotional. Prefer “use for”, “good default”, “likely strong”, “verify” over “dominates”, “best”, “SOTA”, or exact benchmark bragging.
