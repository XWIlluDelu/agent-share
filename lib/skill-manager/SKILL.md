---
name: skill-manager
description: "Maintain the local .agent-share skill library: source sync, skill lifecycle, manifest provenance/packs, canonical lib copies, always-on links, agent fragments, and consistency audits. Use for any .agent-share or registry mutation. Skill-creator supplies the authoring/evaluation method; skill-manager owns writes, provenance, materialization, and final audit."
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
4. For mutations, remove stale debris created by that operation. An audit is
   read-only: report inconsistencies without repairing links, syncing sources,
   installing dependencies, or generating files.
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
- `manifest.yaml`: the sole registry for name, pack, source URL/path, the full
  `source_commit` used by each upstream-backed skill, and normalization intent
  (`notes`). Custom skills have no `source_commit`; this repository's Git
  history records their versions. `sources/` HEAD is a cache state, not the
  installed version.

## Rules

- Mutate the narrowest layer that owns the requested change.
- Edit `lib/`, not `sources/`, unless syncing upstream.
- Keep `lib/` pure: one flat directory per skill, no pack folders or non-skill
  support directories.
- Keep reusable agent fragments in top-level `agents-fragments/`, not `lib/`.
- Update `manifest.yaml` before or with changes that alter provenance, pack
  membership, naming, or normalization intent.
- Use relative symlinks in `skills/`. Resolve bundled resources from the
  canonical skill directory, not the runtime link's lexical parent or the
  caller's working directory. Project skill roots use `.agents/skills/`.
- Do not copy always-on skills into runtime roots; link roots or entries to
  `~/.agent-share/skills`.
- Do not create side registries, trash files, transitional docs, compatibility
  copies, or duplicate registries unless explicitly requested.
- Remove stale debris within the maintenance scope; leave the library cleaner.

## Workflows

### Audit runtime activation

1. Read `pack: always-on` names from `manifest.yaml` and compare them with
   `skills/`.
2. Inspect roots already in use, not every root an installed agent supports.
   Known shared-standard roots include `~/.agents/skills` for Codex, Pi, Gemini CLI, OpenCode, and GitHub
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
5. Do not create roots for absent agents or add parallel shared/platform roots
   merely for naming consistency; discovery may duplicate skills. Retain working
   activation paths. Change them only when requested or needed to fix a verified
   discovery gap, rather than relying on every client to deduplicate links.
6. Skip and report real files or nonmatching symlinks.
7. Run the audit checklist.

### Sync upstream

1. Read each affected entry's `source_commit` and `notes`. Compare that exact
   upstream tree with `lib/<name>` to identify the current local delta. Notes
   define intent; a diff is evidence, not permission to preserve every change.
   If the recorded baseline is missing, establish it from Git history and
   source evidence before replacing content; do not assume current cache HEAD.
2. Verify the source checkout is clean and its remote matches the manifest.
   Fetch, resolve the requested ref (otherwise the upstream default branch)
   to a full commit, and inspect changes to the selected paths. Fast-forward
   clean checkouts; do not reset dirty or diverged branches. A missing or moved
   source path needs investigation, not deletion of its maintained skill.
3. Review changed instructions, scripts, dependencies, links, and licensing
   before executing new upstream code. Only update registered skills, not
   newly discovered neighbors. Preserve local-only distribution restrictions.
4. Build a fresh candidate outside `lib/` from the selected tracked tree at
   that exact commit, preserving dotfiles, file modes, and symlinks. Exclude
   repository internals such as `.git` and runtime caches. Do not edit
   `sources/` to normalize content.
5. Reapply the local normalizations that still serve the skill's intended
   use. Retire a patch when its purpose no longer applies or upstream already
   fulfills it. Review the candidate's diff against the new pin and record
   the remaining adaptations in the manifest.
6. Check changed entry points and plausible failure modes. Use focused bundled
   tests when they cover those changes. Replace the entire skill directory
   when the checked candidate is ready and the captured local copy is still
   current. Skip replacement if the incoming tree is identical.
7. Record `source_commit` with the accepted content, including when a new
   commit has the same selected tree. A fetch alone never advances this field.
   Per-skill commits allow partial updates without mislabeling other entries.
8. Run the audit checklist. Remove temporary staging/backup files after
   success; do not store generated diffs or a second patch registry in the repo.

### Add skill

1. Ensure the user already chose the skill.
2. Add/update source repo if needed.
3. Resolve and review an exact upstream commit. Add manifest entry: `name`,
   `pack`, `source_repo`, `source_path`, full `source_commit`, optional `notes`.
4. Materialize the reviewed tracked tree into `lib/<name>/`, preserving files,
   modes, symlinks but not repository internals or runtime caches.
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
   `skills/<new-name> -> ../lib/<new-name>`. Note affected per-skill links in
   known runtime roots (roots linked as a directory to `~/.agent-share/skills`
   follow automatically); if runtime sync is in scope, migrate those per-skill
   links as well.
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

Use the default audit after modifying the library. It checks registry
consistency, skill metadata, canonical skill directories, and discovery links.
Add `--runtime <existing-skill-root>` when checking an affected runtime.
Use a Python environment containing PyYAML.

```bash
python3 -B lib/skill-manager/scripts/audit.py
```

For an upstream update, review the candidate against the affected pins and
normalization notes during the update workflow. Use `--sources` for a
library-wide provenance audit. It compares the recorded Git trees with
`lib/` bytes, executable bits, and symlink targets. Review reported differences
against the intent in the notes. Check the remote and worktree cleanliness
before fetching or moving a checkout in the sync workflow.

Run maintenance tests that cover changed audit or packaging behavior. Keep
one-off comparisons and reproduction checks temporary.

## Completion report

Report only:

- Changed paths
- Audit result
- Unresolved inconsistency requiring a user decision
