---
name: skill-manager
description: "Own mutations to the local .agent-share skill library: sync upstream sources, add/update/delete/rename shared skills, manage manifest provenance and packs, normalize lib copies, materialize always-on symlinks, maintain agent fragments, and audit consistency. Use whenever .agent-share itself or its registry is modified. For skill content quality, triggering, or evaluation, apply skill-creator as the authoring method while this skill remains the write/provenance/audit owner."
---

# Skill Manager

Maintain `.agent-share` skill assets. Execute the user's requested maintenance
operation; do not use this skill for ordinary project work or for deciding
whether a skill should exist.

## Execution model

1. Identify the requested maintenance operation: sync upstream, add skill, add
   custom/local skill, delete skill, modify skill, rename skill, change pack,
   edit agent fragment, or audit.
2. Inspect only the files needed for that operation: usually `manifest.yaml`,
   the relevant `lib/<skill>/`, `sources/<repo>/<path>/`, `skills/`, and
   affected `agents-fragments/`.
3. Apply the matching workflow below. Do not mix workflows unless the user
   requested a compound change.
4. Delete stale generated debris, obsolete names, broken symlinks, and abandoned
   transitional files created by the maintenance operation.
5. Run the audit checklist and report changed paths, audit result, and
   unresolved inconsistencies.

## Model

- `sources/`: pristine upstream repos. Sync only; no local normalization edits.
- `lib/<skill>/`: canonical maintained skill copies. Local normalization happens
  here.
- `agents-fragments/AGENT-*.md`: reusable project-instruction fragments consumed
  by `project-setup`; not skills and not manifest entries.
- `skills/<skill> -> ../lib/<skill>`: materialized view for `pack: always-on`
  only, never a second canonical copy.
- Runtime activation roots are outside this repo. They point installed agents at
  `~/.agent-share/skills/`; they never own skill content.
- `manifest.yaml`: registry for skill name, pack, source provenance, and
  normalization intent (`notes`).

## Rules

- Mutate the narrowest layer that owns the requested change.
- Edit `lib/`, not `sources/`, unless syncing upstream.
- Keep `lib/` pure: one flat directory per skill, no pack folders or non-skill
  support directories.
- Keep reusable agent fragments in top-level `agents-fragments/`, not `lib/`.
- Update `manifest.yaml` before or with changes that alter provenance, pack
  membership, naming, or normalization intent.
- Use relative symlinks in `skills/`.
- Do not copy always-on skills into runtime roots; link roots or entries to
  `~/.agent-share/skills`.
- Do not create side registries, trash files, transitional docs, compatibility
  copies, or duplicate registries unless explicitly requested.
- Remove stale debris within the maintenance scope; leave the library cleaner.

## Workflows

### Audit runtime activation

1. Read `pack: always-on` names from `manifest.yaml` and compare them with
   `skills/`.
2. Inspect only roots used by installed agents. Current shared-standard roots
   include `~/.agents/skills` for Codex, Pi, Gemini CLI, OpenCode, and GitHub
   Copilot; platform roots include `~/.pi/agent/skills`, `~/.claude/skills`,
   and `~/.qwen/skills`. Confirm live client documentation/configuration before
   changing them.
3. Treat an existing `~/.codex/skills` as a legacy or installation-specific
   root: preserve platform-owned payload such as `.system/`, but do not create
   it as the current canonical Codex root without live evidence.
4. If a runtime root has no platform-owned payload, prefer one relative
   directory symlink to `~/.agent-share/skills`. If it has platform-owned
   payload, preserve it and add per-skill relative symlinks to
   `~/.agent-share/skills/<name>`.
5. Do not create roots for absent agents. OpenCode needs no separate root when a
   compatible shared root is already active; create agent-specific roots only
   when current discovery behavior requires them.
6. Skip and report real files or nonmatching symlinks.
7. Run the audit checklist.

### Sync upstream

1. Inspect existing `manifest.yaml.notes` for every affected skill and identify
   the intended local normalizations before overwriting `lib/<name>`.
2. Pull/update the repo under `sources/`.
3. Find manifest entries using that `source_repo`/`source_path`.
4. Compare the upstream path with the current `lib/<name>` copy.
   `manifest.yaml.notes` defines the intended normalization; the diff is
   evidence only.
5. Replace `lib/<name>` from the updated upstream path: remove the old
   `lib/<name>` directory, copy `sources/<repo>/<path>/` into `lib/<name>/`, and
   preserve upstream file modes/symlinks.
6. Reapply only intentional local normalizations in `lib/<name>`; do not
   hand-merge stale upstream content back in.
7. Compare updated upstream against updated `lib/<name>` again. The remaining
   diff must be only documented local normalization.
8. Run the audit checklist.

### Add skill

1. Ensure the user already chose the skill.
2. Add/update source repo if needed.
3. Add manifest entry: `name`, `pack`, `source_repo`, `source_path`, optional
   `notes`.
4. Copy source folder to `lib/<name>/` preserving files, modes, symlinks.
5. Apply local normalizations only in `lib/<name>/`, and record their intent in
   `manifest.yaml.notes`.
6. If `pack: always-on`, create `skills/<name> -> ../lib/<name>`.
7. Run the audit checklist.

### Add custom/local skill

1. Ensure the user already chose the skill.
2. Load `skill-creator` and apply its authoring method to capability design,
   triggering, resources, and evaluation; this workflow remains the sole writer.
3. Create or update `lib/<name>/SKILL.md` and required resources.
4. Add manifest entry with `source_repo: custom`, `source_path: "lib/<name>"`,
   `pack`, and `notes` when needed.
5. If `pack: always-on`, create `skills/<name> -> ../lib/<name>`.
6. Run the audit checklist.

### Delete skill

1. Remove `skills/<name>` if present.
2. Remove manifest entry.
3. Remove `lib/<name>/`.
4. Remove source repo only if unreferenced and explicitly requested.
5. Delete stale references produced by the removed skill name.
6. Run the audit checklist.

### Modify skill

1. When the request concerns capability design, prompt quality, triggering, or
   evaluation, load `skill-creator` and use its method. This workflow still owns
   all writes, provenance, materialization, and final audit inside
   `.agent-share`.
2. Update `manifest.yaml.notes` first when the content change creates or changes
   local normalization intent.
3. Edit skill content only in `lib/<name>/`.
4. Run the audit checklist.

### Rename skill

1. Update the manifest name and any affected provenance or notes.
2. Rename `lib/<old-name>/` to `lib/<new-name>/`.
3. If the skill is `always-on`, replace `skills/<old-name>` with
   `skills/<new-name> -> ../lib/<new-name>`.
4. Remove stale references to the old name.
5. Run the audit checklist.

### Change pack

1. Update `manifest.yaml.pack`.
2. Entering `always-on`: add `skills/<name> -> ../lib/<name>`.
3. Leaving `always-on`: remove `skills/<name>`.
4. Do not create pack folders.
5. Run the audit checklist.

### Modify agent fragment

1. Edit only the relevant `agents-fragments/AGENT-*.md` file.
2. Keep the filename descriptive and stable unless the user requested a rename.
3. Do not add fragment entries to `manifest.yaml`; fragments are not skills.
4. If a fragment rename affects consumers, update target projects through
   `project-setup`, not by hand-editing generated target-project `AGENTS.md`.
5. Run the audit checklist.

## Audit checklist

Run after every workflow. If an item applies, it must pass before reporting
completion.

- Manifest parses; skill names are unique.
- Every manifest skill has `lib/<name>/SKILL.md`.
- Every touched skill passes
  `python3 lib/openai-skill-creator/scripts/quick_validate.py lib/<name>` from
  the `.agent-share` root; independently confirm non-empty `name` and
  `description` plus `name == <name>` because the bundled check is only a basic
  validator.
- Every source-backed entry has `sources/<repo>/<source_path>/SKILL.md`; custom
  entries resolve locally.
- `agents-fragments/` contains only reusable `AGENT-*.md` fragments.
- `skills/` contains only relative symlinks for `pack: always-on` entries.
- Each always-on symlink target is exactly `../lib/<name>`.
- Requested live runtime roots expose every `pack: always-on` skill through
  relative links or a directory link to `~/.agent-share/skills/`, while
  preserving platform-owned payload and treating legacy roots as compatibility
  surfaces rather than current authority.
- Touched upstream repos are clean after local normalization.
- Source-backed updates used overwrite-then-reapply: new `lib/<name>` started
  from updated `sources/<repo>/<path>`, then only documented local normalization
  was reapplied.
- Remaining upstream-to-lib diffs are documented in `manifest.yaml.notes`.
- Normalization changed only `lib/`, not `sources/`.
- No stale docs, duplicate registries, old names, or setup debris remain.

## Completion report

Report only:

- Changed paths
- Audit result
- Unresolved inconsistency requiring a user decision
