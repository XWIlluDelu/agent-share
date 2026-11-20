# Philosophy

## One shared knowledge base, tailored perspectives

Humans and agents work from a single coherent project knowledge base rather than separate human documentation and agent-only memory. Split memory guarantees drift; one shared corpus ensures that changes in human intent immediately govern agent work and agent discoveries remain visible to humans.

One knowledge base still serves two distinct reading needs. Human attention is scarce, so humans need selective, high-signal views—project intent, system structure, unresolved tradeoffs, and visual or summary overviews—where small, thoughtful edits steer the whole project without requiring immersion in routine detail, while preserving direct drill-down when needed. Agents need complete, reliable access across the entire library so a fresh session can reconstruct full context and continue work without depending on prior conversation history.

## Coherent coverage without brittle duplication

The library should cover the full set of knowledge a project depends on—intent, design obligations, active execution state, verification evidence, and reusable technical knowledge—with clear ownership and minimal internal contradiction.

Give each detailed fact one authoritative home and link to it elsewhere rather than maintaining independent copies that drift out of sync. Distinguish **useful hierarchical summaries** from **duplicate maintenance**: higher-level narrative, area synthesis, and generated overviews earn their place by clarifying the whole and pointing to detail, whereas mirroring leaf facts across multiple documents creates fragility without insight.

## Human steering, agent maintenance

DocDoki is **human-steered and agent-maintained**. Humans supply direction, architectural judgment, and consequential tradeoffs; agents perform most of the writing, organization, cross-document propagation, implementation, and ongoing maintenance.

Separate **human steering** from **routine approval**. Maintenance and execution within authorized scope proceed autonomously without per-edit permission gates. Reserve human attention for open questions, conflicting constraints, and tentative design proposals—surfaced clearly as steering choices rather than buried in prose or silently decided on the human's behalf.

## Decided contracts, current reality, and evidence

Keep three things distinct: **what is decided**, **what currently exists**, and **what checks establish**.

A decided requirement remains binding when implementation is absent or defective. Contracts define the target; active work tracking records current gaps and next steps; code and tests supply conformance evidence, never authority to weaken a goal. When design and implementation diverge, repair the side that is wrong once authority, evidence, and scope settle it—otherwise keep the discrepancy explicit.

## Durable knowledge over activity logs

Retain what changes a future decision or prevents costly re-derivation: intent, contracts, active gaps, verified evidence with its check scope, rationale, and rejected or untried options. Do not retain statements merely because an action happened at a given time.

Keep active state current in place and fold durable lessons into permanent homes before retiring finished work; version history is a recovery aid, not an organized knowledge base. When a project separates shared context from local-only context, shared knowledge must remain coherent and continuable without hidden dependence on local-only material.

## Judgment over rigid ceremony

Trust capable agents to exercise semantic judgment in classification, synthesis, conflict resolution, scoping, and deciding what evidence a claim requires. Avoid defensive rules and rigid procedures where judgment suffices.

Use deterministic tooling only for mechanical invariants—structural validity, link integrity, lookup indexing, and visibility boundaries—that scripts can verify cheaply and reliably without constraining judgment.
