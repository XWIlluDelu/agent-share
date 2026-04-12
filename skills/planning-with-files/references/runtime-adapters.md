# Runtime Adapters

`planning-with-files` is designed to work without agent-specific automation. The planning files in the project root are the canonical state.

This document only covers optional adapters that improve ergonomics.

## Codex

Codex has an official hooks mechanism. A practical setup for this skill is:

- `SessionStart`: remind the agent to read `task_plan.md`, `progress.md`, `findings.md`, and include catchup output if available
- `Stop`: remind the agent to sync planning files before ending a turn

Suggested repo-local `hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$(git rev-parse --show-toplevel)/.agents/skills/planning-with-files/scripts/codex_session_start.py\"",
            "statusMessage": "Restoring planning context"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$(git rev-parse --show-toplevel)/.agents/skills/planning-with-files/scripts/codex_stop.py\"",
            "statusMessage": "Checking planning sync"
          }
        ]
      }
    ]
  }
}
```

Typical locations:

- `~/.codex/hooks.json`
- `<repo>/.codex/hooks.json`

Notes:

- These scripts do not replace the main skill workflow.
- If your repo mounts shared skills somewhere else, adjust the script path accordingly.
- `codex_session_start.py` emits extra developer context; it does not write planning files for you.
- `codex_stop.py` emits a reminder only when planning files exist.

## Claude Code

If you already have Claude-native hooks for this workflow, you can keep them. The shared planning files stay the same:

- `task_plan.md`
- `progress.md`
- `findings.md`

The main benefit of the shared skill is that the file workflow is now portable even if the exact hook wiring differs.

## Gemini CLI

Use this skill in manual mode for now:

- initialize planning files at the start of a complex task
- read them again on resume
- update them throughout the session

The current local Gemini CLI surface exposes hook migration, but this shared skill does not yet assume a stable cross-machine Gemini hook installation path. Keep the workflow file-based rather than hook-dependent.
