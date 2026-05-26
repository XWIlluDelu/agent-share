# Adopt Pipeline (S0-S10)

The full ten-stage procedure invoked by `docdoki adopt`. Each stage has explicit inputs, outputs, prompt templates (where LLM is involved), and failure handling.

## Table of contents

- [High-level guarantee](#high-level-guarantee)
- [Argument parsing](#argument-parsing)
- [Pipeline](#pipeline)
  - [S0. Branch isolation](#s0-branch-isolation)
  - [S1. Scaffold](#s1-scaffold)
  - [S2. Project digest](#s2-project-digest)
  - [S3. Northstar drafting (three-round)](#s3-northstar-drafting-three-round)
  - [S4. Module enumeration (two perspectives + reconciliation)](#s4-module-enumeration-two-perspectives--reconciliation)
  - [S5. Parallel spec drafting](#s5-parallel-spec-drafting)
  - [S6. Cross-spec consistency](#s6-cross-spec-consistency)
  - [S7. Auto-challenge](#s7-auto-challenge)
  - [S8. Active todo inference](#s8-active-todo-inference)
  - [S9. Static check](#s9-static-check)
  - [S10. Atomic merge](#s10-atomic-merge)
- [Failure handling at any stage](#failure-handling-at-any-stage)

## High-level guarantee

adopt runs on an **isolated git branch**. All file writes happen there. Either every stage succeeds and the branch atomically merges back to the user's original branch as a single commit, or some stage fails and the adopt branch is retained for the user to inspect / cherry-pick / rerun.

## Argument parsing

```
docdoki adopt [<one-line-hint>] [--force]
```

- `<one-line-hint>` — optional priming text fed to S2; example: `"Frontend dashboard for X analytics, React + tRPC stack"`. **Not** an iterative conversation; one shot.
- `--force` — required if `docs/northstar.md` or any `docs/spec/*.md` already exists. Without `--force`, refuse to run.

## Pipeline

### S0. Branch isolation

1. **Refuse if HEAD is detached**: `git symbolic-ref --short HEAD` must succeed. If it errors out, abort with "adopt requires a named branch; current HEAD is detached".
2. **Refuse if working tree is dirty**: `git status --porcelain` must be empty (allowing only the staging area to differ would invite carrying user WIP into the adopt commit). If non-empty, abort with "commit or stash your changes before running adopt".
3. Record original branch: `original_branch=$(git symbolic-ref --short HEAD)`.
4. Resolve default branch (used later in the failure-mode help text): `default_branch=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')`. Fall back to `original_branch` if no origin is configured.
5. Mint a unique adopt branch name: `ts=$(date +%s)`; `rand=$(python3 -c "import secrets; print(secrets.token_hex(2))")`; `adopt_branch="docdoki/adopt-${ts}-${rand}"`. The rand suffix defeats sub-second collisions if adopt is invoked twice quickly.
6. Create and switch to isolation branch: `git switch -c "${adopt_branch}"`.
7. All subsequent stages operate on this branch.

Failure handling: any failure in S0 aborts before any file write. Print the reason and exit non-zero.

### S1. Scaffold

Same as the `init` operation:
- Create empty `docs/` tree.
- Append `.docdoki/` entries to `.gitignore`.

No LLM. Deterministic. Commit this state on the adopt branch:

```
git add -A docs .gitignore
git commit -m "docdoki adopt S1: scaffold"
```

(Per-stage commits make `git log` on the adopt branch a readable audit trail if any stage fails. **Never use `git commit -am`** — `-a` only stages modifications to already-tracked files, so new docs/ files would be silently omitted.)

### S2. Project digest

**Goal**: produce an internal structured understanding of the project. Not persisted as a file.

**Input gathering** (Agent reads these files, in this order, capping at a context budget):
1. `README*` at repo root
2. Package manifest: one of `package.json`, `pyproject.toml`, `setup.py`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`
3. Top-level directory listing (`ls -la`)
4. For each top-level subdirectory under `src/` or equivalent: one-level deep listing
5. Notable config files: `tsconfig.json`, `next.config.*`, `.env.example`, `docker-compose.yml`, `Dockerfile`
6. `git log -20 --oneline` for recent activity signal
7. The optional `<one-line-hint>` from the CLI, treated as authoritative project framing

**LLM prompt** (Digest):
```
You are reading a software project to build a structured understanding of it.

Below are the files. Read carefully. Then output structured YAML with these
top-level keys:

  project_kind:        # one phrase, e.g. "Next.js dashboard", "Python CLI tool"
  primary_purpose:     # one sentence, what the project does
  tech_stack:          # list of major frameworks / languages
  top_modules:         # list of {dir_path, brief_purpose} for top-level subdirs
  current_state:       # one paragraph: maturity, recent focus, gaps observed
  user_hint:           # echo back the one-line-hint if provided

Do not output anything except the YAML. Do not infer features not present.

<file: README.md>
...
</file>
<file: package.json>
...
</file>
...
```

**Output**: parsed YAML stored in Agent working memory. Used by S3 and S4. Not written to disk.

**Failure handling**: if LLM output is unparseable, retry once with the instruction "Your previous output was not valid YAML. Output only the YAML object, no preamble." If still fails, abort with stdout error.

### S3. Northstar drafting (three-round)

**Round 1 (draft)**:
```
You are drafting a project's northstar — the document that captures its main
goal and current stage objectives. Based ONLY on the digest below, write a
northstar.md.

Structure:
  # Northstar
  ## Main Goal
  <one paragraph; what is this project ultimately for>
  ## Current Stage
  <one paragraph; what is being built right now>
  ## Hard Constraints
  - <bullet list of non-negotiable rules: performance, compatibility, license,
    architectural choices>

Do not invent features not implied by the digest. If a category has nothing
to write, omit it.

<digest>
{S2 output}
</digest>
```

**Round 2 (self-critique)**:
```
Here is a northstar draft you just wrote. Review it as an adversarial editor.
Identify:
- Statements unsupported by the digest
- Generic / boilerplate sentences with no project specificity
- Implicit assumptions about features not evidenced

Output a list of issues. If no issues, output "no issues".

<draft>
{Round 1 output}
</draft>
```

**Round 3 (revise)**:
```
Revise the northstar to address the issues. Return only the final document.

<draft>
{Round 1 output}
</draft>
<issues>
{Round 2 output}
</issues>
```

Write final to `docs/northstar.md`. Commit:

```
git add docs/northstar.md
git commit -m "docdoki adopt S3: northstar"
```

### S4. Module enumeration (two perspectives + reconciliation)

**Perspective A (structural)**:
```
Based on the digest, enumerate the project's modules from a STRUCTURAL view
(by directory layout). For each module:
  - id: kebab-case slug (becomes spec-<id>)
  - paths: glob patterns matching its code
  - one-line charter: what this module is responsible for

Output YAML list.

<digest>
{S2 output}
</digest>
```

**Perspective B (responsibility)**:
```
Same task but from a RESPONSIBILITY view: group code by what it does, not by
where it lives. A single responsibility may span multiple directories.

<digest>
{S2 output}
</digest>
```

**Reconciliation**:
```
Below are two views of the project's modules. Produce a final reconciled list
that captures the right granularity — neither too fine (one spec per file) nor
too coarse (one spec for the whole project). 3-10 specs is typical.

For each final module, output YAML with id, paths, charter.

<structural>
{A output}
</structural>
<responsibility>
{B output}
</responsibility>
```

Final list stored in Agent working memory. Not written to disk yet.

### S5. Parallel spec drafting

For each module from S4, in parallel:

```
You are writing the Living Spec for the module "<id>" in this project.

Context:
  Northstar: {content of docs/northstar.md}
  Module charter: <charter from S4>
  Module covers paths: <paths from S4>
  Project digest: {S2 output}
  Code samples: <read the first ~3000 lines under covers.paths to ground the spec>

Write docs/spec/<id>.md. Structure:
  ---
  id: spec-<id>
  type: living_spec
  status: active
  covers:
    paths:
      - ...
  ---
  # <human-friendly title>

  ## Purpose
  <1 paragraph>

  ## Boundaries
  - <what this module owns vs. what is outside>

  ## Constraints
  - <hard rules: naming conventions, architectural patterns, "must / must not"
    statements>

  ## Open Questions
  - <areas where the code is ambiguous or the spec is uncertain — these will
    become S7 chores>

CRITICAL self-check: re-read your draft. Is it a CONTRACT (describing rules,
boundaries, constraints) or a PARAPHRASE of the code (just renaming what the
code does in prose)? If it's a paraphrase, rewrite. The spec should constrain
future code, not describe present code.

Output the complete final spec.
```

Write to `docs/spec/<id>.md`. After all parallel drafts complete, commit:

```
git add docs/spec
git commit -m "docdoki adopt S5: spec drafts"
```

**Partial-failure handling**: if any draft fails (LLM timeout, parse error), retry once. If still fails, abort the entire adopt — partial spec coverage is worse than no spec coverage.

### S6. Cross-spec consistency

```
Below are all the Living Specs drafted for this project. Read them together
and identify:
- Direct contradictions between specs
- Boundary overlaps (two specs claiming the same code paths)
- Coverage gaps (code paths in S4's module list but not in any spec)
- Naming convention conflicts (e.g., one spec mandates camelCase, another
  mandates snake_case for the same kind of identifier)

For each issue, output a YAML object with:
  issue_type: contradiction | overlap | gap | naming_conflict
  affected_specs: [...]
  description: ...
  proposed_fix: <a concrete edit to one or more specs>

If no issues, output empty list.

<specs>
{concatenated specs}
</specs>
```

If issues are non-empty, apply each `proposed_fix` by editing the relevant spec file directly. Commit:

```
git add docs/spec
git commit -m "docdoki adopt S6: cross-spec reconciliation"
```

If S6 produced no edits, skip the commit (an empty commit hides nothing of interest).

### S7. Auto-challenge

For each spec under `docs/spec/`, in parallel, run a challenge:

```
You are auditing whether the code matches this Living Spec.

Spec:
{content of docs/spec/<id>.md}

Code (under covers.paths):
{relevant code}

Output structured YAML:
  verdict: pass | fail | uncertain
  resolution: code_change | doc_change | human_decision   # required when verdict=fail
  violations:
    - clause: "Spec section X — exact rule"
      code: file:line
      nature: boundary | naming | other
  notes: |
    rationale
```

Allocate one challenge report filename via `scripts/allocate_challenge_report.py`. Write all results into that one file (one section per spec, using the standard report schema from `references/schemas.md`).

For each `fail` or `uncertain` verdict, append a chore to `chores.md` so the next iteration's garden / human review picks it up:

```markdown
- [ ] [chore-<crypto-id>] **[adopt-bootstrap]** YYYY-MM-DD owner:agent impact:major target:spec-<id> — S7 audit found drift (verdict=<v>, resolution=<r>): <one-line summary>
```

During adopt, **do not** auto-stage spec edits even when the LLM emits `resolution: doc_change`. Adopt is a one-shot bootstrap; landing speculative spec rewrites alongside the first generation would couple two unrelated decisions. Always defer to a post-adopt `garden` / human pass via the chore line.

Commit:

```
git add docs/challenge docs/chores.md
git commit -m "docdoki adopt S7: auto-challenge"
```

### S8. Active todo inference

```
Look at this project's recent git activity and uncommitted changes.

  git log -10 --stat:
  {output}

  git diff HEAD (uncommitted):
  {output}

  git diff origin/<default-branch>..HEAD (unmerged):
  {output}

Based on this evidence, what is the developer currently working on? If there
is a clear focus, output:
  current_focus: <one phrase>
  evidence: <2-3 bullets citing specific commits or files>
  confidence: high | medium | low

If there is no clear signal (recent activity is scattered or stale), output:
  current_focus: none_detected
  confidence: low
```

If `current_focus != none_detected` and `confidence != low`, write `docs/todo/active_<kebab-case-of-focus>.md`:
```markdown
# <Focus phrase>

## Stage Description
<one paragraph based on evidence>

## Tasks
- [ ] <inferred from recent unfinished commits or open todos in code>
- [ ] <...>
```

Otherwise write `docs/todo/active_general.md`:
```markdown
# General development

## Stage Description
No specific focus detected at adopt time. Update this file with the current task before running `docdoki go`.

## Tasks
- [ ] Update this active todo with the current focus.
```

Commit:

```
git add docs/todo
git commit -m "docdoki adopt S8: active todo"
```

### S9. Static check

Run `scripts/check_static.py` over the whole `docs/` tree. Capture exit code and output.

- Exit code 0 → proceed to S10.
- Exit code != 0 → **treat as stage failure**. Print errors to stdout, retain the adopt branch, do **not** merge. Producing invalid generated docs and then declaring "adopt complete" is silent corruption; if a user explicitly wants to bypass static errors, they should manually inspect the adopt branch and cherry-pick.

### S10. Atomic merge

1. Switch back to original branch: `git switch "${original_branch}"`.
2. Squash-merge the adopt branch as a single commit:
   ```
   git merge --squash "${adopt_branch}"
   git commit -m "docdoki: adopt project"
   ```
3. Delete the adopt branch: `git branch -D "${adopt_branch}"`.
4. Print `docdoki status` output as the final report, plus an "adopt summary":
   ```
   docdoki adopt complete.

   Created:
     - docs/northstar.md
     - docs/spec/*.md (N specs)
     - docs/challenge/<latest report> (M targets: P pass / F fail / U uncertain)
     - docs/chores.md (K chores logged from S7)
     - docs/todo/active_*.md (focus: X, confidence: Y)

   Next:
     - Review docs/northstar.md (the most-likely place for inference errors)
     - Run `docdoki garden` to process the S7-generated chores
     - Run `docdoki go` when ready to start the next iteration
   ```

## Failure handling at any stage

If any stage fails (LLM error after retry, file write error, git error, S9 static-check error):

1. **Do not** switch back to original branch.
2. **Do not** delete the adopt branch.
3. Print (with `${original_branch}` substituted to the recorded value, **not** hard-coded):
   ```
   docdoki adopt failed at stage S<N>: <reason>

   Adopt branch retained: ${adopt_branch}
   Inspect with:
     git log "${adopt_branch}"
     git diff "${original_branch}".."${adopt_branch}"

   Options:
     - Manually fix and `git commit` then `git merge --squash "${adopt_branch}"` on your "${original_branch}" branch
     - Discard: `git branch -D "${adopt_branch}"` and rerun adopt
   ```
4. Exit non-zero.
