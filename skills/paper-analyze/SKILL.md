---
name: paper-analyze
description: "深度分析单篇论文，生成高质量研究笔记与批判性评估 / Deep analyze a single paper into a high-quality research note with critical evaluation"
allowed-tools: Read, Write, Bash, web-fetch
---

# Language Setting / 语言设置

Read `$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml` for the `language` field (`"zh"` default, `"en"` for English). Generate all section headers and body text in that language. If the config is unavailable, default to Chinese.

```bash
LANGUAGE=$(grep -E "^\s*language:" "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml" | awk '{print $2}' | tr -d '"')
[ -z "$LANGUAGE" ] && LANGUAGE="zh"
```

Bilingual section header mapping lives at `references/bilingual_headers.md`.

---

# 目标

对单篇论文做**高质量、可复查、带判断的深度分析**。主交付物是一份研究笔记或等价分析输出；图片、graph update、脚本生成都只是增强项，不能阻塞主分析。

本 skill 的重点不是“把章节填满”，而是：
- 先判断这篇论文属于什么类型；
- 再用正确的批判框架分析；
- 明确区分作者声称、论文证据、以及你的判断；
- 把主要 claims 绑到具体 evidence 上；
- 用 severity 排序 concerns，而不是堆泛泛而谈的缺点。

---

# 工作流程

## 1. 先判断输入分支

接受输入格式：arXiv ID (`2402.12345` / `arXiv:2402.12345`)、论文标题、本地 PDF 路径、已有笔记路径、摘要或局部文本。

优先顺序：
1. **已有笔记**：在 `20_Research/Papers/` 找到现有笔记 → 读取并在其基础上补充分析，不覆盖用户手写内容。
2. **本地 PDF**：直接读取 PDF，提取标题/作者/摘要/结构，进入分析。
3. **arXiv / 标题**：尽可能获取 PDF、元数据、源码或摘要，再进入分析。
4. **只有摘要或局部材料**：做降级版分析，明确标注局限，不等待缺失资源。

## 2. 获取论文内容

### 2.1 本地 PDF 分支（优先）
如果用户提供了本地 PDF：
- 直接读取 PDF；
- 提取标题、作者、摘要、章节结构；
- 如可提图，保留核心架构图/方法图/结果图；
- 如果 PDF 解析不完整，至少保留摘要级分析并标注局限。

### 2.2 arXiv 分支
如果输入是 arXiv ID，可获取 PDF、摘要页、源码包（如可用）。如果某一步失败，继续完成分析，不把下载失败当成主任务失败。

### 2.3 不完整输入分支
如果只有标题、摘要、或局部文本：
- 仍然生成分析；
- 重点写研究问题、方法主线、潜在价值、明显局限；
- 明确哪些内容来自原文，哪些是保守推断；
- 不要为了等图片/源码/相关工作而停住。

## 3. 分析前先判论文类型

不要默认所有论文都按标准 ML benchmark paper 来读。先给出一个**主类型**：
- **theory / model paper**
- **empirical methods paper**
- **neuroscience / experimental paper**
- **hybrid**（若混合，必须说明主次，不要平均用力）

然后读取 `references/critique_checklists.md` 中对应路线的 checklist。

### 判断原则
- 看**贡献重心**，不要只看 topic。
- 理论论文：主要价值在 theorem / formal insight / model explanation。
- 方法论文：主要价值在 mechanism、训练路线、与 baseline 的比较。
- 神经科学论文：主要价值在 task design、evidence、interpretation、controls、统计与推断边界。

## 4. 执行深度分析

### 4.1 全局硬约束
无论是哪一类论文，都必须满足：

1. **冻结问题锚点（Problem Anchor）**
   - 这篇论文真正试图解决的 bottleneck 是什么？
   - 哪些问题它并没有解决？
   - 后面所有判断都要回到这个 anchor，避免被 paper 的叙事带跑。

2. **区分三层对象**
   - `Author claims`：作者明确声称了什么
   - `Paper evidence`：论文真正展示了什么 figure / table / theorem / experiment
   - `My judgment`：你认为最合理的结论范围是什么

3. **做 claim → evidence 绑定**
   - 每个 major claim 都要对应到具体 theorem / figure / table / experiment。
   - 没有足够证据的 claim，标为 `weakly supported` 或 `inferred`，不要硬给高评价。

4. **对判断标强度标签**
   - `supported`
   - `weakly supported`
   - `inferred`

5. **按严重程度组织问题**
   - `Critical`
   - `Important`
   - `Minor`

6. **不要让总分机械平均**
   - 如果存在 critical flaw，总分通常不能过高。
   - 如果论文有明显 claim inflation，要先降低 interpretation discipline，再考虑 overall score cap。

### 4.2 Route-specific analysis focus

#### A. Theory / model paper
重点检查：
- main theorem / formal result 到底是什么；
- assumptions 中哪些是真正 load-bearing 的；
- theorem scope 到哪里为止；
- proof strategy 是否带来机制性 insight，还是只是技术认证；
- toy-to-general gap；
- failure regimes；
- 若有实验，它们是否真的测试了理论 claim。

写作时优先用“assumptions → target conclusion → what is actually proved”这条线。

#### B. Empirical methods paper
重点检查：
- claimed mechanism of gain；
- baseline fairness（backbone / data / compute / tuning / augmentation / protocol）；
- ablation 是否隔离 necessity / sufficiency / interaction；
- metric 是否真的衡量了 claimed capability；
- failure cases 和异常现象；
- hidden load-bearing tricks；
- reproducibility bottlenecks。

写作时优先用“objective → obstacle → mechanism → evidence for mechanism”这条线。

#### C. Neuroscience / experimental paper
重点检查：
- task design 是否真的隔离了目标认知变量；
- controls 是否排除了关键替代解释；
- unit of analysis 是否正确（subject / session / neuron / voxel / trial）；
- statistics、uncertainty、multiple comparisons、across-subject robustness；
- claim type 是 correlational / predictive / mechanistic / causal 中哪一种；
- 是否把 decoding、trajectory geometry、tuning 或 latent factors 过度解释为机制。

写作时优先用“task logic → evidence pattern → alternative explanations → supportable conclusion”这条线。

## 5. 输出结构

主结构以 `references/note_template.md` 为准。必须至少包含：
- 核心信息
- 一段式结论
- 论文类型与判断理由
- 研究问题 / problem anchor
- Main author claims
- 方法 / 理论核心
- Route-specific checklist result
- Claim-to-evidence map
- Strengths
- Concerns by severity
- Author claims vs analyst judgment
- 作者自述局限 vs 我的额外局限
- 技术路线定位 / 相关工作关系
- Scorecard
- Overall judgment

如果材料不足，可删减细节，但不要删掉：
- paper type
- claim-to-evidence
- severity-ranked concerns
- author/evidence/judgment separation

## 6. 评分规则

评分细则见 `references/scoring_rubric.md`。

默认维度：
- Problem importance / question clarity
- Novelty / contribution sharpness
- Method or theoretical soundness
- Evidence strength
- Experimental / analytical rigor
- Interpretation discipline
- Reproducibility / transparency
- Scientific or practical impact

### 评分纪律
- 分数必须附理由。
- 总分要反映最严重的问题，不是子分简单平均。
- 对 theory / methods / neuroscience 三类论文使用不同的评价重点。

## 7. 图片、笔记生成、知识图谱

### 7.1 图片
如果已经有 PDF / arXiv source：
- 优先保留核心架构图、方法图、结果图；
- 如果没有提取出图像，不阻塞主分析。
- 不要为了“图文并茂”牺牲判断质量。

### 7.2 生成笔记骨架（可选）
如果需要写入 vault，可用：

```bash
python3 "scripts/generate_note.py" --paper-id "$PAPER_ID" --title "$TITLE" --authors "$AUTHORS" --domain "$DOMAIN" --language "$LANGUAGE"
```

但注意：
- `generate_note.py` 只是可选骨架，不是质量保证来源；
- 如果脚本不可运行，直接按 `references/note_template.md` 手写同等结构内容；
- 不要把脚本成功与否当成分析成功与否。

### 7.3 更新知识图谱（可选）
只有在 vault 可写且用户明确需要维护图谱时才更新：

```bash
python3 "scripts/update_graph.py" --paper-id "$PAPER_ID" --title "$TITLE" --domain "$DOMAIN" --score [评分] --language "$LANGUAGE"
```

如果图谱更新失败：继续交付，不要把它当成主任务失败。

---

# 重要规则

- **保留用户现有笔记**：不要覆盖手动笔记。
- **优先深度，不优先铺满模板**：少量高价值判断优于长篇空泛小标题。
- **根据 `$LANGUAGE` 选择语言**：section headers 和 body 都要匹配。
- **客观评分**：按 `references/scoring_rubric.md` 给分，不要机械平均。
- **优雅处理错误**：一个源失败就继续，不要卡死。
- **不确定时要保守**：把推断标成 `inferred`，不要伪装成原文结论。
- **图和 graph 都是增强项**：不是主任务成功条件。

## Obsidian 格式规则（写入笔记时必须遵守）
1. 图片嵌入使用 `![[filename.png|800]]` 或实际文件名，禁止 URL 编码路径。
2. Wikilink 优先使用 display alias：`[[File_Name|Display Title]]`。
3. 不要用 `---` 作为“无数据”占位符，使用 `--`。
4. frontmatter 中字符串值用双引号包围。
5. 标签名不能有空格，空格替换为 `-`。

---

# 错误处理

- **论文未找到**：检查 ID / 标题 / 路径，建议搜索。
- **arXiv 掉线**：使用已有材料或摘要完成分析，并注明局限。
- **PDF 解析失败**：回退到摘要级分析，注明局限。
- **相关工作缺失**：说明上下文不足，不强行补齐。
- **graph update 失败**：继续交付。

---

# 使用说明

当用户调用 `/paper-analyze [论文ID]` 或提供本地 PDF / 标题时：
1. 先判断输入属于哪一类：已有笔记 / 本地 PDF / arXiv / 不完整材料。
2. 再判断论文主类型：theory / methods / neuroscience / hybrid。
3. 用对应 checklist 执行分析。
4. 主交付物永远是**高质量分析**；图片、脚本、graph update 都是可选增强。

最小可行原则：
- 有材料就分析；
- 证据不足就明确降级；
- 不要把流程完整性误当成分析质量。
