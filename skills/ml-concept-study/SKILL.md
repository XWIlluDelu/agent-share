---
name: ml-concept-study
description: 'Learn a machine learning or computational neuroscience concept/method deeply and turn it into an Obsidian-compatible study note. Use whenever the user wants to understand a new concept: ML/AI models (VAE, Transformer, diffusion, RL), neuroscience methods (latent variable models, state-space models, dimensionality reduction, population coding, LFADS, GPFA, attractor dynamics), or math tools (variational inference, optimal transport, information geometry). Triggers on requests for intuition plus mathematical derivation, variants, classic papers, code, or when user asks to "整理成 Obsidian 笔记", "derive from first principles", "深入理解这个方法", or "建立双链知识结构". Also use proactively when the user wants concept learning rather than just a quick answer.'
---

# Concept Study Skill

Create a deep-learning note for one ML or computational neuroscience concept or method, moving from intuition to derivation to variants to literature to code, and save it as Obsidian-friendly Markdown.

The goal is not just to explain. The goal is to help the user study and revisit the concept later inside their vault.

## When to use

Use this skill when the user wants any of the following:

- a structured introduction to an ML concept or method
- detailed mathematical derivations, especially from first principles
- a map of variants or extensions
- classic / foundational / high-impact papers
- practical code examples or implementation guidance
- an Obsidian note with wikilinks and reusable knowledge structure

Common triggers:

- "学习一个新的机器学习概念"
- "详细推导这个方法"
- "从 likelihood 到 ELBO 推导"
- "给我这个模型的变种"
- "整理成 obsidian markdown"
- "建立双链"

## Default output target in this vault

Prefer storing notes under `20_Research/Concepts/`. Choose the subfolder by topic:

**ML / AI methods:**
- `20_Research/Concepts/generative-models/` — VAE, diffusion, flow models
- `20_Research/Concepts/probabilistic-inference/` — variational inference, ELBO, MCMC, Bayesian methods
- `20_Research/Concepts/representation-learning/` — embeddings, disentanglement, contrastive learning
- `20_Research/Concepts/architectures/` — Transformer, attention, RNN, SSM
- `20_Research/Concepts/optimization/` — training dynamics, loss landscapes

**Computational neuroscience methods:**
- `20_Research/Concepts/neural-data-analysis/` — GPFA, LFADS, state-space models, spike sorting, decoding
- `20_Research/Concepts/neural-dynamics/` — attractor networks, fixed points, low-rank RNN theory, mean-field
- `20_Research/Concepts/neural-coding/` — population coding, information theory, efficient coding, representational geometry
- `20_Research/Concepts/cognitive-models/` — drift-diffusion, normative models, Bayesian brain, RL in cognition

**Math tools:**
- `20_Research/Concepts/math-tools/` — optimal transport, information geometry, tensor decomposition, kernel methods

Examples:
- VAE → `20_Research/Concepts/generative-models/VAE.md`
- LFADS → `20_Research/Concepts/neural-data-analysis/LFADS.md`
- low-rank RNN theory → `20_Research/Concepts/neural-dynamics/LowRankRNN.md`
- GPFA → `20_Research/Concepts/neural-data-analysis/GPFA.md`

If a concept spans categories, pick the primary one and add wikilinks to siblings.

## Output requirements

Always produce Obsidian-compatible Markdown.

### Math formatting

- Use `$$ ... $$` for all block equations.
- Use `$...$` for inline equations only when needed.
- Prefer complete multi-line derivations with short explanations between equations.
- Define every symbol before or immediately after first use.

### Obsidian structure

- Add YAML frontmatter.
- Use wikilinks for internal concepts whenever a natural related note exists or should exist.
- Add a section called `## 双链知识` with both outgoing links and suggested backlinks.
- Add `## 相关概念` and `## 延伸阅读` sections.

### Tone and depth

- Start intuitive, then become formal.
- Do not stop at high-level summaries if the user asked to learn deeply.
- For derivations, show the bridge between each step instead of skipping with "it can be shown".
- Flag assumptions clearly.
- Separate exact derivation, approximation, and intuition.

## Required note structure

Full reusable template lives at `references/NOTE_TEMPLATE.md` — copy from there when starting a new note. The condensed form below is for quick reference only.

Unless the user requests a different format, use this structure:

```markdown
---
title: <concept title>
aliases:
  - <common alias 1>
tags:
  - machine-learning
  - concept-note
  - <domain tag>
created: <YYYY-MM-DD>
status: evergreen
---

# <Concept Name>

## 一句话概览

## 它是什么、面向什么、能做什么

## 核心直觉

## 形式化定义

## 数学推导

## 关键结论与公式总结

## 变种与扩展

## 经典文献

## 实际使用与代码

## 常见误区 / 局限

## 相关概念

## 双链知识

## 延伸阅读
```

## Workflow

### 1. Identify the learning target

First identify:

- concept / method name
- user depth target: overview, derivation, literature, code, or full package
- whether the user named a specific derivation starting point (for example, "从 likelihood 和 ELBO 的关系开始")

If the user did not specify depth, default to the full package: intuition + derivation + variants + papers + code.

### 2. Build the conceptual overview first

Start with three things:

1. What it is
2. What problem it addresses
3. What capabilities it provides in practice

This section should be short, high-signal, and understandable without equations.

Good example for VAE-style framing:

- What: a latent-variable generative model with amortized variational inference
- Problem: exact posterior inference is intractable
- Capability: representation learning, generation, conditional generation, semi-supervised learning, etc.

### 3. Do the math in a teaching order

When the user wants derivation, organize the math in the order a learner can follow.

Recommended derivation ladder:

1. state the probabilistic objective
2. define the obstacle (usually an intractable integral / posterior / partition function)
3. introduce the auxiliary distribution or approximation
4. derive the bound / surrogate objective step by step
5. interpret each term
6. connect the final training objective to implementation

For VAE specifically, the preferred derivation order is:

1. generative story: $$p_\theta(x, z) = p_\theta(x \mid z)p(z)$$
2. marginal likelihood objective: $$\log p_\theta(x) = \log \int p_\theta(x, z) \, dz$$
3. explain why exact posterior $$p_\theta(z \mid x)$$ is hard
4. introduce $$q_\phi(z \mid x)$$
5. derive ELBO from likelihood by multiplying and dividing by $$q_\phi(z \mid x)$$
6. rewrite as reconstruction term minus KL term
7. explain tightness: $$\log p_\theta(x) = \mathrm{ELBO}(x) + D_{\mathrm{KL}}(q_\phi(z \mid x) \Vert p_\theta(z \mid x))$$
8. derive reparameterization trick when relevant
9. map each mathematical term to encoder / decoder / loss implementation

Whenever possible, include both:

- the clean derivation
- a learner-facing interpretation of what changed in each step

### 4. Cover variants systematically

Do not dump a long list of variants. Organize them by what they change.

Use a table or bullet grouping such as:

- objective modified
- prior modified
- posterior family modified
- conditioning added
- disentanglement emphasized
- sequence / graph / multimodal setting

For each variant, include:

- name
- one-line idea
- what changed relative to the base method
- when to use it

For VAE, likely variants include:

- [[CVAE]]
- [[Beta-VAE]]
- [[IWAE]]
- [[VQ-VAE]]
- hierarchical VAE
- sequential VAE

### 5. Curate classic literature

Always give a small, opinionated reading ladder instead of a huge bibliography.

Split into:

- foundational papers
- important variants
- practical / tutorial / survey references

For each paper, include:

- citation
- why it matters in one sentence
- what to read it for

Prioritize canonical, widely recognized references over obscure ones.

### 6. Add practical code

If the user asked for code or if code would materially help, include a minimal but real example.

Good defaults:

- PyTorch first
- concise and runnable over overly abstract
- include only the core training logic unless the user asked for a full project

Code section should connect to the math:

- where the reconstruction term is computed
- where the KL term is computed
- where any reparameterization occurs

### 7. Build Obsidian links intentionally

The note should not be isolated.

At minimum, link to:

- parent concepts
- sibling concepts
- downstream applications
- prerequisite math

Examples:

- VAE should naturally link to [[变分推断]], [[KL散度]], [[最大似然估计]], [[重参数化技巧]], [[CVAE]], [[生成模型]]
- Transformer should link to [[自注意力]], [[位置编码]], [[序列建模]], [[多头注意力]], [[预训练]]

If a linked note may not exist yet, still suggest the wikilink inside a dedicated section like:

```markdown
## 双链知识

### 出链
- [[变分推断]]：VAE 的推断基础
- [[KL散度]]：ELBO 中的正则项

### 建议回链
- 可在 [[生成模型]] 中链接回本笔记
- 可在 [[摊还推断]] 中链接回本笔记
```

## Quality bar

The note is good only if it satisfies all of the following:

- a newcomer can answer "这是什么、解决什么问题、为什么重要"
- a mathematically oriented reader can follow the derivation line by line
- a practitioner can see how the formulas map to code
- a reader can continue outward through variants and literature
- the note can live inside Obsidian as part of a connected knowledge graph

## Suggested frontmatter defaults

Use something close to this:

```yaml
---
title: VAE 变分自编码器
aliases:
  - Variational Autoencoder
  - VAE
tags:
  - machine-learning
  - generative-model
  - variational-inference
created: 2026-03-13
status: evergreen
---
```

## Deliverable checklist

Before finishing, verify that the note includes:

- overview and intuition
- formal setup
- explicit derivation with no major skipped steps
- variants grouped by modification type
- canonical papers with reading purpose
- at least one practical example or code snippet if useful
- Obsidian wikilinks and a dedicated double-link section
- a sensible save path under `20_Research/Concepts/` (see subfolder taxonomy above)
