---
name: project-setup
description: "Set up or update project-level agent assets from .agent-share: shared skills, selected agent fragments, generated AGENTS.md, and alias links such as CLAUDE.md, CODEX.md, GEMINI.md, QWEN.md, and Copilot.md. Use this skill whenever the user mentions setting up or updating a repo for coding agents, linking shared skills, syncing AGENTS.md, adding project agent instructions, or preparing a project for Claude, Codex, Gemini, Qwen, Copilot, OpenCode, or Windsurf."
---

# Project Setup

Set up or update a repository to use shared `.agent-share` skills and agent instructions.

## Boundaries

- Treat `~/.agent-share` as the read-only source library during project setup.
- Write only target-project agent assets: `.agents/skills/`, `.agents/fragments/`, vendored external-skill `.source.yaml` files, `AGENTS.md`, and alias links. Do not use this skill to maintain `.agent-share`; that belongs to `skill-manager`.
- Prefer relative symlinks. Skip and report existing real files or unexpected symlinks instead of overwriting user customizations.
- Add incrementally; remove or replace existing project assets only when the user requests it.
- When linking shared skills into a project, skip manifest entries with `pack: always-on` unless explicitly requested; they are already globally available.

## Shared skills

Use `~/.agent-share/manifest.yaml` and `~/.agent-share/lib/*/SKILL.md`.

- Link only explicitly requested skill names or packs.
- For vague “set this project up” requests, propose a small context-derived set and ask or report assumptions; never link every non-`always-on` manifest entry by default.
- Local shared skill: create `.agents/skills/<name> -> <relative path to ~/.agent-share/lib/<name>>`.
- Existing expected symlink: leave unchanged.
- Existing nonmatching path: skip and report.

## External skills

Use external sources only when the user explicitly requests an external repository or URL.

- Vendor the external skill directly into the target project under `.agents/skills/<name>/`.
- Require a valid `SKILL.md`.
- Write `.agents/skills/<name>/.source.yaml` with source URL, install time, and reason.
- Do not add external skills to `~/.agent-share`; shared-library maintenance belongs to `skill-manager`.

## Agent fragments

Shared fragments live under:

```text
~/.agent-share/agents-fragments/AGENT-*.md
```

Choose fragments from that directory based on the user request and lightweight project context (`README*`, manifests, existing agent docs). Use no fragment by default if none fits; an empty fragment set is valid when the request is skills-only. Then create links under the target project's fragment directory:

```text
.agents/fragments/AGENT-<NAME>.md -> <relative path to ~/.agent-share/agents-fragments/AGENT-<NAME>.md>
```

Prefer this directory layout over root-level `AGENT-*.md` links. If an older project already has expected root-level `AGENT-*.md` symlinks, migrate them into `.agents/fragments/` when the user requests a setup update and no conflict exists; otherwise skip and report the migration plan. If the target path is `.agent-share`, stop and use `skill-manager` instead; `.agent-share` itself should keep only its own root `AGENTS.md`, with no root `AGENT-*.md` or alias files.

## Build `AGENTS.md`

Generate the target project's `AGENTS.md` by concatenating linked `.agents/fragments/AGENT-*.md` files in this order:

1. core persona / collaboration rules (`core`, `orthodox`, `general`, `base`)
2. project/process rules (`project`, `workflow`, `ops`, `security`)
3. domain profiles (`research`, `science`, `product`, etc.)
4. tool/runtime notes (`pi`, `claude`, `codex`, `gemini`, etc.)
5. everything else alphabetically by filename

When a fragment fits multiple tiers, use the most specific tier. Add lightweight boundary comments. Rebuild `AGENTS.md` whenever fragment links change. If a handwritten `AGENTS.md` exists, do not overwrite it unless the user asks; report the migration plan. Root-level `AGENT-*.md` files are legacy inputs only: do not create new ones, and do not include them in generation unless the project has not yet been migrated and `.agents/fragments/` is empty.

## Alias files

In target projects, `CLAUDE.md`, `CODEX.md`, `GEMINI.md`, `QWEN.md`, and `Copilot.md` are aliases, not separate content. By default, create them as relative symlinks to `AGENTS.md`; skip and report any conflict unless the user opts out of aliases:

```text
CLAUDE.md -> AGENTS.md
CODEX.md -> AGENTS.md
GEMINI.md -> AGENTS.md
QWEN.md -> AGENTS.md
Copilot.md -> AGENTS.md
```

Do not create different-format rule systems by default: Cursor uses `.cursor/rules/*.mdc`, GitHub Copilot repo-wide instructions use `.github/copilot-instructions.md`, Cline uses `.clinerules/`, Continue uses `.continue/rules`, Amazon Q uses project rules, Windsurf has `.windsurf/rules/` plus `AGENTS.md` discovery, and Claude Code Review can use review-specific `REVIEW.md`. Configure those only on explicit request.

## Report

Report installed skill links, linked fragments, generated `AGENTS.md`, alias links, skipped conflicts, and missing requested items.
