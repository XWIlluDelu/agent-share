---
name: paper-analyze
description: "深度分析单篇论文，生成详细笔记和评估，图文并茂 / Deep analyze a single paper, generate detailed notes with images"
allowed-tools: Read, Write, Bash, web-fetch
---

# Language Setting / 语言设置

Read `$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml` for the `language` field (`"zh"` default, `"en"` for English). Pass `--language $LANGUAGE` to all scripts. Generate all content (section headers, body text) in the matching language.

```bash
LANGUAGE=$(grep -E "^\s*language:" "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml" | awk '{print $2}' | tr -d '"')
[ -z "$LANGUAGE" ] && LANGUAGE="zh"
```

Bilingual section header mapping lives at `references/bilingual_headers.md`.

---

# 目标

对特定论文进行深度分析，生成全面笔记，评估质量和价值，并更新知识库。

# 工作流程

## 步骤0：初始化环境

```bash
mkdir -p /tmp/paper_analysis && cd /tmp/paper_analysis
PAPER_ID="[PAPER_ID]"
VAULT_ROOT="${OBSIDIAN_VAULT_PATH}"
PAPERS_DIR="${VAULT_ROOT}/20_Research/Papers"
```

## 步骤1：识别论文

接受输入格式：arXiv ID (`2402.12345`)、完整ID (`arXiv:2402.12345`)、论文标题、文件路径。

1. 按 arXiv ID / 标题在 `20_Research/Papers/` 搜索已有笔记
2. 如果找到，读取并返回完整内容

## 步骤2：获取论文内容

### 2.1 从 arXiv 获取

```bash
# 下载 PDF
curl -L "https://arxiv.org/pdf/$PAPER_ID" -o /tmp/paper_analysis/$PAPER_ID.pdf
# 下载源码包（含 TeX 和图片）
curl -L "https://arxiv.org/e-print/$PAPER_ID" -o /tmp/paper_analysis/$PAPER_ID.tar.gz
tar -xzf /tmp/paper_analysis/$PAPER_ID.tar.gz -C /tmp/paper_analysis/
```

### 2.2 提取元数据

```bash
curl -s "https://arxiv.org/abs/$PAPER_ID" > /tmp/paper_analysis/arxiv_page.html
TITLE=$(grep -oP '<title>\K[^<]*' /tmp/paper_analysis/arxiv_page.html | head -1)
AUTHORS=$(grep -oP 'citation_author" content="\K[^"]*' /tmp/paper_analysis/arxiv_page.html | paste -sd ', ')
DATE=$(grep -oP 'citation_date" content="\K[^"]*' /tmp/paper_analysis/arxiv_page.html | head -1)
```

也可使用 web-fetch 工具访问 arXiv API (`id_list=[arXiv ID]`) 或 Hugging Face 获取详情。

### 2.3 读取 TeX 源码

读取各章节 `.tex` 文件以获取完整论文内容。

## 步骤3：执行深度分析

### 3.1 分析摘要
- 提取关键概念：主要研究问题、关键术语、技术领域
- 总结研究目标：要解决的问题、解决方案方法、主要贡献
- 生成中文翻译（使用适当技术术语）

### 3.2 分析方法论
- 识别核心方法：主要算法、技术创新点、与现有方法的区别
- 分析方法结构：组件关系、数据流/处理流水线、关键参数
- 评估方法新颖性

### 3.3 分析实验
- 提取实验设置：数据集、对比基线、评估指标、实验环境
- 提取结果：关键性能数字、与基线对比、消融研究
- 评估实验严谨性

### 3.4 生成洞察
- 研究价值：理论贡献、实际应用、领域影响
- 局限性：论文中提到的 + 潜在弱点 + 可能不成立的假设
- 未来工作：作者建议 + 自然扩展 + 改进空间
- 与相关工作对比：搜索相关历史论文，定位研究路线

### 3.5 公式输出规范（Markdown LaTeX）
- 行内公式：`$...$`；块级公式：`$$...$$` 单独成行
- 不要用三反引号代码块包裹需要渲染的公式
- 不要使用纯文本伪公式替代 LaTeX
- 多行/推导型公式统一用块级 `$$...$$`
- 保持符号与原论文一致

## 步骤4：复制图片并生成笔记

### 4.1 复制图片

```bash
DOMAIN="[推断的领域]"
PAPER_TITLE="[论文标题，空格替换为下划线]"
IMAGES_DIR="${PAPERS_DIR}/${DOMAIN}/${PAPER_TITLE}/images"
mkdir -p "$IMAGES_DIR"
cp /tmp/paper_analysis/*.{pdf,png,jpg,jpeg} "$IMAGES_DIR/" 2>/dev/null
```

### 4.2 确定领域

推断规则：
- agent/swarm/multi-agent/orchestration → 智能体
- vision/visual/image/video → 多模态技术
- reinforcement learning/RL → 强化学习_LLM_Agent
- language model/LLM/MoE → 大模型
- 否则 → 其他

### 4.3 生成笔记

```bash
NOTE_PATH="${PAPERS_DIR}/${DOMAIN}/${PAPER_TITLE}.md"
python3 "scripts/generate_note.py" --paper-id "$PAPER_ID" --title "$TITLE" --authors "$AUTHORS" --domain "$DOMAIN" --language "$LANGUAGE"
```

Full note template lives at `references/note_template.md` -- copy from there when generating a note.

### 4.4 格式修复

分析完成后，调用 `/obsidian-markdown` skill 确保 frontmatter 格式正确，然后手动补充详细内容。

## 步骤5：更新知识图谱

```bash
python3 "scripts/update_graph.py" --paper-id "$PAPER_ID" --title "$TITLE" --domain "$DOMAIN" --score [评分] --language "$LANGUAGE"
```

图谱文件：`$OBSIDIAN_VAULT_PATH/20_Research/PaperGraph/graph_data.json`

节点包含：quality_score, tags, domain, analyzed: true。
边类型：`improves`, `extends`, `compares`, `follows`, `cites`, `related`（权重 0.3-0.8）。

## 步骤6：展示分析摘要

输出格式：论文标题、笔记位置、综合评分（含5项分项）、突出亮点、主要优势/局限、相关论文列表、技术路线定位、快速操作建议。

---

# 重要规则

- **保留用户现有笔记** -- 不要覆盖手动笔记
- **使用全面分析** -- 涵盖方法论、实验、价值评估
- **根据 `$LANGUAGE` 选择语言** -- section headers 和 content 都要匹配
- **引用相关工作** -- 建立连接到现有知识库
- **客观评分** -- 使用 `references/scoring_rubric.md` 中的评分标准
- **更新知识图谱** -- 维护论文间关系
- **图文并茂** -- 论文中的所有图都要用上（核心架构图、方法图、实验结果图等）
- **优雅处理错误** -- 如果一个源失败则继续
- **管理 token 使用** -- 全面但不超出 token 限制

## Obsidian 格式规则（必须遵守）

1. **图片嵌入**：必须用 `![[filename.png|800]]`，禁止 `![alt](path%20encoded)`（URL 编码在 Obsidian 中不工作）
2. **Wikilink 必须用 display alias**：`[[File_Name|Display Title]]`，禁止 bare `[[File_Name]]`
3. **不要用 `---` 作为"无数据"占位符**：使用 `--` 代替（`---` 会被 Obsidian 解析为分隔线）
4. **机构/Affiliation 提取**：从 arXiv 源码包的 `.tex` 文件提取 `\author`/`\affiliation` 字段；若不可用，标 `--`
5. **frontmatter 格式**：所有字符串值必须用双引号包围（Obsidian 对 YAML 格式要求严格）
6. **标签名不能有空格**：空格替换为短横线 `-`（如 `Agent-Swarm`）

---

# 错误处理

- **论文未找到**：检查 ID 格式，建议搜索
- **arXiv 掉线**：使用缓存或稍后重试，在输出中注明局限性
- **PDF 解析失败**：回退到摘要，注明局限性
- **相关论文未找到**：说明缺乏上下文
- **图谱更新失败**：继续但不更新图谱

---

# 使用说明

当用户调用 `/paper-analyze [论文ID]` 时：

## 快速执行（推荐）

```bash
#!/bin/bash
PAPER_ID="$1"
TITLE="${2:-待定标题}"
AUTHORS="${3:-Unknown}"
DOMAIN="${4:-其他}"

python3 "scripts/generate_note.py" --paper-id "$PAPER_ID" --title "$TITLE" --authors "$AUTHORS" --domain "$DOMAIN" --language "$LANGUAGE" || \
    echo "笔记生成脚本执行失败"
```

## 手动分步执行（用于调试）

```bash
# 步骤0：初始化
mkdir -p /tmp/paper_analysis && cd /tmp/paper_analysis

# 步骤1：搜索已有笔记
find "${VAULT_ROOT}/20_Research/Papers" -name "*${PAPER_ID}*" -type f

# 步骤2：获取论文内容（下载 PDF/源码，或从已有数据读取）

# 步骤3：提取图片
/extract-paper-images "$PAPER_ID" "$DOMAIN" "$TITLE"

# 步骤4：生成笔记
python3 "scripts/generate_note.py" --paper-id "$PAPER_ID" --title "$TITLE" --authors "$AUTHORS" --domain "$DOMAIN" --language "$LANGUAGE"

# 步骤5：更新图谱
python3 "scripts/update_graph.py" --paper-id "$PAPER_ID" --title "$TITLE" --domain "$DOMAIN" --score 8.8 --language "$LANGUAGE"

# 步骤6：格式修复
# 调用 /obsidian-markdown 确保 frontmatter 正确
```

## 工作流程示例

**场景1：分析 arXiv 论文（有网络访问）**
```bash
bash run_full_analysis.sh 2602.02276 "Kimi K2.5: Visual Agentic Intelligence" "Kimi Team" "智能体"
```

**场景2：分析本地 PDF（无网络访问）**
```bash
cp /path/to/local.pdf /tmp/paper_analysis/[ID].pdf
python3 run_paper_analysis.py [ID] [TITLE] [AUTHORS] [DOMAIN] --local-pdf /tmp/paper_analysis/[ID].pdf
```

## 注意事项

1. **frontmatter 格式（重要）**：所有字符串值必须用双引号包围
2. **图片嵌入**：必须用 `![[filename.png|800]]`（从 arXiv 提取的图片可能是 `.pdf` 或 `.png`）
3. **wikilinks**：必须用 display alias `[[File_Name|Display Title]]`
4. **领域推断**：根据论文内容自动推断
5. **相关论文**：在笔记中引用 `[[path/to/note|Paper Title]]`
