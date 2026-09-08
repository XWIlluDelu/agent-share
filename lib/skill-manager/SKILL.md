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
5. Reapply only the intentional local normalizations to the candidate. Retire
   a patch when upstream already fulfills its purpose; adapt it when upstream
   changed the implementation. Do not copy old files over new upstream files
   or apply a historical patch blindly. Update notes to describe the remaining
   intent and affected resources, not a log of edits.
6. Validate the candidate and inspect its remaining upstream diff. Replace the
   old `lib/<name>` only after it passes and the captured local copy is still
   current; keep a temporary backup until final audit. This is replacement,
   not an overlay that leaves deleted upstream files behind. No-change trees
   need no file replacement.
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
completion. Use a Python environment containing PyYAML:

```bash
python3 -B lib/skill-manager/scripts/audit.py
python3 -B lib/skill-manager/scripts/audit.py --sources
# Add --runtime <existing-skill-root> for each runtime in the requested scope.
```

The default audit needs no source clones or network. `--sources` checks existing
clones and compares each pinned tree, including bytes, executable bits, and
symlink targets. It lists local differences and rejects undocumented ones;
nonempty notes do not prove a diff is intentional. Review that correspondence
and behavior separately. Neither command repairs anything.

- Manifest parses without duplicate keys; skill names are unique.
- Every manifest skill has `lib/<name>/SKILL.md`.
- Every touched skill passes the library audit. It reuses the bundled basic
  validator with a process-local allow-list extension for the boolean
  `disable-model-invocation` supported by Pi and Claude Code, without modifying
  bundled validator files. Keep this native invocation control; do not replace
  it with prose merely to pass a narrower checker. The audit also enforces
  non-empty `name` and `description` plus `name == <name>`.
- Every source-backed entry records a full `source_commit` containing
  `<source_path>/SKILL.md`; verify through the source cache for upstream work.
  Custom entries resolve locally. Missing clones are not a default audit
  failure; a missing canonical skill is, including ignored local-only skills.
- `agents-fragments/` contains only reusable `AGENT-*.md` fragments.
- `skills/` contains only relative symlinks for `pack: always-on` entries.
- Each always-on symlink target is exactly `../lib/<name>`.
- Requested live runtime roots expose every `pack: always-on` skill through
  relative links or a directory link to `~/.agent-share/skills/`, while
  preserving platform-owned payload and treating legacy roots as compatibility
  surfaces rather than current authority.
- Touched upstream repos are clean after local normalization.
- Source-backed replacements started from the exact recorded upstream tree,
  then only documented local normalization was reapplied. Accepted candidates
  were validated before replacing live content.
- Remaining upstream-to-lib diffs are documented in `manifest.yaml.notes`.
- Normalization changed only `lib/`, not `sources/`.
- No stale docs, duplicate registries, old names, or setup debris remain.

## Completion report

Report only:

- Changed paths
- Audit result
- Unresolved inconsistency requiring a user decision
