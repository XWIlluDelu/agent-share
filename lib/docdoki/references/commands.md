# Commands

Per-operation procedures. The Agent reads this file when about to execute any docdoki operation.

Each section contains operational trigger, preconditions, steps, and outputs. `no_change` is a successful outcome: the operation ran, found no material document change or no eligible target, and wrote nothing.

## Table of contents

- [init](#init)
- [adopt](#adopt)
- [status](#status)
- [check](#check)
- [polish](#polish)
- [go](#go)
- [challenge](#challenge)
- [garden](#garden)
- [approve](#approve)
- [discard](#discard)
- [not-applicable](#not-applicable)

---

## init

**Trigger**: User asks to set up docdoki on a fresh project, an empty repo, or a project where they explicitly want a blank canvas rather than auto-inference.

**Preconditions**:
- Current directory is a git repo (run `git rev-parse --is-inside-work-tree` to verify).
- `docs/` either does not exist or is empty. If non-empty, refuse and suggest `adopt --force` instead.

**Steps**:
1. Create `docs/`, `docs/todo/`, `docs/todo/archive/`, `docs/spec/`, `docs/challenge/`.
2. Create empty placeholder files: `docs/northstar.md`, `docs/chores.md`. Each contains a single H1 heading and a one-line hint comment ("# Northstar\n\n<!-- Add main goals here. See docdoki/references/lifecycle.md § northstar -->").
3. Do NOT create `docs/todo/active_*.md` (the user names their first task book).
4. Append the following to `.gitignore` (creating it if absent):
   ```
   .docdoki/cache.json
   .docdoki/staging/
   ```
5. Print a one-screen summary of what was created and what to do next ("Write `docs/northstar.md` to capture your goals, then run `docdoki go` to plan the first iteration").

**Outputs**: empty `docs/` tree, gitignore updated, one-screen stdout summary.


---

## adopt

**Trigger**: User asks to set up docdoki on a project that already has code, OR asks docdoki to bootstrap an existing codebase, OR uses phrases like "adopt", "embed docdoki", "set up docs for this existing project".

**Preconditions**:
- Current directory is a git repo with at least one commit on the current branch.
- `docs/northstar.md` and `docs/spec/*.md` either do not exist or `--force` was passed.

**Steps**: Read **`references/adopt-pipeline.md`** — the full procedure is a ten-stage pipeline (S0-S10) with LLM prompt templates and stage-boundary contracts. Do not attempt to reimplement inline.

**Outputs**: One git commit on the original branch ("docdoki: adopt project") containing the full populated `docs/` tree, OR a retained `docdoki/adopt-<timestamp>` branch if any stage failed (in which case stdout reports the failure point).


---

## status

**Trigger**: User asks for the current state, dashboard, summary, or what docdoki "thinks is going on". Also a good first call at the start of any session — it primes context.

**Preconditions**: `docs/` directory exists.

**Steps**:
1. **Read northstar**. Extract the latest stage goal (the section closest to end of file).
2. **Find active todo**. Glob `docs/todo/active_*.md`. If zero matches, report "no active stage". If one match, parse and report progress (count checked vs unchecked checkboxes). If **more than one match, this is an error condition** — report all candidates and tell the user to archive all but one.
3. **Count open chores**. Read `docs/chores.md`, count `- [ ]` lines. Report total + first 3 chores verbatim.
4. **Stale specs**. For each `docs/spec/*.md`:
   - Read its frontmatter `covers.paths`.
   - Find the most recent challenge report under `docs/challenge/` where this spec's `id` appears in `targets` AND its section's `verdict: pass`.
   - If found, take that report's **introducing git commit** via `git log -1 --format=%H -- <report-path>`. If the report is uncommitted (no introducing commit), treat the spec as **pending alignment** (audited but not yet anchored) rather than stale.
   - With the anchor commit `A`, run `git diff <A>..HEAD -- <covers.paths>`. Non-empty → stale.
   - If no pass report exists at all → stale (never aligned).
5. **Pending staging**. Glob `.docdoki/staging/**/*.md`. For each, parse frontmatter and compute `+X -Y` line counts (use `wc -l` after `diff` between staging body and target_doc).
6. **Recent challenge**. Read the lexically-latest file under `docs/challenge/`; report its `targets` and verdicts.
7. **Uncertain items**. Across all `docs/challenge/*.md`, find sections with `verdict: uncertain` that have no later `pass` or `fail` for the same spec; report as "awaiting human decision".

**Outputs**: One-screen formatted text, no file writes.


---

## check

**Trigger**: User asks to validate the docdoki tree, run pre-commit checks, lint the docs, or check before committing. Also called proactively by the Agent before producing a git commit that touches `docs/`.

**Preconditions**: `docs/` directory exists.

**Steps**: Invoke `scripts/check_static.py`. It performs all the following without ever modifying files:
1. Markdown well-formedness (frontmatter parses; bullet structure consistent).
2. Internal link graph: every `[text](path)` resolves.
3. Chore ID uniqueness within `chores.md`; placeholder `??????` count reported (informational, not an error).
4. Frontmatter schema validation (per `references/schemas.md`): spec frontmatter has `id`, `type`, `status`, and non-empty `covers.paths`. Spec IDs are unique across all `docs/spec/**/*.md`.
5. Staging file integrity: every staging file has valid frontmatter and a `target_doc` that resolves under `docs/`.
6. Naming conventions: at most one `active_*.md`; `docs/challenge/` filenames match `<YYMMDD>_<NN>_<rand>.md` pattern; `docs/todo/archive/` filenames match `<description>_<YYMMDD>.md`.

**Outputs**: List of errors and warnings to stdout. Exit code 0 if clean, 1 if any errors.


---

## polish

**Trigger**: User asks to polish, rewrite, restructure, or improve the wording of a document. Or runs it after pasting raw thoughts they want shaped up.

**Preconditions**:
- Target document(s) exist.
- No pending staging for the same `(target_doc, source=polish)` pair — if one exists, report the conflict and ask the user whether to `discard` it first.

**Steps**:

For each target document (multiple `<doc-id>` args allowed; no args = polish docs touched by `git diff --cached`):
1. Read the current content of the target. Compute `base_content_sha256 = sha256(target_content)` (or `null` if the file does not yet exist).
2. Send to the LLM with prompt: "Polish this document. Authority levels L1–L4 are open: format fixes, wording cleanup, structural reorganization, semantic completion of obviously-incomplete sentences. Preserve meaning. Do not invent facts not present in the source. Return the complete final document." Adjust authority hint based on user's stated intent if known.
3. If the returned document is byte-identical to the target, or differs only by trailing whitespace, report `no_change` for that target and write no staging file.
4. Compute staging path: `scripts/staging_path.py <target_doc> polish`.
5. Write staging file with frontmatter (source=polish, target_doc, created_at_rev=current HEAD SHA, created_on_branch=current branch name, base_content_sha256=the hash from step 1) and body = LLM output.
6. Report to stdout: which staging files were created and the `+X -Y` summary; remind the user to `docdoki approve` or `discard`.

**Outputs**: One staging file per changed target doc; `no_change` for unchanged targets. No direct writes to `docs/`.


---

## go

**Trigger**: User starts a new iteration, sprint, or task. Phrases: "plan the next step", "let's go", "what's next", "start the next task".

**Preconditions**:
- `docs/northstar.md` exists and is non-empty.
- At most one `active_*.md` exists. If more than one, fail with the same error as `status` step 2.

**Steps**:
1. **Replace chore placeholders**: scan `docs/chores.md` for `chore-??????` patterns. For each, call `scripts/new_chore_id.py` to mint a fresh ID (verifying no collision against existing chore IDs in the file). Rewrite `chores.md` in place. This is the canonical place where placeholder replacement happens (NOT in `check`).
2. **Preload context for the Agent**:
   - Read `docs/northstar.md` (most recent stage goal).
   - Read the existing `active_*.md` if one exists.
   - Compute the union of all changed code paths (uncommitted diff + recent commits since the active todo was last updated).
   - For each `docs/spec/*.md`, check if its `covers.paths` intersect this union. Read every intersecting spec in full and include in working context.
   - Read `docs/chores.md` (unresolved chores).
3. **Plan**: with that context, generate or update `active_<description>.md`. Structure:
   - One-paragraph stage description.
   - Checkbox task list, each item one sentence.
   - Mark completed items `[x]`.
4. **Output**: If `active_*.md` exists, update in place. If it does not exist, create `active_<description>.md` where `<description>` is a kebab-case slug derived from the stage description.

Active todo writes are **direct** (not staged) — they're high-frequency, low-stakes, and constantly amended. Staging would add friction without safety benefit.

**Outputs**: Updated or created `active_*.md`; chores.md possibly modified (placeholder replacements); stdout summary of the plan.


---

## challenge

**Trigger**: User asks to audit code-doc consistency, challenge a specific spec, run a drift check, or before merging significant changes. Also called proactively by the Agent after substantial code changes.

**Preconditions**: Target document(s) exist OR (in smart mode) `docs/spec/*.md` exists.

**Steps**:

**Mode 1: Explicit (`challenge <doc-id(s)>`)**
1. Resolve each `<doc-id>` (see SKILL.md § natural-language references).
2. For each target, in parallel:
   - Read the target document fully.
   - Determine code context: if target has `covers.paths`, use that. Otherwise (northstar, active, chores) use the current uncommitted diff or last commit's diff.
   - Send to LLM with prompt: "Audit whether the code matches the document's stated constraints, boundaries, and naming rules. Output structured YAML with `verdict` (pass/fail/uncertain). When verdict is `fail`, also output `resolution`: `code_change` if the spec is right and the code violates it, `doc_change` if the code is right and the spec needs to evolve, or `human_decision` if neither side is obviously wrong. Output `violations` (list of {clause, code, nature}) and free-form `notes`. For northstar audits, apply harness: do not modify the document unless evidence is overwhelming."
3. Allocate a single new report filename: `scripts/allocate_challenge_report.py`. Write all results into that one file (one section per target) per the schema in `references/schemas.md`.
4. **Branch on resolution** (only for verdict=fail):
   - `resolution: doc_change` → generate a proposed spec edit (LLM rewrite of the target doc that addresses the violations); write to staging via `scripts/staging_path.py <target> challenge`.
   - `resolution: code_change` → **do not** stage a spec edit. Append a chore to `chores.md` summarizing the violation so the next iteration's code work is reminded to fix it. Use `scripts/new_chore_id.py --exclude docs/chores.md` for the ID.
   - `resolution: human_decision` → produce nothing automatically. The report itself surfaces the conflict; status will flag it as `awaiting human decision`.
5. Report to stdout: per-target verdict + resolution; total counts; paths of any staging or chore additions.

**Mode 2: Smart (`challenge` with no args, optionally `--include active,chores,northstar`)**
1. Compute current diff scope: uncommitted changes + last commit diff if uncommitted is empty.
2. **Default inclusion**: every `docs/spec/*.md` whose `covers.paths` intersects the diff.
3. **Opt-in inclusion** (via `--include`): `active` adds the active todo; `chores` adds chores.md; `northstar` adds northstar.md. Each only enters if there's any code diff at all.
4. If the resulting target set is empty, report `no_change` and write no challenge report.
5. Run Mode 1 procedure on the resulting target set.

**Outputs**: One challenge report file in `docs/challenge/<YYMMDD>_<NN>_<rand>.md` when targets exist; `no_change` when smart mode finds no targets. Possibly multiple staging files (one per failed target). stdout summary.


---

## garden

**Trigger**: User asks to clean up chores, promote micro-changes into specs, run garden, tidy the chores ledger. Also a natural stage-end action.

**Preconditions**: `docs/chores.md` exists. Either no chores → noop with informational message; or chores present → proceed.

**Steps**:

**Mode 1: No args**
1. Read entire `docs/chores.md`.
2. Read every `docs/spec/*.md` (to know existing targets).
3. Send to LLM with prompt: "Group these chores by semantic theme. For each group, decide: PROMOTE (worth recording as a permanent spec entry — produce the edited or new spec content) or DISCARD (no lasting value). Output structured: groups with chore_ids, action, target_spec_id, and (if promote) the new spec body."
4. For each promotion:
   - Resolve target spec. If `spec-<id>` exists, the staging is an edit; if not, the staging is a new file (path: `docs/spec/<id>.md`).
   - Compute `base_content_sha256 = sha256(target_doc_current_content)` (or `null` if target does not yet exist).
   - Write staging via `scripts/staging_path.py <target> garden` with all required frontmatter (see schemas.md), including `chore_ids` and `base_content_sha256`.
5. Compute `base_content_sha256` of the current `docs/chores.md`, then write a staging via `scripts/staging_path.py docs/chores.md garden` containing chores.md with all PROMOTE'd and DISCARD'd lines removed.
6. Report to stdout: groups summary, action per group, staging files created.

**Mode 2: Seeded (`garden <chore-id>` or `garden <chore-id-1> <chore-id-2> ...`)**
1. Read the seed chores.
2. Send to LLM with prompt: "Here are seed chores. Find other chores in the ledger that are semantically related (same area, same target, same topic). Decide PROMOTE/DISCARD for the resulting group as in mode 1. Or if the seed has insufficient value, output `refuse: <reason>` and propose nothing."
3. If refuse: stdout the reason; **do not modify chores.md or create any staging**.
4. Otherwise proceed as mode 1 step 4 onward.

**Partial selection**: if the user wants to accept only some promotions from a Mode 1 run, the workflow is: `discard` the unwanted ones, then `approve` the rest. Or re-run mode 2 with explicit chore IDs.

**Outputs**: Staging files for each promotion + one staging file for `chores.md` itself; `no_change` when there are no chores or no accepted promotion/discard group. stdout summary.


---

## approve

**Trigger**: User asks to land pending staging, accept the polish/challenge/garden drafts, or commit the staged changes. Phrases: "approve", "accept", "land", "commit the polish".

**Preconditions**: One or more staging files exist under `.docdoki/staging/`.

**Steps**:

1. Determine candidate staging files:
   - `--all` flag → all staging files
   - `<doc-id(s)>` → all staging files whose `target_doc` matches a resolved doc-id
   - `--source polish|challenge|garden` filter further narrows
2. **Multi-source guard**: if the candidate set contains more than one staging file pointing at the **same `target_doc`** (e.g. both `spec/auth.md.polish.md` and `spec/auth.md.challenge.md` exist), refuse to proceed and require `--source` to disambiguate. Applying both would mean filesystem iteration order silently picks the winner.
3. For each remaining staging file:
   - Parse frontmatter.
   - Validate `created_at_rev` is an ancestor of current HEAD: `git merge-base --is-ancestor <created_at_rev> HEAD`. If not, refuse and explain (typically the user rebased; suggest manual inspection).
   - Validate `created_on_branch` equals current branch unless `--cross-branch` was passed. If branch mismatched, refuse and explain.
   - **Content drift check**: if `base_content_sha256` is set in the staging frontmatter, compute the current `target_doc` SHA-256. If they differ, refuse with "target was modified after the staging was created; re-run the producing command, or pass `--force` to overwrite". If `base_content_sha256` is null (new-file staging), require that `target_doc` still does not exist; if it now exists, refuse with the same overwrite prompt.
   - **Confine target**: resolve `target_doc` relative to repo root; refuse if it does not normalize under `<repo>/docs/`.
   - If all validations pass: write the staging body to `target_doc` (overwriting); delete the staging file.
4. Report to stdout: which docs were updated, which staging files were deleted, any refusals (with the specific failed check named).

**Outputs**: Target docs overwritten. Staging files removed. stdout summary.


---

## discard

**Trigger**: User rejects a pending staging, wants to throw away a polish draft, or asks to clean up rejected drafts.

**Preconditions**: One or more staging files exist.

**Steps**:
1. Determine target staging files (same selection rules as `approve`).
2. Delete the matching staging files. No validation needed (we're throwing away, not landing).
3. Report to stdout: which staging files were deleted.

**Outputs**: Staging files removed. stdout summary.


---

## not-applicable

Skip invoking docdoki when:

- The user is asking pure code questions ("how does this function work?") with no doc implication.
- The change is a tiny README typo unrelated to the `docs/` tree.
- The repo has no `docs/` directory and the user hasn't asked to bootstrap.
- The user explicitly said to skip documentation for this task ("just write the code, no docs").

In these cases, mention docdoki only if the user later asks for memory or alignment and the gap would be naturally filled by it. Don't push it.
