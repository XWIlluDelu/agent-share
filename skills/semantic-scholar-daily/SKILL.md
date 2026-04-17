---
name: semantic-scholar-daily
description: 'Search and rank recent papers via the Semantic Scholar API, generate daily paper recommendations against a saved research-interest config, and optionally write an Obsidian daily-recommendation note with existing-note links. Use when the user wants the latest papers in their field, a daily digest, topic-specific recent search, or author/venue lookups. Triggers: daily paper digest, paper recommendation, recent papers, latest in my field, Semantic Scholar, 每日论文推荐, 最新论文, 按我的方向找新论文, 文献推荐, 今天看什么论文. For local-vault note search use paper-search; for deep analysis of one paper use paper-analyze.'
allowed-tools: Read, Write, Bash, Glob, Grep
---

You are the Semantic Scholar paper scout for this vault.

# Goal

Use the user's configured research interests plus the Semantic Scholar API to:

1. search recent papers for a specific query
2. build a daily recommendation list that balances fresh papers and high-signal older papers
3. write a vault-ready Obsidian daily recommendation note with existing-note links

This skill assumes `SEMANTIC_SCHOLAR_API_KEY` is already available.

# Default paths

- research config: `$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml`
- paper notes directory: `$OBSIDIAN_VAULT_PATH/20_Research/Papers`
- daily note path: `$OBSIDIAN_VAULT_PATH/10_Daily/YYYY-MM-DD论文推荐.md`

If `OBSIDIAN_VAULT_PATH` is missing, pass `--vault` explicitly.

# Modes

## Mode 1: direct search

Use this when the user gives a concrete topic, method, author, lab, or venue.

```bash
python3 scripts/semantic_scholar_daily.py search \
  --query "{user query}" \
  --days 180 \
  --limit 10 \
  --output-json semantic_scholar_search.json
```

Optional filters:

- `--author`
- `--venue`
- `--config` with `--domain`

After running, read the JSON and present a concise ranked list with title, date, venue, citations, and one-line relevance.

## Mode 2: recommendation ranking

Use this when the user asks for latest papers in their field, a daily digest, or paper recommendations.

```bash
python3 scripts/semantic_scholar_daily.py recommend \
  --config "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml" \
  --vault "$OBSIDIAN_VAULT_PATH" \
  --days 45 \
  --hot-days 365 \
  --recent-cutoff-days 30 \
  --per-domain 20 \
  --top-n 10 \
  --max-per-domain 3 \
  --output-json semantic_scholar_daily.json
```

What this does:

- builds a recent candidate pool from the last `--days`
- builds a hot backfill pool from the older `--hot-days` range, excluding the newest `--recent-cutoff-days`
- merges and reranks both pools
- applies a per-domain cap so one topic does not dominate the final top 10
- reuses existing paper notes when possible

If the user gives a target date, add `--target-date YYYY-MM-DD`.

## Mode 3: write the Obsidian note

Use this after `recommend` whenever the user asks to save or refresh the daily paper note.

```bash
python3 scripts/semantic_scholar_daily.py write-note \
  --input-json semantic_scholar_daily.json \
  --output-md "$OBSIDIAN_VAULT_PATH/10_Daily/YYYY-MM-DD论文推荐.md" \
  --vault "$OBSIDIAN_VAULT_PATH" \
  --link-keywords
```

What this does:

- writes the final markdown note in the required Obsidian layout
- adds `keywords` and `tags` frontmatter
- links existing paper notes in the body
- optionally auto-links note keywords from `20_Research/Papers/` into the generated markdown

# Workflow

1. Read the research-interest config.
2. Run `search` for direct topic lookup, or `recommend` for a daily digest.
3. For daily recommendations, keep exactly 10 papers unless the API returns fewer valid candidates.
4. Prefer the script's reranked output; it already mixes recent and hot candidate pools.
5. Check existing notes before expanding any paper entry.
6. If the user wants a saved note, run `write-note`.
7. For the top 3 papers, do follow-up manually in the agent when the user clearly wants deeper work:
   - search for an existing note by paper id, exact title, and distinctive title keywords
   - if a note exists, reuse that wikilink
   - if no note exists, use `extract-paper-images` and `paper-analyze`
8. In chat, summarize the trends and point to the saved note instead of dumping the markdown.

# Ranking expectations

The recommendation script combines:

- `relevance_score`: match to research interests
- `recency_score`: stronger boost for recent papers
- `popularity_score`: citation and early-attention signals
- `quality_score`: abstract-based technical contribution estimate
- diversity control: `--max-per-domain` limits single-domain domination

Interpret the final list as a curated reading queue, not a raw search dump.

# Note structure

The markdown note should contain:

```markdown
---
keywords: [keyword1, keyword2, ...]
tags: ["llm-generated", "daily-paper-recommend"]
---

## 今日概览

### [[论文名字]]
- **作者**：...
- **机构**：...
- **链接**：...
- **来源**：...
- **笔记**：[[已有笔记路径]] 或 <<无>>

**一句话总结**：...

**核心贡献/观点**：
- ...

**关键结果**：...
```

# Error handling

Expected failure modes and how to respond:

- **`SEMANTIC_SCHOLAR_API_KEY` missing** → Fail fast with a clear message. Do not silently fall back to unauthenticated requests (rate limit is too tight to be useful).
- **HTTP 429 rate limit** → The script already backs off. If it still fails after retries, wait a minute and re-run the same command. Do not loop aggressively.
- **HTTP 5xx / timeout** → Retry once; if still failing, report the API is down and stop. Do not substitute with hand-rolled search.
- **`research_interests.yaml` missing** → Tell the user the expected path, offer to run direct `search` mode with their ad-hoc query as a fallback.
- **Empty candidate pool** (no papers returned) → Report the query + filter combo returned nothing. Common causes: `--days` too tight, `--venue` too narrow, `--author` misspelled. Suggest widening before re-running.
- **Duplicate daily note exists** → Do not overwrite unless user explicitly asks to refresh. Offer to write to a dated variant instead.

# Important rules

- Always use `scripts/semantic_scholar_daily.py`; do not hand-roll ad hoc Semantic Scholar logic.
- Fail clearly if `SEMANTIC_SCHOLAR_API_KEY` is missing.
- Prefer the vault config at `99_System/Config/research_interests.yaml`.
- Reuse existing paper notes whenever possible.
- Do not overwrite an existing daily note unless the user asked to refresh it.
- When writing markdown for the vault, prefer `write-note --link-keywords` so the result feels native to Obsidian.

# Examples

## Latest papers for a topic

```bash
python3 scripts/semantic_scholar_daily.py search \
  --query "low-rank RNN neural dynamics" \
  --days 90 \
  --limit 12 \
  --output-json semantic_scholar_search.json
```

## Daily digest plus note writing

```bash
python3 scripts/semantic_scholar_daily.py recommend \
  --config "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml" \
  --vault "$OBSIDIAN_VAULT_PATH" \
  --days 45 \
  --hot-days 365 \
  --recent-cutoff-days 30 \
  --per-domain 20 \
  --top-n 10 \
  --max-per-domain 3 \
  --target-date 2026-03-21 \
  --output-json semantic_scholar_daily.json

python3 scripts/semantic_scholar_daily.py write-note \
  --input-json semantic_scholar_daily.json \
  --output-md "$OBSIDIAN_VAULT_PATH/10_Daily/2026-03-21论文推荐.md" \
  --vault "$OBSIDIAN_VAULT_PATH" \
  --link-keywords
```
