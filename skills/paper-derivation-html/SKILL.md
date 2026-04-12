---
name: paper-derivation-html
description: Extracts and reconstructs key derivation steps from model-oriented papers into a step-by-step HTML document with correct LaTeX math. Use when the user wants to understand a paper's derivation flow, fill in logical gaps, define all notation (especially subscripts), and omit lengthy proofs while keeping formula logic. Triggers on requests for "推导", "derivation", "公式推导", "math derivation", or learning model derivations from a paper.
---

# Paper Derivation HTML

将论文中的**关键推导步骤**梳理成「条件 → 结论」的逐步推导，输出为**自包含 HTML**，公式用 **LaTeX** 正确渲染，便于精读模型类论文的推导逻辑。

## 何时使用

当用户：
- 提供一篇**模型/方法向**论文（PDF 或主要公式段落），希望**理清推导流程**；
- 需要**一步一步**看清：每步条件是什么、下一步得到什么、基础假设是什么；
- 希望**补全论文中的跳步**，并**统一定义数学符号**（尤其下标）；
- 希望**略过冗长定理证明**、只保留结论，但**突出公式之间的逻辑链**；

就使用本 skill。

## 输入

- 论文来源：PDF 路径、或粘贴的正文/附录中与推导相关的段落
- （可选）用户指定的推导主线，例如：「从 Eq.(3) 到 Eq.(5)」「残差动力学的线性近似」

## 输出

- **单个自包含 HTML 文件**，内嵌 CSS 与 LaTeX 渲染（建议用 KaTeX 或 MathJax CDN，或内联配置）
- 文件名建议：`[year]_[short_title]_derivation.html`
- 存放位置：与项目约定一致（默认优先 `30_Reading/Derivations/`，或用户指定）

## 文档结构（必须包含）

1. **标题与出处**  
   论文标题、作者、年份、DOI/链接；本页说明「推导梳理，非逐字翻译」。

2. **符号表（Notation）**  
   - 所有出现的**数学符号**集中列出，含**下标/上标含义**。
   - 格式示例：\(z_t\)：\(t\) 为时间索引；\(F(z)\)：\(z\) 为状态向量；\(\epsilon_t\)：试次内噪声。
   - 若同一符号在多处有不同含义，分条注明「在 X 节指……」

3. **基础假设（Assumptions）**  
   - 推导所依赖的**前提**：例如「输入为简单输入」「观测噪声高斯独立」「线性时变近似」等。
   - 每条用一句话 + 必要时对应公式编号。

4. **推导主线（按 section 组织，连续推导）**  
   - **按逻辑块划分为多个 section**（例如「从状态方程到离散残余」「潜在变量与估计」「时间常数与频率」等），每个 section 对应一段相对完整的推导链。
   - **每个 section 开头**：用一小段集中说明**本节条件与基础想法**（依赖的假设、从哪一步出发、要得到什么），便于读者进入状态；不要在每个公式前重复「条件 / 推理 / 结论」。
   - **每个 section 主体**：**连续公式推导**——用公式与简短衔接语（如「代入得」「由上式」「因此」）串联，保持阅读流畅；公式可带编号（与论文对应），中间用自然段或一两句说明过渡。
   - 若论文存在**明显跳步**，在相应位置插入一句「**补充**：……」或一小段中间步骤，然后继续推导，不打断整体连贯性。

5. **省略的证明**  
   - 若某结论来自长证明，并且与逻辑主线没有关系，只写「**结论**：……（Eq. X）」，并一句说明「证明见原文 Appendix X」或「由 Y 定理可得」，不展开证明过程。

6. **公式逻辑小结（可选）**  
   - 用简短条目或小图（如 Mermaid/文字流程图）概括：从假设到最终形式的主线（例如「状态方程 → 离散化 → 残余定义 → 线性近似 → 得到 A_t」）。

## 公式与 LaTeX 规范

- **一律使用 LaTeX** 书写公式，在 HTML 中通过 KaTeX/MathJax 渲染。
- 行内公式：`\( ... \)` 或 `$ ... $`（依所选引擎）；独立公式：`\[ ... \]` 或 `$$ ... $$`，并带编号（如 `(1)`）。
- **下标/上标**：在符号表中必须解释清楚（例如 \(x_i\) 中 \(i\) 为神经元索引，\(t\) 为时间）。
- 与论文一致：若论文用 \(\dot{z}\)，HTML 中同样用 `\dot{z}`；若用 \(\mathbf{z}\)，保留粗体。

## 推导梳理原则

1. **按 section 组织，section 内连续推导**：每个 section 开头交代条件与思路，随后是连贯的公式链，需要的话加入自然语言进行连贯，以保证阅读流畅。
2. **Section 开头集中交代**：本节依赖的假设、从哪一步/哪一式出发、本段推导要得到什么结论，写在一段内即可。
3. **补全跳步**：若论文从 Eq.(3) 直接跳到 Eq.(5)，在相应位置补一两行中间式或一句「补充：……」，再继续公式流。
4. **符号一致且可查**：全文符号与符号表一致；新符号首次出现时可简短提醒「见符号表」。
5. **证明从简**：定理/引理的证明只保留「结论 + 出处」，不展开推导细节。
6. **逻辑优先**：目标是「公式的逻辑链」清晰、可连续阅读，而不是把每一步都拆成固定三块。

## HTML 与排版

- 自包含：所需 CSS 内联或内嵌；若用 KaTeX/MathJax，可用 CDN 链接（常见即可）。
- 结构清晰：用 `<section>` 或 `<h2>` 区分「符号表」「假设」、各**推导 section**、「省略证明」「小结」。
- 每个推导 section：开头用一段（如 `<p class="section-intro">`）写本节条件与思路；主体用段落 + 公式连续排列（可用 `<div class="derivation-block">` 包住整段推导），不必每式一个 step 框。
- 移动端可读：字体与公式大小适中，避免公式溢出。

## 工作流建议

1. **通读**论文中与目标推导相关的章节与附录，标出主要等式与假设。
2. **列出**所有涉及符号，建符号表（含下标）。
3. **按逻辑块划分 section**（如：状态方程→离散化→残余→线性化→\(A_t\)；潜在变量与估计；时间常数/频率等）。
4. **每个 section**：先写开头段（条件 + 本节要得到的结论），再写连续推导（公式 + 简短衔接语），跳步处用「补充」一句带过。
5. **将长证明**替换为「结论 + 出处」。
6. **生成 HTML**：套入上述结构，公式用 LaTeX，用 KaTeX/MathJax 渲染。
7. **检查**：符号表是否覆盖全文、各 section 内推导是否连贯、LaTeX 是否无误。

## 示例片段（结构）

```html
<section id="derivation">
  <h2>推导</h2>

  <h3>3.1 从状态方程到离散残余动力学</h3>
  <p class="section-intro"><strong>条件与思路</strong>：设状态满足论文 Eq.1 \(\dot{z}_t = F(z_t) + u_t + \epsilon_t\)，且为简单输入（\(u_t\) 不随试次变化）。对单试次与条件平均分别离散化后相减定义残余 \(\tilde{z}_t = z_t - \langle z_t \rangle\)，则 \(u_t\) 在相减时消去；再在 \(\langle z_t \rangle\) 处对 \(F\) 一阶展开，即得离散时间线性残余动力学 \(A_t = I + \Delta t J_t\)。</p>
  <div class="derivation-block">
    <p>单试次与条件平均的离散更新（Euler 步长 \(\Delta t\)）为（论文 Eq.4–5）：</p>
    <p>\[ \langle z_{t+1} \rangle = \langle z_t \rangle + \Delta t (F(\langle z_t \rangle) + u_t), \quad z_{t+1}^k = z_t^k + \Delta t (F(z_t^k) + u_t + \epsilon_t). \]</p>
    <p>定义 \(\tilde{z}_t^k = z_t^k - \langle z_t \rangle\)，两式相减后 \(u_t\) 项抵消，得到</p>
    <p>\[ \tilde{z}_{t+1}^k = \tilde{z}_t^k + \Delta t \bigl( F(z_t^k) - F(\langle z_t \rangle) + \epsilon_t \bigr). \]</p>
    <p>在 \(\langle z_t \rangle\) 处一阶展开 \(F(z_t^k) = F(\langle z_t \rangle + \tilde{z}_t^k) \approx F(\langle z_t \rangle) + J_t \tilde{z}_t^k\)（\(J_t = \nabla F|_{\langle z_t \rangle}\)），代入得</p>
    <p>\[ \tilde{z}_{t+1} = (I + \Delta t J_t) \tilde{z}_t + \Delta t \epsilon_t = A_t \tilde{z}_t + \Delta t \epsilon_t, \qquad A_t = I + \Delta t J_t. \]</p>
    <p><strong>补充</strong>：论文未显式写「相减消去 \(u_t\)」；在简单输入下因 \(u_t\) 与试次无关，故不进入残余方程，\(A_t\) 只含 \(F\) 的 Jacobian。</p>
  </div>

  <h3>3.2 潜在变量形式与估计</h3>
  <p class="section-intro"><strong>条件与思路</strong>：观测为高维或跨实验对齐后的残余；假设存在低维潜在状态 \(x_t\) 服从同一动力学 \(A_t\)，观测为 \(C x_t + \eta_t\)。本节给出 Eq.11 形式及估计思路，具体 SSID/2SLS 见附录。</p>
  <div class="derivation-block">
    <p>设 \(x_{t+1} = A_t x_t + \epsilon_t\)，\(\tilde{z}_t = C x_t + \eta_t\)（论文 Eq.11）。\(A_t\) 与动力学子空间由 SSID + 工具变量回归估计，证明见 Supplementary Math Note A。</p>
  </div>
</section>
```

使用本 skill 时，以「公式逻辑链」为核心，**按 section 组织、section 内连续推导**：每 section 开头交代条件与思路，主体为连贯的公式与衔接语，补全跳步、统一符号、省略冗长证明，并输出正确 LaTeX 的 HTML。
