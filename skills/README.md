# Shared Skill Library

> Canonical path: `~/.agent-share/skills/`
> Maintained: 2026-04-15
> Authoritative machine-readable registry: [`skill-manager/sources.yaml`](skill-manager/sources.yaml)

---

## 1. 目标与结构

这是共享给多个 coding agent 的 canonical skill 库。当前目标不是“为每个 agent 各维护一套技能”，而是：

- 尽量维护一套跨 agent 共享的 skill 本体
- 对必须保留的平台差异，只做薄适配
- 让顶层 skill 名称与原 `~/.claude/skills/` 保持一一对应

当前正式纳入项目管理的顶层 skill 数量为 **46 个**（本轮显式不计 `patchouli`）。

共享库围绕以下主要工作流组织：

```text
文献检索与综合
  openalex-database / pubmed-database / semantic-scholar-daily
  → citation-management → literature-review

论文阅读与笔记
  extract-paper-images / paper-analyze / paper-search
  → paper-annotated-html / paper-derivation-html / paper-derivation-markdown

概念学习与知识库
  ml-concept-study → obsidian-markdown / obsidian-cli / obsidian-bases

研究设计与批判
  hypothesis-generation → scientific-critical-thinking → statistical-analysis
  → author-homepage

方案细化与实验规划
  scientific-brainstorming → research-refine → research-refine-pipeline

科研写作
  research-paper-writing / scientific-writing / scientific-schematics

工具与格式转换
  pdf / markitdown / pptx-generator / defuddle / youtube-transcript / planning-with-files
```

---

## 2. Skill 清单、来源与本地修改

### 2.1 官方来源（Anthropic）

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `anthropic-skill-creator` | 创建 skill 的元工具 | 重命名；description 区分 OpenAI 版本；脚本改成 `claude` / `codex` / `gemini` 三 runtime 通用 |
| `pdf` | 通用 PDF 处理 | 无 |
| `mcp-builder` | 构建 MCP server 的完整指导（FastMCP / Node SDK） | 去掉 Claude-only 工具命名；补 `agents/openai.yaml`；评测 harness 改成多 runtime / 本地 smoke test 友好 |
| `frontend-design` | 高质量 web UI 设计 workflow | 无 |
| `web-artifacts-builder` | React artifact 构建流程 | 无 |
| `doc-coauthoring` | 三阶段协作文档写作 | 改成 agent-agnostic 表述；不再绑定 Claude.ai / Claude Code 术语 |
| `webapp-testing` | Playwright 驱动的 web UI 测试 | 无 |

### 2.2 官方来源（OpenAI）

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `openai-skill-creator` | 创建 OpenAI / Codex 风格 skill 的元工具 | 重命名（原名 `skill-creator`）；description 与 Anthropic 版本区分 |

### 2.3 社区来源：K-Dense / claude-scientific-skills

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `citation-management` | DOI / PMID / BibTeX 元数据规范化 | `python` → `python3` |
| `hypothesis-generation` | 把观察/问题转成可检验假设 | 去掉 Claude-specific tool naming；补 `agents/openai.yaml` |
| `scientific-brainstorming` | 研究发散、跨领域启发 | description 加入双语 trigger，并把英文范围收紧到 early-stage ideation |
| `scientific-critical-thinking` | 结构化批判与漏洞检查 | description 改成 bilingual trigger + Use-when；`SKILL.md` 精简并把细节下沉到 references |
| `scientific-writing` | 科研稿件写作 | `SKILL.md` 精简，移除图像/visual boilerplate，并抽出 field terminology reference |
| `markitdown` | 多格式文档 → Markdown | 省略 K-Dense bundled schematic 脚本；`SKILL.md` 精简并把使用示例移到 references |
| `literature-review` | 正式综述 workflow（PRISMA / screening / synthesis） | 去掉 Claude-specific tool naming；保留脚本与模板；补 `agents/openai.yaml` |
| `scientific-schematics` | AI 生成科学示意图 | `.env` 向上查找更稳健；API key 改走环境变量，避免出现在进程列表 |

### 2.4 社区来源：scicraft

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `openalex-database` | 跨领域学术检索、引用网络探索 | `SKILL.md` 改成 summary table，并把 API queries/workflows/recipes 移到 references |
| `pubmed-database` | 生物医学文献检索 | `SKILL.md` 精简为核心检索结构，并把 API 示例与 workflow 移到 references |
| `statistical-analysis` | 统计设计、检验选择、效应量建议 | 无 |
| `sympy-symbolic-math` | 符号数学、ODE 推导 | `SKILL.md` 精简，保留 solver/simplification guide，并把 API 与 workflows 移到 references |

### 2.5 社区来源：kepano / obsidian-skills

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `obsidian-markdown` | 生成和维护 Obsidian 兼容 Markdown | 无 |
| `obsidian-cli` | 直接操作 Obsidian vault | 无 |
| `obsidian-bases` | 构建 Obsidian `.base` 数据视图 | `SKILL.md` 精简并抽出完整 YAML 示例；补充 single-string filters 与 `number()` 用法 |
| `defuddle` | 提取网页清洁正文 | 改成 agent-agnostic 获取网页正文表述 |
| `json-canvas` | 创建和编辑 `.canvas` 文件 | 无 |

### 2.6 社区来源：juliye2025 / evil-read-arxiv

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `extract-paper-images` | 从论文 PDF / arXiv 源码包提取图片 | description 改成 bilingual trigger + Use-when |
| `paper-analyze` | 深度分析单篇论文，图文笔记 | 改成 agent-agnostic；补 helper 脚本；`SKILL.md` 重写为更精简的 decision-tree workflow，并增强 critique/rubric |
| `paper-search` | 在本地 vault 笔记中搜索论文 | description 改成 bilingual trigger + Use-when |

### 2.7 社区来源：其他公开 repo

| Skill | 来源 | 说明 | 共享库本地修改 |
|---|---|---|---|
| `research-paper-writing` | ceasonen / research-skills | 完整论文写作 workflow | description 中 `ML/CV/NLP` → `Neuroscience/ML`；默认改成 manuscript-ready prose，隐藏 outline / role labels / checklist / claim map；claim calibration 更保守 |
| `youtube-transcript` | michalparkola / tapestry-skills | 下载 YouTube 字幕 | `SKILL.md` 精简，并把详细命令与完整 workflow 移到 references |
| `planning-with-files` | OthmanAdi / planning-with-files | 文件驱动任务规划 | 去掉 Claude-only hooks 假设；补模板 / scripts / refs；补 Codex hook adapter；Gemini 作为 manual-first |
| `pptx-generator` | MiniMax / skills | PowerPoint 生成与编辑 | 无 |
| `skill-metric` | 无公开 upstream（作者：Juntao Deng） | 静态评分 skill 质量 | 无 |

### 2.8 社区来源：obra / superpowers

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `systematic-debugging` | 结构化排错方法论 | description 改成 bilingual trigger + Use-when |
| `verification-before-completion` | 完成前强制验证 | description 改成 bilingual trigger + Use-when |

### 2.9 社区来源：ZhanlinCui / Agent-Skills-Hunter

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `chat-compactor` | 生成结构化会话 handoff 文档 | 默认保存路径从 Claude 风格路径改成中性 `~/.agent-sessions/` |

### 2.10 Custom / 同事自定义来源

| Skill | 说明 | 共享库本地修改 |
|---|---|---|
| `paper-annotated-html` | 生成双栏悬停翻译 HTML 精读工作表 | vault 路径适配到当前 Obsidian 结构 |
| `paper-derivation-html` | 论文公式推导 → HTML | vault 路径适配到当前 Obsidian 结构 |
| `paper-derivation-markdown` | 论文公式推导 → Markdown | vault 路径适配到当前 Obsidian 结构 |
| `ml-concept-study` | 概念深度学习卡片 | scope 扩展到 ML + 计算神经科学 + 数学工具；路径与 taxonomy 调整 |
| `author-homepage` | 研究者主页档案生成 | vault 路径适配到当前 Obsidian 结构 |
| `semantic-scholar-daily` | 每日论文推荐 | 去掉 Claude-specific task 表述；补通用脚本；仍需 `SEMANTIC_SCHOLAR_API_KEY` |
| `research-refine` | 迭代细化研究方案 | 保留 proposal-first 默认交付与 exact round-2 implementation-pinned backbone |
| `research-refine-pipeline` | 串联方案细化与实验规划 | 改成顶层仍保持一一对应；将 experiment-planning workflow 内收到 skill 内部参考文档；补 `run_pipeline.py` 编排脚本；实验规划继承 exact round-2 backbone |
| `meeting-executive-summary` | 会议转 executive-summary 风格 Markdown 报告 | 由 anthropic-skill-creator 的 B 测试产物沉淀为独立 skill |
| `skill-manager` | 管理共享 skill 库及 source registry | 从本地 `.claude` 专用版泛化到共享库；支持显式管理 `~/.agent-share/skills/` |

---

## 3. 额外配置与运行时说明

### 3.1 主要目标 runtime

这套共享库当前主要面向：

- **Claude Code**
- **Codex**

Gemini CLI 当前环境下可以读取这些 skills 并依据 `SKILL.md` 回答问题，但没有观察到稳定的 native `activate_skill` 能力，因此不要把 Gemini 当作与 Claude Code / Codex 等价的执行目标。

### 3.2 需要额外配置的 skill

以下技能仍需要外部配置或账号能力：

- `semantic-scholar-daily`
  - 需要 `SEMANTIC_SCHOLAR_API_KEY`
- `scientific-schematics`
  - 需要 `OPENROUTER_API_KEY`
- `research-refine` / `research-refine-pipeline`
  - 默认依赖已登录的 coding CLI（`codex` / `claude` / `gemini`）来承担 reviewer 角色

### 3.3 无需额外 API key 的常用 skill

以下技能在当前共享库设计里可以不依赖新增 API key 直接使用：

`citation-management` · `hypothesis-generation` · `scientific-brainstorming` · `scientific-critical-thinking` · `scientific-writing` · `markitdown` · `literature-review` · `openalex-database` · `pubmed-database` · `statistical-analysis` · `sympy-symbolic-math` · `obsidian-markdown` · `obsidian-cli` · `obsidian-bases` · `defuddle` · `json-canvas` · `paper-search` · `research-paper-writing` · `youtube-transcript` · `planning-with-files` · `paper-annotated-html` · `paper-derivation-html` · `paper-derivation-markdown` · `ml-concept-study` · `author-homepage` · `anthropic-skill-creator` · `openai-skill-creator` · `pdf` · `pptx-generator` · `skill-metric` · `mcp-builder` · `frontend-design` · `web-artifacts-builder` · `doc-coauthoring` · `webapp-testing` · `systematic-debugging` · `verification-before-completion` · `chat-compactor` · `skill-manager`

---

## 4. 元数据与维护方式

共享库有两个权威文档：

- 人类可读说明：[`README.md`](README.md)
- 机器可读 registry：[`skill-manager/sources.yaml`](skill-manager/sources.yaml)

维护原则：

- 上游发生变化时，先比对整目录 diff，不只看 `SKILL.md`
- 任何共享库本地修改都要同步更新 `sources.yaml`
- 对已经跨 agent 改造过的 skill，不再回退到运行时翻译方案
- 如果未来需要新的 agent adapter，优先新增薄适配层，而不是分叉 skill 本体
- 上游 clone 通过 `skill-manager clone-sources` 统一管理；URL 记录在 `sources.yaml` 的 `source_repos:` 段

**K-Dense 特殊情况：** K-Dense 上游在每个 skill 目录内都 bundle 了 `generate_schematic.py` / `generate_schematic_ai.py`（全库 ~18 个 skill）。共享库只在 `scientific-schematics/` 保留这些脚本，其余 K-Dense skill 一律省略。`check-updates` 时忽略这些文件的缺失 — 详见 `sources.yaml` 顶部注释。

---

## 5. 当前兼容性结论

| 目标 | 当前状态 |
|---|---|
| Claude Code | 原生可用 |
| Codex | 原生可用，且已针对共享库中的关键 skill 做过实测 |
| Gemini CLI | 可读取并依据 skill 内容回答 / 辅助执行；当前环境未观察到稳定的 native `activate_skill` |

因此，这个共享库当前可以视为：

- **Claude Code + Codex 的 canonical shared skill library**
- **Gemini CLI 的 secondary compatible library**
