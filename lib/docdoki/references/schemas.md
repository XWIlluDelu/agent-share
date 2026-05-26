# Schemas

All machine-readable formats consumed or produced by docdoki operations. Refer to this file whenever you need exact field names, allowed values, or path conventions. The SKILL.md body intentionally avoids these details to stay scannable.

## Table of contents

- [Spec frontmatter](#spec-frontmatter)
- [Northstar frontmatter](#northstar-frontmatter)
- [Active todo frontmatter](#active-todo-frontmatter)
- [Chore line format](#chore-line-format)
- [Challenge report](#challenge-report)
- [Staging path and frontmatter](#staging-path-and-frontmatter)
- [cache.json](#cachejson)

---

## Spec frontmatter

Each `docs/spec/*.md` carries this frontmatter:

```yaml
---
id: spec-auth                       # required; kebab-case; globally unique under docs/
type: living_spec                   # required; literal
status: active                      # required; one of: active | deprecated
covers:
  paths:                            # required; list of glob patterns; must be non-empty
    - src/auth/**
    - tests/auth/**
  tags: [auth, jwt, session]        # optional; experimental, no mechanical validation
---
```

**Field semantics**:

- `id` — used as the natural-language resolution target ("the auth spec" → `spec-auth`). Must be globally unique across `docs/`. `check_static.py` enforces this.
- `covers.paths` — dispatch hint, not a contract. Tells `challenge` which code to look at; tells `status` which paths to diff for stale detection. Glob patterns relative to repo root. `check_static.py` requires this list to be present and non-empty (an empty list breaks smart-mode dispatch).
- `covers.tags` — soft hint, only consumed by LLM during `challenge`. Never used in mechanical validation. May be empty or absent.

## Northstar frontmatter

`docs/northstar.md` does not require frontmatter. If present, only `id: northstar` is recognized; other fields are ignored.

## Active todo frontmatter

`docs/todo/active_<description>.md` does not require frontmatter. If present, only `id: active-<description>` is recognized.

## Chore line format

Each line in `docs/chores.md` follows this exact pattern (single line, no HTML hidden comments):

```markdown
- [ ] [chore-abc2d7] **[area]** YYYY-MM-DD owner:agent|human impact:minor|major target:<doc-id>|none — free-text description
```

**Field semantics**:

- `[ ]` or `[x]` — task checkbox; `[x]` marks resolved chores that `garden` will remove
- `[chore-XXXXXX]` — 6-char base32 ID. Base32 lowercase alphabet is `a-z` + digits `2-7` (RFC 4648); digits `0`, `1`, `8`, `9` are **not** valid. **Generate via `scripts/new_chore_id.py`, never by LLM** — LLM-generated "random" strings pattern-lock and produce far more collisions than the theoretical 32⁶ ≈ 10⁹. Use `chore-??????` as a placeholder; the next write-state command (`go` / `garden`) replaces placeholders with real IDs by calling the helper.
- `**[area]**` — area tag, free-text, used by `garden` for semantic aggregation
- `YYYY-MM-DD` — creation date
- `owner:agent|human` — who initiated
- `impact:minor|major` — informational only
- `target:<doc-id>|none` — proposed promotion target if known; `garden` may override
- ` — ` separator (space + em dash + space) then free text

**Uniqueness**: the chore-ID namespace is local to `chores.md`. Collisions are detected by `scripts/check_static.py`. A collision is an error condition; `check` reports it but does not auto-fix (check is strictly read-only). The user or Agent must manually rewrite the duplicate ID using `scripts/new_chore_id.py` to mint a fresh one.

## Challenge report

`docs/challenge/<YYMMDD>_<NN>_<rand>.md`

- `YYMMDD` — date in UTC (six digits)
- `NN` — same-day sequence, two-digit zero-padded (01, 02, ...). Single-Agent / single-user workflows do not approach the 99-per-day ceiling in practice; if you ever do, change the operation to produce date-rolling new files rather than complicating the format.
- `rand` — 4-char base32 random; defeats same-day filename races between concurrent challenge calls. Even when two concurrent allocators pick the same `NN`, the rand suffix keeps the files distinct.

Use `scripts/allocate_challenge_report.py` to allocate the filename — it scans existing reports for the day and produces an unused `(NN, rand)` pair via `O_EXCL`.

**Frontmatter**:

```yaml
---
ran_at: 2026-05-23T10:42:00Z        # ISO-8601 UTC
git_rev: 4f91e4c                    # DIAGNOSTIC ONLY — HEAD when the run started.
                                    # NOT the alignment anchor; the anchor is the
                                    # commit that introduces this file in git history.
mode: smart | explicit              # smart = no-args invocation; explicit = doc-id passed
targets:                            # list of target doc IDs covered by this report
  - spec-auth
  - spec-payment
include_flags: [active, chores]     # optional; only set if smart mode used --include
---
```

**Body** — one section per target:

```markdown
## spec-auth

verdict: pass | fail | uncertain
resolution: code_change | doc_change | human_decision   # required when verdict=fail
violations:
  - clause: "Spec §3.2 — Token expiry ≤ 24h"
    code: src/auth/token.ts:42
    nature: boundary | naming | other
notes: |
  Free-form rationale. Written for humans to read later when re-litigating
  a past decision. Not consumed mechanically.
```

**Resolution semantics** (only meaningful when verdict is `fail`):

- `code_change` — the spec is correct; the code violated it. The agent / user should fix the code, not the spec. **No spec staging is produced** by `challenge`; a chore may be added to `chores.md` reminding to fix.
- `doc_change` — the code is correct and the spec needs to evolve to permit the new behavior. `challenge` writes a spec edit to staging.
- `human_decision` — neither side is obviously wrong. `challenge` produces no staging; the report itself surfaces the conflict for human adjudication.

This split defeats the "ratify-bad-code" trap where every `fail` automatically weakened the spec.

**Alignment anchor**: when `verdict: pass`, this report becomes the alignment anchor for that spec — but the anchor SHA is the **introducing commit** of the report file (found via `git log -1 --format=%H -- <path>`), **not** the embedded `git_rev`. Until the report is committed, it counts as a *pending* pass, not yet an anchor; `derive_cache.py` and `status` treat it accordingly. This makes the anchor robust to rebase / squash / cherry-pick (the file moves with git history) and avoids the pre-commit-challenge false-stale scenario.

## Staging path and frontmatter

**Path format**:

```text
.docdoki/staging/<target-doc-relative-path>.<source>.md
```

Where:
- `<target-doc-relative-path>` is the path under `docs/`, e.g. `spec/auth.md` or `northstar.md`
- `<source>` ∈ {`polish`, `challenge`, `garden`}

Examples:
- `.docdoki/staging/spec/auth.md.challenge.md`
- `.docdoki/staging/northstar.md.polish.md`
- `.docdoki/staging/spec/logging.md.garden.md` (a newly-created spec under garden)
- `.docdoki/staging/chores.md.garden.md` (chores deletions from garden)

Use `scripts/staging_path.py` to compute this deterministically. The script rejects absolute paths, `..` traversal, and any input that would resolve outside the managed `docs/` tree. Always invoke the script rather than building paths inline.

**Frontmatter**:

```yaml
---
source: polish | challenge | garden  # which operation produced this draft
target_doc: docs/spec/auth.md        # absolute repo-relative path of final destination
created_at_rev: 4f91e4c              # full SHA of HEAD at draft creation
created_on_branch: master            # branch name at draft creation
base_content_sha256: <hex>           # SHA-256 of target_doc content at draft creation;
                                     # null if target_doc did not yet exist (new-file staging)
chore_ids: [chore-abc2d7]            # only set if source=garden; chores that contributed
report_ref: docs/challenge/260523_01_a8b3.md   # only set if source=challenge; report that triggered
---
<body — the complete final content of target_doc after this change lands>
```

The body is the **final state** of the target document, not a diff. `approve` overwrites `target_doc` with this body verbatim and deletes the staging file.

**Approval validation** (performed by `approve`):

1. `created_at_rev` must be an ancestor of current HEAD: `git merge-base --is-ancestor <created_at_rev> HEAD`. If not — typically because someone rebased — refuse with explanation.
2. `created_on_branch` must equal current branch unless `--cross-branch` is passed.
3. **Content drift check**: if `base_content_sha256` is set, the current target file's SHA-256 must equal it. If the target was edited (manually or by another command) since staging was created, refuse. The user can re-run the producing command (`polish` / `challenge` / `garden`) against the new base, or pass `--force` to overwrite.
4. **Multi-source check**: if more than one staging file targets the same `target_doc` (e.g. both a `.polish.md` and a `.challenge.md` exist), refuse and require `--source` to disambiguate. Otherwise the order of application would be filesystem-dependent and the last write would silently win.
5. If all validations pass: write body to `target_doc`, delete the staging file.

## cache.json

`.docdoki/cache.json` is **derivable** from `docs/challenge/*.md` + git history. It is a performance index, not the source of truth. Schema (version 2):

```json
{
  "schema_version": 2,
  "alignment_anchors": {
    "spec-auth": {
      "latest_pass_report": "docs/challenge/260523_01_a8b3.md",
      "anchor_commit": "4f91e4c",
      "diagnostic_run_rev": "4f91e4c"
    },
    "spec-payment": {
      "latest_pass_report": "docs/challenge/260520_03_2c7f.md",
      "anchor_commit": "1a7734f",
      "diagnostic_run_rev": "1a7734f"
    }
  },
  "pending_pass_reports": [
    "docs/challenge/260524_02_p1ng.md"
  ]
}
```

- `anchor_commit` is the introducing commit of the report file (the SHA used for stale detection). Always reachable as long as the report file exists in git, so rebase / squash / cherry-pick do not invalidate anchors.
- `diagnostic_run_rev` is what HEAD was when the challenge run started. Not used for stale detection; kept only for audit-trail purposes.
- `pending_pass_reports` lists pass reports that exist on disk but have not yet been committed; they do not anchor a spec until committed.

**Rebuild trigger**: any command that needs the index should first check that `cache.json` is fresher than the newest file under `docs/challenge/`. If stale, re-derive by running `scripts/derive_cache.py`. Deleting `cache.json` is always safe — the next operation rebuilds it.

**Why not git-tracked**: cache rebuilds are local-only and frequent under multi-agent / multi-branch development. Tracking would create merge conflicts that resolve to "just delete and rebuild" anyway.
