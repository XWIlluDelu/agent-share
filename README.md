# Shared agent assets

A personal, cross-agent skill library. `manifest.yaml` is the registry;
`lib/` contains the maintained assets. No package manager or background updater
is required.

## Layout

| Path | Role |
| --- | --- |
| `lib/<skill>/` | Canonical skill content; edit here |
| `manifest.yaml` | Names, packs, sources, accepted upstream commits, local modification intent |
| `sources/<repo>/` | Ignored, pristine upstream Git clones used for review and updates |
| `skills/<skill> -> ../lib/<skill>` | Global discovery view, only for `pack: always-on` |
| `agents-fragments/AGENT-*.md` | Reusable project instructions, separate from skills |
| `AGENTS.md` | Working agreement for this repository |

Packs are selection labels, not directories. Most skills are enabled per
project; global discovery stays small. Use
[`skill-manager`](lib/skill-manager/SKILL.md) to maintain this library,
[`skill-creator`](lib/skill-creator/SKILL.md) to author/evaluate skills, and
[`project-setup`](lib/project-setup/SKILL.md) to connect a target project.

## Links and activation

```text
runtime skill root ──relative link──> .agent-share/skills/
                                           └── <name> -> ../lib/<name>
project/.agents/skills/<name> ──relative link──> .agent-share/lib/<name>
project platform bridge ──relative link──> project/.agents/skills/<name>
```

`.agents/skills/` is the cross-client discovery convention described in the
[Agent Skills client guide](https://agentskills.io/client-implementation/adding-skills-support);
the skill format itself does not mandate an installation root.

Keep existing working discovery routes. Do not add a parallel global root such
as `~/.agents/skills` merely for naming consistency: clients may discover the
same skill more than once. Add or migrate an entry point only for an actual
client need.

Use a directory link for an otherwise empty runtime root. When an agent owns
other content there (for example Codex's `.system/`), keep the directory and
add per-skill links instead. Preserve existing customizations. Do not create
roots for unused agents or assume instruction-file support implies skill
discovery; `project-setup` owns the current platform-specific rules.

Links make updates immediately shared; they are not version pins or a
read-only boundary. An agent editing through a link edits this library. Resolve
bundled resources from the actual skill directory, not the caller's project.
Relative project links also depend on the surrounding checkout layout. For a
portable or frozen project, vendor a reviewed copy with provenance instead.
The creator wrapper's sibling links require the two underlying creator skills;
it is not a standalone distributable directory.

## Provenance and local changes

Each upstream-backed entry records `source_repo`, `source_path`, and a full
`source_commit`. That commit is the baseline actually accepted for the skill,
not the newest fetched commit. `notes` records why and where this copy differs.
Custom skills use `source_repo: custom`; their versions are in this repo's Git
history.

For an update: inspect the old baseline and local delta, fetch and review an
exact new tree, build a fresh temporary candidate, reapply only still-needed
normalizations, validate, then replace `lib/<name>` and advance its commit.
Retire patches already covered upstream. Fetching alone does not update an
installed skill. Keep this one manifest rather than a separate lockfile,
per-skill source files, or a patch queue. Detailed lifecycle procedures live
in `skill-manager`.

Cloning this repository supplies tracked `lib/` content without needing
`sources/`. Source comparison and updates require the relevant clones.
`lib/simplify/` is intentionally ignored and local-only because its upstream
has no license; materialize it from the recorded commit for local use before
auditing a fresh clone. Preserve upstream license and attribution files; the
library does not grant a blanket license over imported assets.

## Read-only checks

Use Python 3.10+ with PyYAML. Reuse an environment that has it, or create a
local one with Python and pip (environment setup is a separate write operation):

```bash
python3 -m venv --without-pip .venv
python3 -m pip --python .venv install 'PyYAML>=6,<7'
```

The audit reuses the bundled basic skill validator, adding compatibility for
boolean `disable-model-invocation` in the checker process, not its files. This
preserves explicit invocation in supporting hosts (including Pi and Claude
Code); prose remains a fallback elsewhere. The checks themselves do not fetch,
install, repair, or generate files:

```bash
.venv/bin/python -B lib/skill-manager/scripts/audit.py
.venv/bin/python -B lib/skill-manager/scripts/audit.py --sources
.venv/bin/python -B lib/skill-manager/scripts/audit.py --runtime "$HOME/.pi/agent/skills"
.venv/bin/python -B -m unittest discover -s lib/skill-manager/scripts -p 'test_*.py'
```

The source check compares bytes, executable bits, and symlink targets against
pinned Git trees. It reports normalized differences for review; it cannot
prove that prose notes authorize every changed line or that a skill performs
well. Run relevant bundled tests and inspect changed behavior as part of an
update. Audits return nonzero on structural errors and leave other runtime
payloads alone.
