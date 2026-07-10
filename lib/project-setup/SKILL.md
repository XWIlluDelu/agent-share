---
name: project-setup
description: "Set up or update project-level agent assets from .agent-share: shared skills, target-platform discovery links, selected agent fragments, generated AGENTS.md, and only the instruction aliases required by the target agents. Use whenever the user mentions setting up or updating a repo for coding agents, linking shared skills, syncing AGENTS.md, adding project agent instructions, or preparing a project for Claude, Codex, Gemini, Qwen, Copilot, OpenCode, Windsurf, or Pi."
---

# Project Setup

Set up or update a repository to use shared `.agent-share` skills and agent
instructions.

## Boundaries

- Treat `~/.agent-share` as the read-only source library during project setup.
- Write only target-project agent assets: `.agents/skills/`, requested
  platform discovery links, `.agents/fragments/`, vendored external-skill
  `.source.yaml` files, `AGENTS.md`, and requested instruction aliases or
  platform rule files. Do not use this skill to maintain `.agent-share`; that
  belongs to `skill-manager`.
- Prefer relative symlinks. Skip and report existing real files or unexpected
  symlinks instead of overwriting user customizations.
- Add incrementally; remove or replace existing project assets only when the
  user requests it.
- When linking shared skills into a project, skip manifest entries with `pack:
  always-on` unless explicitly requested; they are already globally available.

## Target agents and shared skills

Use `~/.agent-share/manifest.yaml` and `~/.agent-share/lib/*/SKILL.md`. Use the
agents the user named. If none were named, infer targets only from unambiguous
repository evidence such as existing agent configuration and report that
inference; otherwise ask before creating platform-specific files.

Keep one canonical project skill set under `.agents/skills/`:

- Link only explicitly requested skill names or packs; never link every
  non-`always-on` manifest entry by default.
- Create `.agents/skills/<name> -> <relative path to
  ~/.agent-share/lib/<name>>`.
- Existing expected symlink: leave unchanged. Existing nonmatching path: skip
  and report.
- `.agents/skills/` is discovered directly by Pi, Codex, Gemini CLI,
  OpenCode, and GitHub Copilot. When Claude Code is a target, also create
  `.claude/skills/<name> -> ../../.agents/skills/<name>`. When Qwen Code is a
  target, also create `.qwen/skills/<name> -> ../../.agents/skills/<name>`.
  When Windsurf is a target, create
  `.windsurf/skills/<name> -> ../../.agents/skills/<name>`. Create only the
  requested platform bridges, preserve existing platform-owned content, and
  skip conflicts.
- Do not claim skill discovery for a target whose current official client does
  not expose a compatible project skill root. Instruction-file support and
  skill discovery are separate capabilities.

## External skills

Use external sources only when the user explicitly requests an external
repository or URL.

1. Resolve a Git source to a commit SHA; record a requested tag or branch only
   as provenance, never as the immutable identity. For an archive without a
   commit identity, compute a SHA-256 digest. If neither can be established,
   stop unless the user explicitly accepts a mutable source.
2. Inspect `SKILL.md`, referenced scripts or executables, and symlinks from the
   exact resolved tree that will be vendored. Stop on secret collection,
   unexplained network execution, destructive behavior, or content outside the
   stated purpose. For GitHub sources, prefer `gh skill preview
   <owner>/<repo> <skill>@<commit-sha>` when available.
3. Vendor the reviewed skill under `.agents/skills/<name>/` and require a valid
   `SKILL.md`.
4. Write `.agents/skills/<name>/.source.yaml` with source URL and path, requested
   ref when applicable, resolved commit SHA or archive digest, install time,
   reason, reviewed executable paths, and license when available.
5. Add only the target-platform discovery bridges requested above.

## Agent fragments

Shared fragments live under:

```text
~/.agent-share/agents-fragments/AGENT-*.md
```

Choose fragments from that directory based on the user request and lightweight
project context (`README*`, manifests, existing agent docs). Use no fragment by
default if none fits; an empty fragment set is valid when the request is
skills-only. Then create links under the target project's fragment directory:

```text
.agents/fragments/AGENT-<NAME>.md -> <relative path to ~/.agent-share/agents-fragments/AGENT-<NAME>.md>
```

Prefer this directory layout over root-level `AGENT-*.md` links. If an older
project already has expected root-level `AGENT-*.md` symlinks, migrate them into
`.agents/fragments/` when the user requests a setup update and no conflict
exists; otherwise skip and report the migration plan. If the target path is
`.agent-share`, stop and use `skill-manager` instead; `.agent-share` itself
should keep only its own root `AGENTS.md`, with no root `AGENT-*.md` or alias
files.

For a skills-only request with no instruction update, skip `AGENTS.md`
generation and leave any existing instruction file unchanged. Create a native
instruction alias only when a nonempty `AGENTS.md` already exists; never create
a marker-only instruction file.

## Build `AGENTS.md`

A generated file starts with this exact ownership marker:

```md
<!-- generated by project-setup; edit .agents/fragments, not this file -->
```

Generate the target project's `AGENTS.md` by concatenating linked
`.agents/fragments/AGENT-*.md` files in this order:

1. core persona / collaboration rules (`core`, `orthodox`, `general`, `base`)
2. project/process rules (`project`, `workflow`, `ops`, `security`)
3. domain profiles (`research`, `science`, `product`, etc.)
4. tool/runtime notes (`pi`, `claude`, `codex`, `gemini`, etc.)
5. everything else alphabetically by filename

When a fragment fits multiple tiers, use the most specific tier. Wrap each
fragment with boundary comments naming its `.agents/fragments/...` source.
Rebuild marker-owned `AGENTS.md` from the current fragment contents on every
setup update, even when the link set did not change. If the first nonblank line
is not the exact marker, treat the file as handwritten: do not overwrite it
unless the user asks; report the migration plan. Root-level `AGENT-*.md` files
are legacy inputs only: do not create new ones, and do not include them in
generation unless the project has not yet been migrated and
`.agents/fragments/` is empty.

## Instruction aliases

Create aliases only for target agents that need a native instruction filename:

```text
CLAUDE.md -> AGENTS.md  # Claude Code
GEMINI.md -> AGENTS.md  # Gemini CLI
```

Codex, Qwen Code, GitHub Copilot agents, OpenCode, Windsurf, and Pi read
`AGENTS.md` directly; do not create `CODEX.md`, `QWEN.md`, `Copilot.md`, or
other aliases they do not need. Current official client behavior overrides this
list when it changes. Skip and report every existing real file or nonmatching
symlink.

Do not create different-format rule systems by default: Cursor uses
`.cursor/rules/*.mdc`, GitHub Copilot repo-wide instructions use
`.github/copilot-instructions.md`, Cline uses `.clinerules/`, Continue uses
`.continue/rules`, Amazon Q uses project rules, Windsurf has `.windsurf/rules/`
plus `AGENTS.md` discovery, and Claude Code Review can use review-specific
`REVIEW.md`. Configure those only on explicit request.

## Validation and report

Before reporting completion, verify:

- every new skill, fragment, platform bridge, and alias symlink resolves to the
  exact expected target;
- marker-owned `AGENTS.md` equals the current fragments in the declared order,
  including only the fixed marker and boundary comments outside fragment text;
- a second generation pass produces no diff;
- skipped conflicts and handwritten files are byte-unchanged.

Report installed canonical and platform skill links, linked fragments,
generated `AGENTS.md`, instruction aliases, external provenance, validation
result, skipped conflicts, and missing requested items.
