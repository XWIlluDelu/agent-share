---
scope:
  - panel/**
  - docdoki/specs/panel.md
---

# Panel polish

## Objective

Keep the panel aligned with the document model while avoiding panel-owned project facts.

## Current state

- Working: panel edits write back into documents.
- Modified files: `panel/panel.py`, `docdoki/specs/panel.md`.
- 09:12 tried a blue footer tint, then changed it back.
- 09:27 user wondered about purple, then preferred steel again.
- 09:41 reran the same selftest because the terminal scrollback was lost.

## Decisions

- Runtime drag positions are not persisted because layout is view state, not project truth.

## Dead ends

- ❌ Persist drag positions in spec frontmatter — failed because it creates panel-owned project facts and makes the panel a second schema.

## Handoff

Continue by grooming this stage: keep the real layout lesson, discard process residue and preference wavering.
