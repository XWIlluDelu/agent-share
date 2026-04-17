---
name: paper-annotated-html
description: 'Generate a self-contained two-column annotated HTML reading worksheet from a neuroscience or computational paper — left column English text with sentence-level hover translations (trigger on the last word of each sentence), right column Chinese academic annotations, plus a Main Figures & Legends section with per-panel hover notes and a bottom Wonksheet indexed by question color. Use when the user has a paper (PDF or full text) and a list of teaching questions, and wants an interactive bilingual HTML saved under 30_Reading/Annotated/ with images under 60_Assets/Figures/. Triggers: annotated html, 双栏批注, 课堂讲义, 精读 html, Wonksheet, 悬浮翻译, hover translation worksheet. For Markdown derivation notes use paper-derivation-markdown; for deep single-paper notes use paper-analyze.'
---

# Paper Annotated HTML

将单篇神经科学 / 计算论文制作成一个**可直接本地打开的双栏批注 HTML 阅读讲义**，含 sentence-level 悬浮翻译、完整 figure legends、与按问题分色的 Wonksheet。

## 何时使用

当用户：
- 提供**论文 PDF 或全文文本**，并给出若干课堂问题（Q1, Q2, …），希望生成一份教学/精读用的 HTML；
- 需要**左栏英文原文 + 右栏中文批注**的双栏布局；
- 希望自动生成 **Main Figures & Legends 专区**和**底部 Wonksheet**；
- 要求**每句末词悬浮显示整句翻译**、**图注完整原文 + 每段悬浮翻译**、题号配色、响应式布局、完全离线。

## 输入假设

- 论文：PDF 路径；或已结构化的全文 Markdown / 纯文本（含章节标题）
- 元信息：标题、作者、期刊、年份、课程/周次
- 问题清单：`Q1`, `Q2`, …

## 输出

- **单个自包含 HTML 文件**，所有 CSS 与必要 JS **内联**，不依赖任何 CDN
- 文件名：`[year]_[article_short_title]_annotated.html`，例如 `2021_residual_dynamics_annotated.html`
- 位置：`30_Reading/Annotated/`
- 图片：从 PDF 提取后存入 `60_Assets/Figures/[year]_[short_title]/`，HTML 用相对路径引用

## 页面组成（总览）

1. **顶部导航栏** — 论文标题 / 课程信息、颜色图例（每个 Q 号一种色）、快捷跳转按钮。
2. **章节导航条 (sticky)** — Abstract / Introduction / Results / Discussion / Methods / Figures / Wonksheet。
3. **主体双栏** — 左：论文原文 + 句末词悬浮整句翻译 + `<mark>` 高亮；右：中文学术批注卡片（段落功能 / 论证逻辑 / 题目对应）。
4. **Figures & Legends** — 主图 + 完整 legend 原文 + 每条 panel 悬浮中文注释 + 下方中文说明卡（核心问题 / 关键结果 / 支撑结论）。
5. **Wonksheet** — 每题一卡片：核心论点、关键证据、论证链条、潜在反驳、讨论点。

详细样式、颜色、字体、tooltip 实现与 HTML 骨架见 `references/html_layout.md`；本 SKILL.md 不重复那些细节，生成前必读该文件。

## 核心规则

1. **保留论文原有逻辑顺序**，不随意重排章节或段落。
2. **批注是学术分析**，解释“作者在干什么、为什么这样干”，不是逐字翻译。
3. **句末词触发整句翻译**：每句话仅把最后一个词包成 `<span class="sent-trigger" data-cn="...">`；句末词不加下划线，用 `cursor: help` 等淡提示。
4. **图注保留完整原文**，每条 panel 单独包成 `<span class="legend-item" data-cn="中文翻译 + 详细注释">`。
5. **绝不编造**论文中不存在的信息；若对应关系不确定，按最合理匹配并保守处理。
6. **完全离线**：所有 CSS/JS 内联，图片走本地相对路径。

## 工作流

1. **获取输入**：读取 PDF 或全文；记录标题 / 作者 / 期刊 / 年份 / 课程；收集 Q1–Qn。
2. **读取参考**：打开 `references/html_layout.md`，按其中的结构与样式规范落地。
3. **拆章节**：Abstract / Introduction / Results / Discussion / Methods。
4. **填左栏**：段落原文 + `<mark class="qX">` 关键句高亮 + 每句末词悬浮翻译。
5. **填右栏**：与左栏段落一一对应的批注卡片（带题号色条与多题标签）。
6. **处理 Figures**：提取到 `60_Assets/Figures/...`；右栏放完整 legend 原文，每条 panel 带悬浮中文注释；下方加总结卡。
7. **生成 Wonksheet**：每题整合全文证据，产出五小节。
8. **保存**：写入 `30_Reading/Annotated/[year]_[article_short_title]_annotated.html`；确认所有图片路径有效、HTML 可离线双击打开。

## 边界情况

- **Figure 与 legend 匹配不确定** → 基于 `Figure X.` 标题与紧邻段落做最合理匹配；宁可标注为“待核实”，不要编造。
- **PDF 图像质量差** → 用整页高清截图替代，保证可读性胜于精确裁剪。
- **题目多于预设色板** → 在 `<style>` 中扩展题号色类；保持与顶部图例一致。
- **目标目录不存在** → 创建 `30_Reading/Annotated/` 与 `60_Assets/Figures/` 对应子目录，再写入文件。
