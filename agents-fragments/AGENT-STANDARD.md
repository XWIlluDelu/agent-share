# Scientific Research and Implementation Standard

## Research objective and judgment

Let the research objective—not procedural completeness—guide what you investigate, build, and retain. Move the work forward within the agreed scope: make ordinary technical decisions, pursue promising leads, and adapt as evidence develops. Treat your own hypotheses, diagnostics, thresholds, and plans as provisional tools, not requirements—revise or drop them when they no longer serve the objective. Stop and deliver the result once it is ready for its intended use, or when open-ended exploration reaches a sensible stopping point.

## Implementation

Implement the agreed mathematical method and make any departures explicit. For a new or changed mathematical core, check the computation against its definition for plausible errors—for example, with an analytic case, invariant, or trusted reference when available—scaled to the consequences of an error and the available evidence. Surface invalid numerical outputs and any corrections that change the result.

Prefer coherent, maintainable designs over accumulating local patches, special cases, or unnecessary abstractions. Put reusable logic in the module responsible for the behavior and keep one maintained implementation of shared algorithms; use scripts or notebooks for self-contained work. Keep effective settings easy to inspect, and note non-obvious math-to-code mappings, units, axes, and assumptions where they affect understanding. Judge existing behavior and test expectations against the intended method and requirements rather than assuming current behavior is right. Revisit tests and safeguards as assumptions change: keep what serves a current need and discard one-off checks after use.

## Experiments and interpretation

Give experiments a useful question or purpose, which may sharpen during exploration. Choose measurements and comparisons that fit that purpose. When claiming performance on unseen data, keep the final evaluation independent of tuning and model selection.

Report observations directly and label interpretations as such. Match the strength of conclusions to the design and evidence, and validate further when doing so would materially affect a conclusion or decision. Explain selection decisions that affect interpretation and what any reported uncertainty represents.

## Results and reproducibility

Present substantive analyses in readable Markdown or Jupyter notebooks so the purpose, approach, and main results are clear without reading the code. Use figures or tables where helpful, and note limitations that affect interpretation or use. Keep the write-up concise and scientifically focused, omitting routine details and unprompted disclaimers about non-issues.

Aim for semantic reproducibility—so a researcher can understand what was done and rerun the main analysis at reasonable cost—rather than byte-for-byte replay. Use existing notes, code, and configuration to keep inputs, entry points, and consequential settings easy to find; clarify inputs and execution order in notebooks meant to be rerun, and record seeds or environment details when they materially affect interpretation or rerunning.

Keep raw data intact, and preserve results that support conclusions or ongoing work—including the values behind key figures and comparisons when regeneration is costly. Update or overwrite ordinary working files in place rather than creating versioned or suffixed copies, and clear obsolete runs, caches, and outputs when no longer needed.

## Model training

For major training runs, use a shared trainer that monitors progress and relevant metrics, saves checkpoints, and restores the state needed to resume training coherently, including optimizer and model-selection state where applicable. When selecting a model, retain it along with its selection metric and training step, and keep it distinct from the resumption checkpoint when they differ. A short, self-contained fit can use a simple loop.
