# HTML 布局与实现规范

本文件收录 paper-annotated-html 的详细页面布局、设计风格、悬浮实现与结构示例。`SKILL.md` 只保留总览；具体页面结构以此文件为准。

## 页面整体结构

页面主要分为四大区域：

1. 顶部导航栏（全局 header）
2. 章节导航条（sticky）
3. 主体双栏内容（左：原文，右：批注）
4. Figures & Legends 专区 + 底部 Wonksheet

### 1. 顶部导航栏

要求：
- 背景色：**深海军蓝**（例如 `#0b1f33`）
- 文本颜色：浅色（如 `#f5f5f5`）
- 布局：
  - 左侧：标题区
    - 主标题：论文标题 + 课程信息（如：`Residual dynamics in PFC — Neural Computation (Week 3)`）
    - 副标题：作者、期刊、年份
  - 中部：颜色图例
    - 每个问题（Q1, Q2, …）对应一种**固定颜色**的小色块 + 标签文本
      - 例如：Q1 = `#e57373`，Q2 = `#64b5f6`，Q3 = `#81c784`，按最多 ~8–10 题预定义或算法生成色板。
  - 右侧：快捷按钮
    - 按钮：`Abstract` / `Main Text` / `Figures` / `Wonksheet`
    - 点击后平滑滚动到对应 section（用 JavaScript `scrollIntoView` 或带 offset 的滚动）。

实现要点：
- 使用 `position: sticky` 或 `position: fixed` 让顶栏在桌面端始终可见。
- 为导航按钮和颜色图例添加 `title` 或 `aria-label` 以增强可访问性。

### 2. 章节导航条

放在顶部导航栏之下，**sticky 固定在页面顶部**（或与顶部导航合并为两行结构）。

包含可点击锚点：
- `Abstract`
- `Introduction`
- `Results`
- `Discussion`
- `Methods`
- `Figures`
- `Wonksheet`

要求：
- 当前阅读位置在导航条中高亮：
  - 通过监听滚动事件，根据可见 section 更新高亮样式（例如追加 `.active` 类）。
  - 样式：下划线、背景色或字体颜色改变即可。

### 3. 主体内容：双栏批注区

采用**响应式双栏布局**：
- 桌面端：左右两栏并排（约 55% / 45% 或 3:2 宽度比）
- 移动端：单栏纵向（先原文后批注段落，或交替布局）

#### 左栏：论文原文

要求：
- 按论文原有段落与章节结构呈现：
  - 章节标题：`Abstract`, `Introduction`, `Results`, `Discussion`, `Methods` 等
  - 段落间适度行距，避免过密
- 与问题相关的**关键词 / 核心句**使用 `<mark>` 高亮并着色：
  - `<mark class="q1"> ... </mark>` 与 Q1 颜色一致
  - `<mark class="q2"> ... </mark>` 与 Q2 颜色一致
  - 不同题号对应不同颜色类，样式在 `<style>` 中定义。
- **句子级悬浮翻译（必选）**：
  - **每一句话**都提供中文翻译，鼠标悬浮时显示**当前句子的完整翻译**。
  - **入口统一放在该句的最后一个词上**：仅将句末最后一个词包在 `<span class="sent-trigger" data-cn="本句完整中文翻译">最后一个词</span>` 中，避免整句下划线导致版面杂乱。
  - 句末词**不要**使用下划线或明显底边样式；可用 `cursor: help` 或极淡的视觉提示表示“此处可悬停看翻译”。
  - 实现方式：用 CSS 的 `::after` 或 JS 在 `mouseenter` 时显示 tooltip，内容为 `data-cn` 中的整句翻译；tooltip 样式与正文区分、易读（如深底白字、合适字号、最大宽度限制自动换行）。
- **不使用术语悬浮翻译**：左栏仅保留句末词→整句翻译，不再对单个术语做悬浮解释（不使用 `class="term"`）。

#### 右栏：中文逐段批注

结构：
- 与左侧段落一一对应的**批注卡片**，可使用卡片式布局：
  - 左侧窄色条：对应题号主色（如 Q2 卡片左边条为 Q2 颜色）
  - 卡片背景为浅色（如 `#f7f8fc`）
  - 顶部标题示例：`【Q2 核心论点】` 或 `【Q1+Q3 实验设计】`

每个批注卡片至少包括：
- **段落功能**：此段在本节中的角色（引入问题 / 提出假设 / 描述方法 / 报告结果 / 讨论局限等）
- **论证逻辑**：作者如何从前文推导到这里、使用了哪些证据或假设
- **题目对应关系**：说明回答了哪道题（可多选），属于哪个层次（现象 / 机制 / 方法 / 应用）
- （可选）**整篇文章中的作用**：一句话说明这段在整篇文章逻辑链中的地位

要求：
- 批注偏向**学术分析**而非简单翻译，解释“作者在干什么”和“为什么这样干”。
- 同一段可以关联多个问题，使用多个颜色标签或 `[Q1][Q3]` 标记。

### 4. Figures & Legends 专区

单独 `section`，标题为 `Main Figures & Legends`。

每个 Figure：
- 按 `Figure 1`, `Figure 2`, `Figure 3`, … 排列
- 使用左右双栏布局：
  - **左栏**：主图图片 `<img>`，宽度适度放大以适合科研阅读
  - **右栏**：**完整 legend 原文**，直接放论文中的**完整图注原文**，包括：
    1. **图片标题**：Figure X 后的完整标题句（英文，与 PDF 一致）
    2. **每个 panel 的说明**：按 a, b, c, … 逐条列出，**每条使用论文中的完整原文**，不缩写、不合并，让读者能完整看到“该 panel 讲了什么”
- **Legend 悬浮显示**：
  - 标题以及每一条 panel 说明都可单独悬浮显示内容；悬浮内容为 **中文翻译 + 更详细的注释说明**（即该条在讲什么、图中应关注什么、与主结论的关系等，一两句到多句均可）。
  - 实现方式：标题与每条 panel 说明包在 `<span class="legend-item" data-cn="中文翻译。详细注释：该条在讲…；图中注意…；与…结论的关系。">完整英文原文...</span>`。鼠标移入时显示 `data-cn`（tooltip），与左栏句子翻译样式统一。
  - 入口不做下划线，用 `cursor: help` 等淡提示即可。
- 下方增加一个**中文说明卡片**（与 legend 区分，为总结性解读）：
  - **核心问题**：这张图试图回答什么科学问题？
  - **关键结果**：图中最重要的定性/定量结果是什么？
  - **支撑结论**：它支持了论文中的哪一个核心结论（可用句号或 bullets 简述）

#### 图像提取规则

当从 PDF 中提取图片时：
- 优先提取**完整 Figure 区块**，而不是拆分为零散 panel：
  - 若一张 Figure 包含 A/B/C… 多个 panel，尽量保持整体主图。
- 若无法可靠裁剪出单独 Figure：
  - 使用该页的**高清整页截图**代替，确保清晰可读。
- 若 PDF 图像质量有限：
  - 优先保证**清晰度、完整性与可读性**，不要牺牲清晰度去追求完美裁剪。
- Legend 匹配：
  - 尽量通过 figure 编号、标题和相邻文本匹配 legend；
  - 如版式复杂，优先依据：
    1. 明确的 `Figure X.` 标题
    2. 与该标题紧邻的图注段落
  - 不要编造 PDF 中**不存在**的图注内容。

#### 图片文件与路径

- 所有从 PDF 提取的图片保存到 `60_Assets/Figures/` 目录中（可使用子目录按论文分组）。
- HTML 中引用时：
  - 使用相对路径指向这些图片；
  - 确保在当前 Obsidian vault 中双击 HTML 即可加载所有图像，无需网络。

### 5. 底部 Wonksheet 答题索引

底部设置 `Wonksheet` 区域，采用**双栏或卡片式布局**。

每道题单独一块：
- 带**彩色题号标签**（颜色与顶部图例一致，如 `Q1` 用 Q1 颜色）
- 结构建议：
  - 标题：`Q1. [问题内容]`
  - 小节：
    - **核心论点**：论文对本问题给出的主要回答或立场
    - **关键证据**：支撑该回答的关键实验 / 分析 / 理论论据
    - **论证链条**：简述从结果到结论的逻辑路径，可用 2–4 步 bullet
    - **潜在反驳或局限**：该结论可能的弱点、边界条件或替代解释
    - **课堂讨论点**：最值得在课堂讨论、争论或拓展的点（1–2 条即可）

## 左栏：句子级悬浮翻译规则（必选）

- **覆盖范围**：左侧原文的**每一句话**都应有对应中文翻译；翻译在悬浮时显示，不直接铺在正文中。
- **入口位置**：**仅以该句的最后一个词**作为悬浮入口。将该词包在 `<span class="sent-trigger" data-cn="本句完整中文翻译">最后一个词</span>` 中，句中其他词不加标记。
- **样式**：句末触发词**不要**使用下划线；建议 `cursor: help` 或极淡提示即可。
- **实现**：用 CSS 或 JavaScript 在悬停时显示 `data-cn` 中的整句翻译；tooltip 需易读（深底白字、合适字号、max-width 换行）。
- **不做术语悬浮**：左栏仅保留句末词→整句翻译，不对单个术语做悬浮解释。

## 设计风格与前端细节

整体风格：
- 顶部导航：深海军蓝背景，白色或浅色文字。
- 页面背景：偏**米白纸张色**（如 `#f5f2e8`），营造纸质阅读感。
- 字体：
  - 正文（原文与 legend）：衬线字体，如 `Lora, 'Times New Roman', serif`
  - 界面 / UI 文本（导航、按钮、卡片标题等）：无衬线字体，如 `IBM Plex Sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- 批注卡片：
  - 左侧彩色边条（对应题号颜色）
  - 浅色背景（如 `#f8fafc`），圆角 + 轻微阴影增强分组感
- `<mark>` 高亮：
  - 背景色与题号颜色一致或为其浅色版本（可使用 `rgba` 降低饱和度）

响应式布局：
- 使用 CSS Grid 或 Flexbox 实现双栏布局：
  - 桌面：`grid-template-columns: 3fr 2fr;` 或类似比例
  - 移动端：单列布局（通过媒体查询在窄屏下堆叠）
- 确保导航栏在移动端不遮挡内容（可以变为折叠菜单或多行）。

## 实现参考：句末词与 Legend 悬浮

**左栏句末词**（整句翻译入口，无下划线）：
```html
<p>Relating neural activity to behavior requires an understanding of how neural computations arise from the coordinated <span class="sent-trigger" data-cn="将神经活动与行为联系起来，需要理解神经计算如何从协调的、循环连接的神经群体动力学中产生。">populations.</span></p>
```
```css
.sent-trigger { cursor: help; }
.sent-trigger:hover::after { content: attr(data-cn); position: absolute; background: #333; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 0.9rem; max-width: 320px; z-index: 1000; white-space: normal; }
/* 或用 JS 统一生成 tooltip 节点，避免 ::after 换行/定位问题 */
```

**Figure 右栏：完整 legend 原文 + 悬浮显示详细注释**：
- 正文直接放论文中的**完整图注原文**（不缩写），让读者看到每个 panel 的完整说明。
- 每条（标题或 panel）包在 `legend-item` 中，`data-cn` 为**中文翻译 + 详细注释**（该条在讲什么、图中应关注什么、与主结论的关系）。
```html
<div class="figure-legend">
  <span class="legend-item" data-cn="中文：区分输入与循环动力学对神经响应的贡献。注释：本图总领全文框架，说明为何需要区分 F(z) 与 u，以及解剖视角与功能视角的对应。">Figure 1 | Disentangling contributions of inputs and recurrent dynamics to neural responses.</span>
  <span class="legend-item" data-cn="中文：a，计算即动力学。解剖视角（左）：…。注释：图中左右对比解剖与功能视角；注意记录区（橙）与上游（绿）的划分；底部为图模型。">a, Computation through dynamics. Anatomical view (left): … Functional view (right): …</span>
</div>
```

## 结构性示意（骨架）

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>[Title] — Annotated</title>
    <style>
      /* 内联 CSS，定义颜色、双栏布局、导航、高亮、tooltip 等 */
    </style>
    <script>
      // 少量 JS：导航滚动、高亮当前章节、tooltip 逻辑等
    </script>
  </head>
  <body>
    <header class="top-nav">
      <!-- 标题、课程信息、作者期刊年份、颜色图例、快捷按钮 -->
    </header>

    <nav class="section-nav">
      <!-- Abstract / Introduction / Results / ... / Figures / Wonksheet -->
    </nav>

    <main class="content">
      <section id="abstract">
        <!-- 双栏：左原文右批注 -->
      </section>
      <!-- 其他章节 -->
    </main>

    <section id="figures">
      <!-- Main Figures & Legends -->
    </section>

    <section id="wonksheet">
      <!-- Q1, Q2, ... 答题卡片 -->
    </section>
  </body>
</html>
```
