---
name: paper-derivation-markdown
description: Extract and reconstruct key derivation steps from model-oriented papers into an Obsidian-compatible Markdown note with correct LaTeX math. This skill must use the `obsidian-markdown` skill as the final formatting specification for the generated `.md` file. Use this whenever the user wants to understand a paper's derivation step by step, asks to fill in missing intermediate equations, wants notation/subscripts explained clearly, or wants the result saved as Markdown or an Obsidian note instead of HTML. Also use proactively when the user mentions 论文推导, derivation, 公式推导, math derivation, 整理成 markdown, 整理成 md, 整理成 Obsidian 笔记, or asks to turn a paper's mathematical logic into a readable note.
---

# Paper Derivation Markdown

将论文中的**关键数学推导**重建为一篇 **Obsidian 兼容 Markdown 笔记**，重点是补全跳步、统一符号、保留公式逻辑链，而不是逐字翻译原文。

## 强制输出规范

生成最终 `.md` 文件时，**必须使用 `obsidian-markdown` skill 作为输出规范**。

这意味着：

- 本 skill 负责提取、重建、组织论文推导逻辑
- `obsidian-markdown` skill 负责约束最终 Markdown 的写法与 Obsidian 语法
- 若二者发生冲突，**最终文件格式规范以 `obsidian-markdown` skill 为准**

生成内容时，遵循 `obsidian-markdown` skill 的写作规范：

- 输出必须是 `.md`，不是 HTML
- 使用 Obsidian 友好的 frontmatter、标题层级、callout、wikilink、LaTeX 数学块
- 不用原始 HTML 包装推导内容，除非用户明确要求

如果运行环境支持多 skill 协作，则在写最终笔记前应显式加载或参照 `obsidian-markdown` skill。

## 何时使用

当用户：

- 提供一篇**模型/方法向**论文，希望把核心数学部分整理成可长期保存的 Obsidian 笔记；
- 想看**一步一步**的推导，而不是只要结论；
- 明确要求输出为 `markdown`、`.md`、`Obsidian 笔记`；
- 希望你**补全中间步骤**、解释符号、理清假设与公式之间的关系；
- 希望省略漫长证明，但保留推导主线；

就使用本 skill。

## 输入

- 论文 PDF、论文标题、正文摘录，或与推导相关的具体章节
- 可选：用户指定的目标主线，例如：
  - 「从 Eq.(3) 推到 Eq.(7)」
  - 「把 ELBO 的推导单独整理出来」
  - 「重点解释 Jacobian 线性化那段」

## 输出

- **单个 Obsidian Markdown 文件**
- 默认文件名建议：`[year]_[short_title]_derivation.md`
- 默认保存位置建议：`30_Reading/Derivations/`
- 若用户已给出明确文件名或目录，优先服从用户要求

## Frontmatter 规范

笔记开头添加 frontmatter，至少包含：

```yaml
---
title: 论文推导笔记标题
aliases:
  - 论文全名
tags:
  - paper
  - derivation
  - math
date: YYYY-MM-DD
---
```

如果能可靠确定作者、年份、doi、citekey，也可以加入；不确定就不要编造。

## 笔记结构

按下面结构组织内容。可以根据论文复杂度微调，但不要缺核心部分。

### 1. 标题与出处

- 论文标题、作者、年份
- 原文附件或链接
- 用一个 `info` callout 简短说明：这是“推导整理版”，不是逐字翻译

推荐写法：

```markdown
> [!info]
> 论文：*Paper Title*
>
> 目标：整理核心推导链，补全中间步骤，统一符号说明。
>
> 原文：![[paper.pdf]]
```

### 2. 一句话总结

用 2 到 4 句说明：

- 这段推导想解决什么问题
- 最终推到了什么形式
- 最关键的技巧是什么（如变分下界、泰勒展开、对角化、换元、矩阵微积分）

### 3. 符号表（Notation）

必须集中整理所有关键符号，尤其：

- 下标、上标、时间索引、样本索引、层索引
- 粗体向量 / 矩阵 / 标量的区别
- 同一符号在不同语境下是否含义不同

推荐写成表格：

```markdown
| 符号 | 含义 |
| --- | --- |
| $z_t$ | 时刻 $t$ 的潜变量 |
| $x_i$ | 第 $i$ 个观测维度 |
| $A_t$ | 时刻 $t$ 的局部线性动力学矩阵 |
```

### 4. 基础假设（Assumptions）

用条目列出推导依赖的前提，例如：

- 可微性
- 小扰动 / 一阶近似
- 条件独立
- 高斯噪声
- 低秩约束
- 连续时间到离散时间的 Euler 近似

每条尽量对应到文中的公式或段落，不要写空泛假设。

### 5. 推导主线

这是主体。按**逻辑块**分成多个 section，而不是机械地每一行公式都拆成独立步骤。

每个 section 建议包含：

#### 本节目标

- 从哪一个式子出发
- 使用什么条件或变换
- 想得到什么结论

#### 连续推导

- 公式之间用自然语言衔接，比如“代入得”“两边取期望”“整理二次项后得到”
- 若论文跳步明显，在对应位置插入：`补充：...`
- 对真正关键的中间步骤，要明确写出来，不要只说“容易得到”

#### 本节结论

- 用 1 到 3 句话总结这一段推导得到了什么
- 若下一节依赖本节结果，明确写出连接关系

### 6. 省略的证明

对冗长但不影响主线的证明：

- 只写**结论**
- 标明“证明见 Appendix / Supplementary / Theorem X”
- 不要把整段大证明搬过来稀释主线

### 7. 公式逻辑总览

最后用简短条目总结整条链：

- 起点是什么
- 中间做了哪些关键变换
- 最终得到什么形式
- 这个形式为什么对方法有意义

## 数学与 Obsidian 格式规范

### 数学公式

- 行内公式使用 `$...$`
- 独立公式使用 `$$...$$`
- 不要把数学对象写在反引号里，例如不要写 `` `x_t` ``，应写 `$x_t$`
- 保持与原文一致的记号，例如 `\dot{z}`、`\mathbf{x}`、`\Sigma^{-1}`

### Markdown 结构

- 使用标准标题层级：`#` `##` `###`
- 优先使用表格、普通列表、callout
- 不使用原始 HTML section/div 排版
- 若需要内部关联概念，使用 wikilink，例如 `[[Koopman Operator]]`

### Callout 使用建议

- `info`：论文信息、任务说明
- `note`：推导提醒
- `warning`：容易混淆的符号、常见误解
- `abstract`：章节小结

## 推导整理原则

1. **逻辑优先**：目标是让读者顺着公式链读懂，不是把每一行都翻译成中文。
2. **补全跳步**：原文略去的代数整理、换元、泰勒展开、矩阵恒等式，要在必要处补出来。
3. **符号统一**：整篇笔记中同一符号只保留一种写法；首次出现时解释清楚。
4. **证明从简**：长证明保留结论与出处，不抢主体篇幅。
5. **解释为什么**：不仅写“怎么变形”，还要写“为什么要这样变形”。
6. **不编造**：如果原文没有给出足够信息，要明确标注“这里是根据上下文补出的合理中间步骤”。

## 推荐工作流

1. 通读目标论文中与推导相关的正文、附录、补充材料。
2. 先列符号表，再列假设，再决定推导 section 的划分。
3. 先写主线，再补关键中间步骤。
4. 长证明压缩成结论，避免笔记失焦。
5. 最后统一检查：
   - 数学符号是否符合 Obsidian/MathJax 规范
   - 是否误用了反引号包数学变量
   - 是否已经写清每个下标的含义
   - 文件是否是标准 `.md`

## 输出模板

```markdown
---
title: [Year] Short Title Derivation
aliases:
  - Full Paper Title
tags:
  - paper
  - derivation
  - math
date: YYYY-MM-DD
---

# [论文标题] 推导笔记

> [!info]
> 论文：*Full Paper Title*
>
> 目标：整理核心数学推导，补全关键跳步，统一符号定义。
>
> 原文：![[paper.pdf]]

## 一句话总结

...

## 符号表

| 符号 | 含义 |
| --- | --- |
| $z_t$ | ... |

## 基础假设

- ...

## 推导主线

### 1. 从 ... 到 ...

#### 本节目标

...

#### 连续推导

$$
...
$$

补充：...

$$
...
$$

#### 本节结论

...

## 省略的证明

- ...

## 公式逻辑总览

- ...
```

## 最后检查

交付前确认：

- 文件是 Markdown，不是 HTML
- 数学公式都能被 Obsidian 正常渲染
- 关键符号，尤其下标，都已解释
- 推导主线连续、可读
- 若保存到 vault，路径和文件名符合用户约定

使用本 skill 时，默认输出一篇**适合 Obsidian 长期积累的数学推导笔记**：结构清楚、公式规范、逻辑连续、便于后续双链整理。
