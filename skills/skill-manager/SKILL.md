---
name: skill-manager
description: 'Manage a local skill library and its upstream/source registry (sources.yaml): check drift vs. upstream, sync updates, audit/replace hardcoded models, swap providers, inspect API-key/service status, clone upstream repos, register/remove skills. Use for library-wide maintenance, not per-skill tweaks. Triggers: check skill updates, update skill, audit models, replace/migrate model, swap provider, check API keys, clone sources, skill status, skill 来源, 更新 skill, 换模型, 检查 API key, 更新上游源.'
allowed-tools: Bash(*), Read, Write, Edit, Grep, Glob, WebSearch
---

# Skill Manager

Manage a local skill library: upstream updates, model auditing, provider/model replacement, and source tracking.

Default conventions:
- Source registry: the `sources.yaml` bundled with this skill, or the registry path explicitly provided by the user
- Installed skills root: the current agent's local skills directory, or an explicitly provided shared canonical library such as `~/.agent-share/skills/`

If the user does not specify paths, infer them from context:
- Claude Code typically uses `~/.claude/skills/`
- Shared canonical installs may live in `~/.agent-share/skills/`
- Codex and shared installs often use `.agents/skills/` or `~/.agents/skills/`
- Gemini projects may also expose skills through `.agents/skills/`

When the user is maintaining the canonical shared library rather than an agent-local mount, prefer:

- Registry: `~/.agent-share/skills/skill-manager/sources.yaml`
- Skill root: `~/.agent-share/skills/`

Always state which registry file and skill root you are using before making changes.

## Commands

Usage: `/skill-manager <command> [args]` or equivalent natural-language request. If no command is given, run **status**.

---

### `status`

Show a full overview of the installed library.

1. Read the active `sources.yaml`.
2. For each installed skill, show: name | source type | modified (yes/no) | model references (if any).
3. Print a summary: total skills, how many modified, how many have model references.
4. Report any registry entries whose local skill folder is missing, and any local skill folders missing from the registry.

---

### `check-updates [skill-name]`

Diff installed skill(s) against their upstream source.

For each skill (or the named skill):
1. Read `source` from `sources.yaml`. If it contains placeholders such as `{anthropic}` or `{community}`, resolve them using `base_paths`.
2. Confirm the source exists on disk.
3. Compare the local skill directory with the source directory, not just `SKILL.md`. Include `scripts/`, `references/`, `assets/`, and `agents/` if present.
4. Classify the result:
   - **Up to date**: no diff
   - **Upstream changed** + `modified: false`: safe to auto-sync
   - **Upstream changed** + `modified: true`: requires manual merge
   - **Source declared but not cloned locally**: report clearly and skip sync
   - **Custom (no upstream)**: skip, note as untracked
5. Print a report grouped by category.

If the source path does not exist locally, do not error out. Report it explicitly as **Source declared but not cloned locally**.

---

### `update <skill-name>`

Apply upstream changes to a single skill.

1. Run `check-updates <skill-name>` first.
2. If **up to date**, report and stop.
3. If **upstream changed** + `modified: false`:
   - Show the diff summary.
   - Confirm with the user before copying files over.
   - Sync the full skill directory contents that exist upstream.
4. If **upstream changed** + `modified: true`:
   - Show the upstream diff and the local `modifications` list from `sources.yaml`.
   - Do not auto-overwrite.
   - Walk through each upstream change and decide whether to apply, skip, or adapt it.
   - Update the `modifications` list if the local patch set changes.

Never overwrite a modified skill silently.

---

### `audit-models`

Find hardcoded model names or provider strings across installed skills.

1. Search SKILLs, scripts, references, and agent metadata for strings such as:
   - `gpt-`
   - `o1`, `o3`, `o4`, `o5`
   - `gemini`
   - `claude-`
   - `openai/`, `google/`, `anthropic/`, `openrouter`
2. Also read structured `models:` entries from `sources.yaml`.
3. Output: Skill | File:Line | Model/Provider string | Auth method | Env key.

Prefer `rg` for this search.

---

### `set-model <old-model> <new-model> [--skill <name>]`

Replace a model name across all skills, or a single skill.

1. Run `audit-models` first.
2. Show all matches with file:line context.
3. If `--skill` is given, restrict the change to that skill.
4. For each match:
   - If the skill has `modified: false`, mark it modified and record the change in `sources.yaml`.
   - If already `modified: true`, just edit the files.
5. Update `models:` entries in `sources.yaml` to reflect the new model.
6. Report all changed files.

---

### `swap-provider <skill-name>`

Change the model/API provider for a skill.

1. Read the skill's current `models:` entries from `sources.yaml`.
2. Show current provider, model name, auth method, and env key.
3. Read the user's requested provider/model/env-key change.
4. Search the skill directory for provider-specific strings and auth references.
5. Apply replacements carefully in SKILLs, scripts, and metadata.
6. Update the structured `models:` entry in `sources.yaml`.
7. If the env key changed, remind the user to update their environment configuration.

---

### `add <skill-name> <source-path> [--modified]`

Register a new skill in `sources.yaml`.

1. Add a new entry under `skills:`.
2. Set `modified: false` by default, or `true` if explicitly requested.
3. Scan the skill for model/provider references and populate `models:` if found.
4. Note any runtime dependencies or local patches if they are obvious from the skill contents.

---

### `remove <skill-name>`

Remove a skill from the library and registry.

1. Confirm with the user.
2. Remove the skill directory from the active skill root.
3. Remove its registry entry from `sources.yaml`.
4. Do not remove any upstream source repo.

---

### `check-services`

Inventory all external services and API keys required by the installed skill library.

1. Collect service requirements from two sources:
   - Structured `models:` and `services:` entries in `sources.yaml`
   - Grep for env var patterns in all SKILL.md and scripts: `[A-Z_]+_API_KEY`, `OPENROUTER`, `export.*KEY`, `os.environ`
2. Deduplicate and group by env key.
3. For each required key, check whether it is currently set: `printenv <KEY>` (show only set/unset, never the value).
4. Output a table: Service | Required by | Env key | Status (set / unset)
5. Optionally, for HTTP-based services where a lightweight check is safe (Semantic Scholar, OpenRouter), offer to run a `curl` health-check with the key — ask the user before doing so.

---

### `clone-sources [source-name]`

Bootstrap or refresh upstream source repos using the `source_repos:` section of `sources.yaml`.

1. Read all entries from `source_repos:` in the active `sources.yaml`.
2. If `source-name` is given, clone/pull only that entry. Otherwise process all.
3. For each entry:
   - If `url` is null: report as "no upstream URL, skipping".
   - If the target `path` does not exist: run `git clone <url> <path>`.
   - If the target `path` exists and is a git repo: run `git -C <path> pull --ff-only`.
   - If the target `path` exists but is not a git repo: warn and skip.
4. After cloning, report which repos were cloned, updated, or skipped.
5. Do not delete existing clones — only add or fast-forward.

---

### `migrate-model <old-model> <new-model> [--skill <name>] [--dry-run]`

Replace a model name across skills with safety checks.

1. Run `audit-models` first and show all matches for `old-model`.
2. If `--skill` is given, restrict to that skill.
3. For each match, show file:line with surrounding context.
4. If `--dry-run`: print what would change and stop.
5. Otherwise confirm with the user, then:
   - Edit files to replace `old-model` with `new-model`.
   - If the skill had `modified: false`, mark it `modified: true` and add a modification entry.
   - Update `models:` entries in `sources.yaml`.
6. Optionally do a web lookup to confirm the new model is available on the declared provider.
7. If the env key changes (e.g. provider switch), flag it explicitly and remind the user to update their environment.

---

## Key Rules

- Never auto-overwrite a modified skill.
- Always update `sources.yaml` when a skill is installed, updated, modified, or removed.
- Treat `sources.yaml` as the ground truth for source paths and modification status.
- When comparing with upstream, consider the whole skill directory, not just `SKILL.md`.
- When running `check-updates` on K-Dense skills, ignore missing `generate_schematic*.py` files — these are intentionally omitted (see K-Dense bundling note in `sources.yaml`).
- Use web lookup only when the user wants a current recommendation about newer model versions or providers.
- Never print API key values. Only report set / unset status.
