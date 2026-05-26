# CHAOS frame: MODEL_USAGE.md update

## Question
How should `/home/wangzixiong/.agent-share/lib/chaos/MODEL_USAGE.md` be updated so CHAOS flagship routing matches the user's available Pi models and current public impressions of flagship LLM families: GPT, Claude, Gemini, Grok, GLM, Kimi, DeepSeek, and Qwen?

## Scope
- Inspect local Pi model configuration and existing MODEL_USAGE.md.
- Gather broad current public impressions of flagship model families listed above.
- Update only `/home/wangzixiong/.agent-share/lib/chaos/MODEL_USAGE.md` unless a ledger/receipt artifact is needed.
- Add/refresh Grok, Qwen, Claude alias, and Claude Opus entries.
- Use alias-style exposed IDs where local config provides aliases.

## Non-goals
- Do not change Pi model configuration or credentials.
- Do not expose secrets.
- Do not benchmark models locally.
- Do not turn public impressions into unsupported hard rankings.

## Evidence standard
- Local availability and call metadata require direct evidence from `~/.pi/agent/models.json` or `~/.pi/agent/my-pi.md`.
- Model-family trait claims should be conservative, source-backed, and framed as routing heuristics rather than objective universal rankings.
- Final documentation must avoid stale unsupported version exposure except where the user explicitly approved version names: `GPT-5.5`, `GEMINI-3.5-FLASH`, `CLAUDE-OPUS-4.6`; Claude may also have a versionless alias section.

## Mode
Council/deep-lite document update: four independent same-frame web-research positions from GPT, Claude, Gemini, and Grok model routes, followed by parent synthesis and a targeted document edit.

## Allowed tools/models
- Subagent `researcher` with models: `xwilludelu/gpt-5.5`, `xwilludelu/claude`, `xwilludelu/gemini-3.5-flash`, `xwilludelu/grok`.
- Parent direct file inspection and editing tools.

## Stop rule
Stop when public-impression claims are sufficiently consistent for conservative routing heuristics, local config is directly verified, the file is updated, and a final verification pass finds no mismatch with the user's alias/version policy.

## Decision owner
Parent agent writes and judges final document.

## Planned perspectives
- GPT-route researcher: generalist and synthesis-angle research.
- Claude-route researcher: coding/reasoning/writing-safety angle research.
- Gemini-route researcher: multimodal/long-context/Google ecosystem angle research.
- Grok-route researcher: recency/alternative ecosystem/contrarian route research.

## Failed perspectives
None yet.
