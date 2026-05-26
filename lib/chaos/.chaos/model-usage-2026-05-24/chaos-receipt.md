# CHAOS receipt: MODEL_USAGE.md update

## Final decision
Updated `/home/wangzixiong/.agent-share/lib/chaos/MODEL_USAGE.md` to match live Pi model aliases after removing the broken versionless Claude route. The document now includes: `gpt-5.5`, `qwen`, `deepseek`, `grok`, `kimi`, `glm`, `gemini-3.5-flash`, and `claude-opus-4-6-thinking`.

## Evidence standard
- Local availability: direct `models.json` inspection and jq output.
- Routing traits: conservative synthesis from GPT, Gemini, and Grok same-frame research outputs plus parent web search; no unsupported hard rankings.
- Alias/version policy: direct user instruction.

## Accepted claims
- `xwilludelu/claude` is removed from Pi config and from MODEL_USAGE routing.
- Alias-style documentation is used for Qwen, DeepSeek, Grok, Kimi, and GLM.
- Approved explicit version entries remain: GPT-5.5, GEMINI-3.5-FLASH, CLAUDE-OPUS-4.6.
- Grok and Qwen are now documented.
- Claude-family coverage is retained only through `xwilludelu/claude-opus-4-6-thinking`.

## Changed/narrowed claims
- Claude: narrowed from a duplicate versionless Claude + Opus plan to Opus-only because the user removed `claude`.
- Gemini: narrowed to Flash-specific long-context/multimodal/throughput routing, not Pro-line top-end reasoning.
- Grok: narrowed to alternate/contrarian/freshness-oriented route only when external search tools and citations are active.
- PRC-family models: narrowed from concrete public version claims to local alias heuristics.

## Rejected or withdrawn claims
- Rejected documenting `xwilludelu/claude`; it is no longer configured.
- Rejected using exact model-version headings for Kimi, GLM, DeepSeek, Grok, or Qwen.

## Live dissent / minority report
- Public model impressions are volatile and source quality varies. The document must remain heuristic.
- Local aliases may be remapped by the upstream provider without changing the alias string.
- Claude Opus endpoint availability was not successfully validated during this run because prior attempts reported cooldown.

## Failed or degraded perspectives
- Claude versionless researcher perspective failed twice due malformed tool-call behavior, then 403/Cloudflare instability. User subsequently removed the versionless Claude route. The run proceeded with GPT/Gemini/Grok research plus parent web search and direct config evidence.

## Validation still needed
- Restart/reload Pi if the running process caches `models.json`.
- If `claude-opus-4-6-thinking` availability matters for a future CHAOS run, retest after cooldown.
- Periodically refresh public-impression heuristics because flagship model rankings shift quickly.

## Why the synthesis follows
The final file follows the direct local configuration after deletion of `claude`, preserves the user's allowed explicit version names, adds the requested Grok and Qwen routing, and converts public model-family impressions into conservative operational guidance rather than benchmark claims.
