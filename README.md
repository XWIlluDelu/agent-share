# my-dot-agent

Personal shared configuration for coding agents.

This repo is the canonical home for my cross-agent setup: one shared global instruction file, one shared custom skill library, and lightweight metadata for keeping the library maintainable over time.

It is designed for:

- Claude Code
- Codex
- Gemini CLI

Gemini CLI is included as a target for the shared library, but its compatibility has not yet been validated as systematically as Claude Code and Codex.

## What Lives Here

- `AGENTS.md`
  Shared global preferences and working style.
- `skills/`
  Shared custom skill library.
- `skills/skill-manager/sources.yaml`
  Machine-readable source registry for the skill library.
- `skills/README.md`
  Human-readable inventory and maintenance notes.

## Design

The repo follows a simple rule:

- keep one canonical copy of shared agent instructions
- keep one canonical copy of custom skills
- keep agent-native runtime settings outside this repo

In practice, this means:

- shared content lives here
- Claude/Codex-specific runtime files stay in `~/.claude` or `~/.codex`
- custom skills should be edited here, not in per-agent copies

## Layout

```text
.
├── AGENTS.md
└── skills/
    ├── README.md
    ├── skill-manager/
    └── ...
```

## Usage

Clone this repo to a stable local path such as:

```bash
git clone git@github.com:XWIlluDelu/my-dot-agent.git ~/.agent-share
```

Then point each agent at the shared files with symlinks or thin adapters.

Typical pattern:

- Claude Code reads shared instructions from `AGENTS.md` and shared custom skills from `skills/`
- Codex reads shared instructions from `AGENTS.md` and shared custom skills from `skills/`, while keeping its built-in system skills intact
- Gemini CLI can also point at the same shared instructions and skill library, though its support is less thoroughly verified

## Maintenance

When updating the library:

- edit shared instructions in `AGENTS.md`
- edit custom skills only inside `skills/`
- track upstream provenance and local modifications in `skills/skill-manager/sources.yaml`
- prefer cross-agent skill bodies over agent-specific forks when possible

## Scope

This repo intentionally stores only shared, reusable configuration.

It does not try to version:

- auth state
- history or sessions
- caches
- other agent-specific runtime state
