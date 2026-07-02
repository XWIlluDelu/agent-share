# Prior art: how others implement docdoki's three targets

> **Archived design-phase reference — frozen 2026-06-24.** A cold backup, not a maintained
> document; the shipped design is in `SKILL.md` + `references/`, where the "open design
> choices" below are now settled. Corrected where it assumed a `verified` per-claim
> baseline — the final design dropped that: `challenge` re-reads the code under a spec's
> `covers` and treats `git diff` only as a suspicion signal, storing no per-claim state.

Design input for the later B/C work. It does not touch the active skill (`SKILL.md`
+ `references/`). Survey of open-source skills, agent-memory systems, and
documentation systems against our three implementation targets.

This report consolidates two passes: a direct single-agent survey and a multi-agent
run (five advisers, archived under `archive/chaos-run/` with its frame, claim ledger,
and per-adviser positions). Every mechanism cited below was re-verified against a
primary source; where the multi-agent run surfaced a system I did not independently
verify, it is flagged as such rather than asserted.

- **A — layered human+agent store** (user points 1+2)
- **B — information flow / grooming**: forget low-value, promote detail into
  structure when quantity becomes quality (user point 3) — the hard one
- **C — anti-rot / doc↔code alignment** (user point 4) — the hard one

Three filters judge every borrowed idea; they are our decisions, not research
questions: **semantic over deterministic-script**, **high autonomy** (frequent human
intervention = defect), **prompt-first** (procedures in prompts, scripts few/none).
A fourth, **minimalist**, emerged from the run and is worth keeping explicit: a
mechanism survives only if expressible as markdown + agent prompts + standard file
tools (read/write/grep/diff/git) — no external DB, vector store, graph backend, CLI
binary, or browser as a dependency. Anything heavier must reduce to a transferable
principle.

Vocabulary from the memory-systems survey [S1]: six atomic operations —
consolidation, indexing, updating, forgetting, retrieval, compression — over a
lifecycle of Formation (extraction) → Evolution (consolidation & forgetting) →
Retrieval. Our B is "Evolution"; our C is "updating + forgetting" driven by code.

## Target A — layered store

| Project | Mechanism | Trigger | Semantic vs scripted | Autonomy | History | Adaptable? |
|---|---|---|---|---|---|---|
| Cline Memory Bank [A1] | fixed file hierarchy: `projectBrief` → context tracks → `activeContext` → `progress`; thin top, detail below | human says "update memory bank" → review every file | LLM writes; structure fixed | partial — update is **human-triggered**, the weak point | git/markdown | yes — our layout already mirrors it; ride-along grooming fixes the manual-trigger weakness |
| AGENTS.md + Skills progressive disclosure [A2][A3] | filesystem hierarchy; read name+description, load body on relevance, load detail on demand; concatenate root→specific | relevance / on-demand | agent decides what to load | high | files | yes — this **is** `SKILL.md` + `references/` + on-demand `specs`/`notes` |
| Claude Code memory [A4] | human `CLAUDE.md` (re-injected after compaction) + agent-written `MEMORY.md` (bounded load) + topic files read on demand | session start; agent "remember" | semantic agent writes; scripted load order | high for agent layer | git | yes — the cleanest human-top / agent-bottom split |
| Letta Code MemFS [A5] | git-backed markdown the agent edits with bash tools; `system/` files always loaded, other files visible by name+description only (content on demand) | agent tool calls; `system/` auto-loads | semantic (agent edits) | high | full git history | yes (mechanism) — `system/` vs name-only is a clean always-visible-top / paged-detail split; the Letta product itself is out of scope |
| Anthropic Managed Agents memory [A6] | path-addressed text docs mounted as a directory the agent reads/writes with file tools; per-mount note injected into system prompt; `read_only` vs `read_write` | agent file ops; store attached at session start | semantic agent use; scripted access control | high | **immutable versions per write** (see C) | yes (mechanism) — first-party precedent for a file store the agent treats as filesystem; small-focused-files guidance matches our budgets |
| Diátaxis [A7] | one document, one user-need; tutorial/how-to/reference/explanation never mix | authoring discipline | authorial principle | n/a | n/a | partial — "never mix concerns" is what keeps our top layer thin; our intent/contract/evidence split is the same idea by ownership |

**Adaptable patterns.** A is settled and corroborated from several independent
directions: a fixed, shallow top layer with detail paged below (Cline, Letta
`system/`), loaded on demand (progressive disclosure, Letta name-only files), each
file one purpose (Diátaxis), human-top / agent-bottom ownership (Claude Code). Our
layout already embodies all of these.

**Filter failures.** Cline's only real weakness is the **human-issued "update memory
bank"** trigger — it makes maintenance a human chore. The field's instruction-file
systems (AGENTS.md, Copilot, Cursor `alwaysApply`/glob) are human-authored control
planes: strong for A's shape, weak for autonomy, so borrow their layout, not their
maintenance model.

**Open design choices.** Minimal. Hold one rule: never reintroduce a human-issued
"refresh the docs" command as the primary maintenance trigger.

## Target B — information flow / grooming (hard)

| Project | Mechanism | Trigger | Semantic vs scripted | Autonomy | History | Adaptable? |
|---|---|---|---|---|---|---|
| Generative Agents [B1] | importance score per memory; **reflection** synthesizes accumulated low-level memories into higher-level nodes, stored back (and reflectable again) | summed importance of recent memories crosses a threshold → reflect | LLM scores + synthesizes; trigger is numeric | full | reflections added; originals kept | **yes — the literal 量变质变**: accumulation past a point triggers synthesis into structure. Adapt the shape; the numeric threshold should be a hint, not a verdict |
| Mem0 [B2][B3] | extract candidates → LLM tool-call picks **ADD / UPDATE / DELETE / NOOP** against the top-k similar existing memories | every new exchange (ride-along) | fully LLM for the four-op decision | full — no human | DB (we have git) | yes — clean grooming verb-set; DELETE-on-conflict = forgetting, UPDATE = consolidation. **Caveat:** Mem0's *conflict* handling leans deterministic and its own issue #4926 shows similarity-ranked retrieval can drop persistent/policy memory — so adopt the four-verb decision, not a recency rule for conflicts |
| Merken [B4] | four primitives **`should_remember / should_recall / should_consolidate / should_forget`**, each a pluggable decider; every decision logged to an audit collection; forgotten items kept in a tombstone collection for "unforgetting" | agent calls each primitive | deciders default **heuristic**, swappable to LLM | high — agent decides when to call | audit row per decision + tombstone preserves content | yes (design) — the four-verb surface + audit + tombstone is the cleanest "forgetting with auditability." Default deciders are heuristic (an LLM decider is not confirmed shipped); we'd supply our own judgment as prompt |
| A-MEM [B5] | Zettelkasten notes; LLM **link generation** between new and prior notes; **memory evolution** — a new note revises linked old notes' attributes | on new note | fully LLM | high — the only agent-autonomous grooming in the survey | notes | yes — promotion-by-linking and note-revision is exactly `notes` consolidation; supports the `[[link]]` habit. Cost risk: per-insert LLM analysis at scale |
| Letta MemFS [A5] | `/doctor` audits memory layout and refines placement/token-efficiency; sleep-time "dream" subagents reflect on recent work in the background | `/doctor` (on demand); dream every N steps | semantic | partial — `/doctor` human-invoked, edits autonomous | git | yes — `/doctor` is a precedent for an explicit `groom` codename; dreaming is a background-reflection precedent (its step-count trigger is the weak part) |
| Anthropic Managed Agents [A6] | **dreaming** consolidates fragmented memories into a *new* output store (original untouched); best practice is condense/prune before the cap | capacity pressure / scheduled | semantic | partial | immutable versions | yes — "consolidate into a fresh artifact, then switch over" is a safe consolidation shape; versions give the audit |
| Zep / Graphiti [B6] | bi-temporal graph; contradictions **invalidate, not delete** (set `t_invalid`); current + historical both queryable | a contradicting fact ingested | LLM extraction + temporal logic | partial — engine-decided, not agent | preserved via validity intervals | partial/conceptual — **answers B's hardest sub-question** (forget-as-if-always-so vs auditable history: keep both). Our equivalent is git; the graph backend is out of scope |

**Adaptable patterns.**
- Promotion = synthesis on accumulation (Generative Agents). When low-level detail
  piles up, the agent writes a higher-level summary and the detail recedes beneath it.
- A small, explicit verb-set for a grooming pass — Mem0's ADD/UPDATE/DELETE/NOOP and
  Merken's remember/recall/consolidate/forget converge on the same surface. Maps to
  our route / polish / forget / promote.
- "Forget as if it was always so" reconciles with auditability by **separating
  current truth from historical trace**: Graphiti uses validity intervals, Merken a
  tombstone collection, Anthropic immutable versions — we use git (clean working tree
  + retained history). `philosophy.md` already asserts this; the prior art confirms it
  is the standard answer.
- Forgetting is a first-class operation, not an accident (Mem0 DELETE, Merken forget,
  survey "forgetting").
- Consolidate into a new artifact rather than mutating in place when the change is
  large (Anthropic dreaming), so the decision stays auditable before the original recedes.

**Filter failures.** Most systems lean on a vector DB for the "similar existing
memory" retrieval that drives UPDATE/DELETE — for us that retrieval is the agent
reading the relevant doc, not an embedding lookup; import the decision, not the
machinery. Deterministic conflict rules ("latest truth wins", Mem0) fail the semantic
filter: mem0 issue #4926 is itself the evidence. Scheduled/cron consolidation (cycle
timers) and harness auto-compaction fail the autonomy filter as a *model*, though the
underlying reflection step is sound.

**Open design choices** (the real output for the next design step):
1. **Buffer or inline.** Mem0 grooms inline per exchange; Generative Agents accumulate
   then reflect; the earlier docdoki had a `chores` buffer before the garden. Decide whether the library
   keeps a low-value landing zone or grooms in place.
2. **Promotion trigger.** Numeric threshold (Gen Agents) vs per-event LLM judgment
   (Mem0) vs recurrence/linking (A-MEM). Our semantic filter favors LLM judgment; a
   cheap "accumulation noticed" heuristic can be the *suspicion* signal (as `challenge`
   uses git-diff to decide where to look), with the synthesis decision left to the agent.
3. **Cadence — the largest gap.** No surveyed system has *truly autonomous* grooming
   cadence: everything is human-triggered (Cline `update`, Letta `/doctor`),
   harness-triggered (auto-compaction), or pipeline-triggered (Mem0 async, Zep engine,
   cron cycles). A-MEM's per-insert evolution is the only agent-autonomous case, and it
   carries a cost risk. Candidate drives: ride-along with `follow`/`challenge`;
   idle-detection ("act when there is capacity"); context-pressure (no precedent found,
   may be infeasible without context-usage introspection); an explicit `groom` codename
   (Letta `/doctor`). This is a compose problem, not an adopt one.
4. **Forgetting substrate.** git-only vs a tombstone register vs invalidation metadata
   vs immutable versions. Minimalist pressure favors git, optionally with light "why it
   was dropped" metadata; the others are the same idea with heavier backends.
5. **Verb-set.** Whether to name the operations explicitly (promote / consolidate /
   forget / leave) so the procedure is teachable in the prompt.
6. **Verifier pass.** A second pass that *refuses* a bad grooming/repair rather than
   produces it (Generator → temperature-0 Verifier; critic-guided reflexion) curbs
   self-agreement. Open whether grooming/`challenge` should use an independent review
   pass or trust the same agent. (Surfaced by the run; the specific tools behind it were
   not independently verified.)

## Target C — anti-rot / doc↔code alignment (hard)

| Project | Mechanism | Trigger | Semantic vs scripted | Autonomy | History | Adaptable? |
|---|---|---|---|---|---|---|
| Swimm auto-sync [C1] | doc snippet bound to code by markers (line/token/path); drift from a multi-signal histogram over full git history | PR diff touches referenced code | mostly deterministic, conservative | high for trivial; flags a human on low signal | git | partial — binding+diff is our `covers` + git-diff. But Swimm treats the diff as a **verdict**; we treat it as a "where to look" suspicion. Reclaim its **degrade-to-human-only-when-confidence-low**; reject the verdict stance |
| Fiberplane Drift [C2] | doc↔code binding by **AST fingerprint** (XxHash3 of normalized tree-sitter AST, no whitespace/position), symbol-level anchors, recorded in `drift.lock`; `drift check` recomputes and compares; ships a coding-agent skill that teaches the agent to stamp/maintain anchors | `drift link` / `drift check` | deterministic (hash compare); refactor-safe | low as CLI; the agent-skill makes the *decision to check* autonomous | `drift.lock` in git | partial — the most precise binding surveyed and refactor-safe; finer than globs. CLI/CI as product center fails our filters, but the binding + the agent-skill bridge are adaptable as a markdown annotation + an agent procedure |
| Anthropic Managed Agents memory [A6] | every write creates an immutable **memory version**; `content_sha256` precondition makes edits safe under concurrency; redact scrubs a version while preserving the audit trail | agent/API write | scripted hash check + semantic writes | high for writes | immutable versions, 30-day+ retention, point-in-time recovery | yes (mechanism) — first-party precedent for **hash-guarded baseline advancement and recovery**; `content_sha256` is a precondition guarding an edit, a mechanism docdoki ultimately did not adopt; redact-preserves-audit is the compliance-safe forget |
| Living documentation (Martraire) [C3] | couple docs to code; **generate** docs from enriched code; continuously verify | build/CI | generation, low judgment | high (no drift if generated) | code | partial — "couple + continuously verify" aligns; "generate everything" erases the human intent layer. Take the principle, reject the extreme |
| doctest / rustdoc doctests [C4] | doc examples **are** tests; run in CI; drift becomes a hard failure | CI run | deterministic; executable claims only | full (hard fail) | code | partial — strongest anti-rot, but only for executable claims. Lesson: where a spec claim **can** cite a check (a command's output, a test), prefer it — audit becomes running, not re-reading. Watch brittleness |

**Adaptable patterns.**
- Binding + baseline + diff-since-baseline is the universal skeleton (Swimm snippets,
  Fiberplane AST fingerprints, our `covers` globs). Keep the diff as a
  cheap signal.
- Graceful degradation: act autonomously when confidence is high, **escalate to the
  human only on genuine ambiguity** (Swimm) — exactly our doc-wrong/code-wrong/tie split.
- Free verification where claims are executable (doctest): let a spec claim optionally
  name a check that flips.
- Safe-edit-under-baseline (`content_sha256`, Anthropic): a hash precondition turns
  "advance the baseline" into an atomic, audit-producing operation.

**Filter failures.** Swimm, Fiberplane, doctest are deterministic-verdict/CLI systems
— they fail the semantic/prompt-first model as a *whole*, which is the deliberate
reason docdoki keeps detection a *suspicion* and leaves the verdict to the agent reading
code. Living-doc's generate-from-code fails the ownership model. Borrow mechanisms,
not the stance.

**Open design choices.**
1. **Binding granularity.** Coarse globs (ours) vs fine snippet markers (Swimm) vs
   AST fingerprints (Fiberplane) vs executable claims (doctest). Start coarse; add a
   stronger binding only where it earns its cost.
2. **Suspicion vs verdict.** Already chosen (suspicion); record the divergence from
   Swimm/Fiberplane so it is a decision, not an accident.
3. **Baseline advance.** docdoki keeps no per-claim baseline; `challenge` re-reads the
   code under `covers` and the agent's reading is the verdict — a `content_sha256`-style
   sha baseline was considered and dropped as too heavy for a prompt-first core.
4. **Verifier pass.** Same agent self-review vs an independent reviewer pass (see B-6).

## Cross-cutting — prompt-first form

The field is converging on markdown instructions in the filesystem with progressive
disclosure (AGENTS.md, Claude Skills, Letta MemFS, Anthropic memory stores) rather
than scripts. This validates the prompt-only core: `SKILL.md` + `references/` +
on-demand docs is the mainstream shape, not an outlier. The memory systems that ship
code (Mem0, Letta, Zep, Merken) put the code in retrieval/storage plumbing (vector DB,
graph store, audit collection); the *decisions* (what to add/update/delete/promote)
are LLM calls. For us the plumbing is git + the filesystem + the agent's own
Read/Edit/Bash, so their code is exactly the part we don't need — we keep their
decision procedures as prompt.

## Synthesis: what this leaves for the design step

- **A is settled** and corroborated from several directions; only guard against
  reintroducing a human-issued refresh trigger.
- **B does not exist whole in any precedent.** The pieces are all proven —
  synthesis-on-accumulation (Gen Agents), an LLM verb-set (Mem0, Merken), promotion-by-
  linking and note-revision (A-MEM), git/tombstone/versions as the trace that lets us
  forget cleanly. Two combinations have **no precedent and must be composed**: (1)
  agent-decided forgetting with a full audit trail, and (2) truly autonomous grooming
  cadence. These are the core of the B design.
- **C's skeleton matches prior art** (binding + baseline + diff) but **no surveyed
  system passes all filters** — deterministic tools bind well but verdict-and-CLI;
  semantic tools judge well but run as CLI/CI. docdoki must compose a semantic agent audit
  onto a coarse binding (`covers`), with the diff as suspicion and the human
  only on genuine doc-vs-code ties.

## Confidence and provenance

- **High** (primary docs/papers re-verified this pass): Cline [A1], AGENTS.md/skills
  [A2][A3], Claude Code memory [A4], Letta MemFS [A5], Anthropic Managed Agents memory
  [A6], Diátaxis [A7], Generative Agents [B1], Mem0 four-op + issue #4926 [B2][B3],
  Merken [B4], A-MEM [B5], Zep/Graphiti [B6], Swimm [C1], Fiberplane Drift [C2],
  doctest [C4].
- **Medium** (documented but not source-traced): Living Documentation [C3]; the
  heuristic-vs-LLM boundary of Merken's deciders; whether Anthropic dreaming runs
  autonomously vs on a schedule.
- **From the archived multi-agent run, not independently re-verified** (use as design
  prompts, verify before citing in a design doc): the verifier-pass idea
  (DocuGardener, DocSync), inverted doc→code binding (lat.md `require-code-mention`),
  idle/pressure-driven cadence (AgentDB), and the long tail of small memory/anti-rot
  repos catalogued in `archive/chaos-run/`.

## Sources

- [S1] Rethinking Memory in LLM based Agents (operations taxonomy): https://arxiv.org/pdf/2505.00675
- [A1] Cline Memory Bank: https://github.com/cline/prompts/blob/main/.clinerules/memory-bank.md
- [A2] AGENTS.md guide: https://www.morphllm.com/agents-md-guide
- [A3] Progressive disclosure (microsoft/agent-skills): https://deepwiki.com/microsoft/agent-skills/3.3-progressive-disclosure
- [A4] Claude Code memory: https://code.claude.com/docs/en/memory
- [A5] Letta Code memory (MemFS): https://docs.letta.com/letta-code/memory
- [A6] Anthropic Managed Agents memory: https://platform.claude.com/docs/en/managed-agents/memory
- [A7] Diátaxis: https://diataxis.fr/
- [B1] Generative Agents paper: https://arxiv.org/pdf/2304.03442
- [B2] Mem0 paper: https://arxiv.org/abs/2504.19413
- [B3] Mem0 update operations: https://docs.mem0.ai/core-concepts/memory-operations/update — limitation: https://github.com/mem0ai/mem0/issues/4926
- [B4] Merken: https://github.com/stffns/merken
- [B5] A-MEM paper: https://arxiv.org/abs/2502.12110 — repo: https://github.com/agiresearch/A-mem
- [B6] Zep temporal KG paper: https://arxiv.org/pdf/2501.13956 — Graphiti: https://github.com/getzep/graphiti
- [C1] Swimm auto-sync: https://swimm.io/blog/how-does-swimm-s-auto-sync-feature-work
- [C2] Fiberplane Drift: https://github.com/fiberplane/drift
- [C3] Living Documentation (Martraire): https://books.google.com/books/about/Living_Documentation.html?id=8_6ZDwAAQBAJ
- [C4] Python doctest: https://docs.python.org/3/library/doctest.html
