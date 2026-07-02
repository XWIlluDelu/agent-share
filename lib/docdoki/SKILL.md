---
name: docdoki
description: |
  Manage living documentation for software projects under Agent-driven (vibe coding) development. Use when the user asks to set up project docs, bootstrap docs for an existing codebase, capture project goals or a northstar, maintain an active todo, log chores, write or audit living specs, run challenge reports for code-doc alignment, clean up document drift, promote chores into specs, or resolve staging drafts. Ten operations cover the full lifecycle: init, adopt, status, check, polish, go, challenge, garden, approve, discard. Resolves natural-language document references like "the auth spec" or "current todo". Trigger phrases: docdoki, living spec, northstar, active todo, chores ledger, challenge report, spec drift, doc alignment, agent context loss, vibe coding docs, bootstrap docs.
---

# DocDoki

DocDoki manages a project's living documentation as the shared source of truth between human engineers and coding Agents. It centers on seven document types under `docs/`, ten skill operations, and an explicit staging mechanism for any non-trivial edit.

## Mental model

DocDoki exists because two failure modes break Agent-assisted development:

1. **Document rot**. Heavy doc trees rot under frequent small edits; humans stop reading them, Agents miss them.
2. **Context loss**. Pure-chat workflows have no ground-truth deposit; when sessions reset, decisions evaporate.

DocDoki's fix: a minimal `docs/` tree (seven canonical types), an explicit write matrix, and LLM challenge audits instead of git hooks. Non-trivial cold-document edits go through staging; hot low-stakes docs and append-only history use direct writes where the matrix allows them. Cache state is gitignored and rebuildable. Markdown is canonical; machine state is disposable.

## File layout (created by `init` or `adopt`)

```text
docs/
  northstar.md                       # Goals — append-only, cold state
  glossary.md                        # Terminology — cold state, human-led
  runbook.md                         # Operational commands — warm state, shared
  todo/
    active_<description>.md          # Current stage plan — at most one per repo
    archive/
      <description>_YYMMDD.md        # Past stage plans — history
  chores.md                          # Mini-change ledger — hot, prune-on-garden
  spec/
    *.md                             # Living Spec — current decisions
  challenge/
    <YYMMDD>_<NN>_<rand>.md          # Audit reports — append-only history + alignment anchor
.docdoki/
  cache.json                         # Derived index — gitignored, rebuildable
  staging/                           # Pending drafts — gitignored
```

Two axes:
- **State** (challengeable): northstar, glossary, runbook, active todo, chores, spec
- **History** (never challengeable): todo/archive, challenge reports

## The ten operations

Each operation is a workflow the Agent performs by reading files, calling the LLM where needed, and writing outputs. They are not RPC functions; the names are just mnemonics for "the procedure described below". For full per-command preconditions / steps / outputs, read **`references/commands.md`**.

| Operation | One-line | Detail |
| :-- | :-- | :-- |
| `init` | Scaffold empty `docs/` skeleton and gitignore entries | `references/commands.md` § init |
| `adopt` | Autonomous LLM bootstrap of a project that already has code | `references/adopt-pipeline.md` |
| `status` | Single-screen dashboard from existing files | `references/commands.md` § status |
| `check` | Pure static validation, strictly read-only, no LLM | `references/commands.md` § check |
| `polish` | LLM rewrite of a document (L1-L4 authority), produces staging | `references/commands.md` § polish |
| `go` | Plan the next iteration; preload relevant specs into Agent context | `references/commands.md` § go |
| `challenge` | LLM audits code against documents; writes structured verdict report | `references/commands.md` § challenge |
| `garden` | LLM aggregates chores into spec promotions; produces staging | `references/commands.md` § garden |
| `approve` | Explicitly land a staging draft into the target document | `references/commands.md` § approve |
| `discard` | Explicitly delete a staging draft without landing | `references/commands.md` § discard |

When the user invokes any of these (e.g. "docdoki adopt", "run challenge", "polish the auth spec"), follow the procedure in the referenced file. When uncertain which operation matches a request, read `references/commands.md` end-to-end first.

## Cross-cutting rules

When a write feels ambiguous, first read `references/anti-patterns.md`. A successful DocDoki operation may report `no_change` and write nothing when there is no material document change to land.

### Natural-language document references

All operations that accept a `<doc-id>` parameter accept natural language ("the auth spec", "current todo", "current goals"). Resolve as follows:

1. Match against frontmatter `id` fields under `docs/`.
2. Match against canonical filenames (`northstar.md`, `glossary.md`, `runbook.md`, `chores.md`, `active_*.md`, `spec/<slug>.md`).
3. If exactly one candidate matches, proceed.
4. **If multiple candidates match, stop and ask.** List the candidates in stdout, request the user disambiguate. Never silently default-pick — wrong choices on cold documents (northstar, archive) are hard to detect and reverse.

### Authoritative write matrix

The matrix is the canonical source of truth for what each operation writes and whether it writes directly or through staging.

| Operation | northstar | glossary | runbook | active_*.md | chores.md | spec/*.md | challenge/*.md | staging |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `init` | direct (placeholder) | direct (placeholder) | direct (placeholder) | — | direct (placeholder) | — | — | — |
| `adopt` | direct (isolated branch) | direct (isolated branch) | direct (isolated branch) | direct (isolated branch) | direct (isolated branch) | direct (isolated branch) | direct (isolated branch) | — |
| `status` | — | — | — | — | — | — | — | — |
| `check` | — | — | — | — | — | — | — | — |
| `polish` | **staged** | **staged** | **staged** | **staged** | **staged** | **staged** | — | produces `.polish.md` |
| `go` | — | — | direct | direct | direct (placeholder replace) | — | — | — |
| `challenge` | — | — | — | — | direct (append chore on `code_change`) | **staged** (on `doc_change`) | direct (new report) | produces `.challenge.md` |
| `garden` | — | — | — | — | **staged** (delta) | **staged** (promotion) | — | produces `.garden.md` |
| `approve` | direct (lands staging) | direct (lands staging) | direct (lands staging) | — | direct (lands staging) | direct (lands staging) | — | consumes staging |
| `discard` | — | — | — | — | — | — | — | removes staging |

Notes:
- "direct" means writing the target file in place. Acceptable when (a) the file is high-frequency / low-stakes (`active_*.md`, `chores.md`), (b) the operation runs in an isolated git environment (`adopt`), or (c) the file is append-only history (`challenge` reports).
- "staged" means writing to `.docdoki/staging/<target>.<source>.md`. The user must explicitly `approve` (validates branch / rev / content sha) or `discard`. No implicit approval.
Staging path format and frontmatter are in `references/schemas.md` § staging.

### Alignment without git hooks

DocDoki never installs git hooks (those get bypassed with `--no-verify` and breed resentment). Instead, the Agent calls `check` and `challenge` at natural points — typically before committing. A challenge report with `verdict: pass`, **once committed to git**, becomes the alignment anchor for the audited spec. Stale detection is `git diff <anchor>..HEAD -- <covers.paths>` where `<anchor>` is the introducing commit of the report file (`git log -1 --format=%H -- <report>`), **not** the `git_rev` field inside the report's frontmatter. The anchor follows the report file through rebase / squash / cherry-pick. Pass reports that exist on disk but have not yet been committed do not anchor anything — they appear in `cache.json`'s `pending_pass_reports`.

### Helper script invocation

The bundled scripts live in the same directory as this `SKILL.md`. The actual install path varies by host (some hosts install per-user, some per-project, some in a system-wide skills directory); the scripts are **not** under the user's project repo. Resolve as follows:

1. `skill_root` = directory containing the `SKILL.md` currently in use. The host exposes this path under whatever name it uses for the skill's source directory.
2. Invoke helpers as `python3 "$skill_root/scripts/<name>.py" [--root "$repo_root"] [other args]`.
3. Several scripts accept `--root` to point at the user's repo; pass it explicitly when CWD is not the repo.

Do not invoke scripts as a bare `scripts/...` path — that resolves relative to CWD (typically the user's repo, where the scripts do not exist).

## When to use which operation

Read `references/commands.md` for full per-operation guidance. Common entry points:

- "Set up docdoki in this new project" → `init`
- "Set up docdoki in this existing project" → `adopt`
- "What's the current state?" → `status`
- "Check before commit" → `check`
- "Plan the next sprint / task / iteration" → `go`
- "Audit whether the auth spec still matches the code" → `challenge spec-auth`
- "Smart audit before commit" → `challenge` (no args; covers only specs by default)
- "Clean up chores accumulated over the sprint" → `garden`
- "Polish my draft northstar" → `polish northstar`
- "Land the pending changes" → `approve --all`
- "Discard the pending polish" → `discard <doc-id> --source polish`

## When NOT to use docdoki

Read `references/commands.md` § not-applicable for the full list. Common skips:

- Pure code questions that don't touch documentation.
- One-off README edits unrelated to the docdoki tree.
- Projects where the user has explicitly disabled docdoki for some reason.

## Bundled scripts

Several deterministic helpers live in `scripts/` and should be invoked by the Agent (not reimplemented inline):

- `scripts/new_chore_id.py` — generate a cryptographically random 6-char base32 chore ID
- `scripts/check_static.py` — run the full static lint that the `check` operation performs
- `scripts/allocate_challenge_report.py` — atomically allocate a new `<YYMMDD>_<NN>_<rand>.md` filename under `docs/challenge/`
- `scripts/staging_path.py` — compute the canonical staging path for a (target_doc, source) pair
- `scripts/derive_cache.py` — rebuild `.docdoki/cache.json` from `docs/challenge/*.md`

LLMs generate poor random strings (pattern-locking inflates collision rate far above the theoretical 32^6 ≈ 10⁹). Use the script, do not improvise.

## Reference files

- `references/commands.md` — per-operation preconditions, steps, outputs, examples. **Read this when about to execute any operation.**
- `references/schemas.md` — machine formats: staging paths, staging frontmatter, chore line format, challenge report schema, cache.json shape, spec frontmatter.
- `references/adopt-pipeline.md` — the full S0-S10 pipeline with LLM prompt templates and stage-boundary contracts.
- `references/lifecycle.md` — deep dive on each of the seven document types: ownership, update cadence, archival rules, refactor handling.
- `references/anti-patterns.md` — DocDoki-specific wrong moves to check before ambiguous writes.
