# Document schemas

Exact frontmatter and body shape for every DocDoki document. Keep frontmatter to
simple shapes: scalars, inline lists `[a, b]`, and block lists.

## Contents

- northstar.md
- spec_abstract.md
- specs/*.md (+ covers)
- stages/*.md
- notes/*.md
- Filename rules

## northstar.md

The only high-threshold document. Edit it only when necessary and say why; never
weaken its intent without the human's approval.

Optional frontmatter, present only in child units:

```yaml
---
parent: ../../docdoki/northstar.md
---
```

Required sections: `## Mission`, `## Success criteria`, `## Hard constraints`.
Child units add `## Contribution` (one paragraph: how the child serves the
parent). Parent units with children add `## Units`, one link per child:

```md
## Units

- [analysis](../analysis/docdoki/northstar.md) — primary statistical analysis
```

The filesystem is the source of truth for unit discovery; `parent` and `## Units`
are human navigation links — reconcile them when they drift from the tree.

## spec_abstract.md

The human's spec review and steering surface. It is a real document, not a
generated view: a human edit to it is a design instruction you must propagate
into concrete specs and implementation, or leave as a visible mismatch. No
frontmatter — it describes how the specs fit together, not a code area.

Recommended body:

```md
# Spec abstract

## Design map

| Area | Spec | Current design | Attention |
|---|---|---|---|

## Cross-spec direction

## Review targets
```

State cross-spec direction in prose here; concrete obligations belong in the
linked specs. When the abstract and specs disagree, reconcile them or record an
open mismatch — neither silently wins. Keeping the map in step with the specs is
ordinary `follow`/`groom` work; in `Review targets` name any spec you believe has
drifted and should be challenged.

## specs/*.md

Concrete contracts for code and data areas.

```yaml
---
purpose: <one line>
covers:
  - src/auth/**
  - tests/auth/**
after: [preprocess]
---

# <Spec title>

## Goal
```

`purpose` is required. The body starts with an `# H1` title (the spec's display
name — free case, editable from the panel) followed by `## Goal`, then short
checkable claim bullets — one assertion per bullet that you can audit against
code, data, or output. Rigid WHEN/THEN syntax is deliberately absent. A claim you
have not checked against the code, flag in prose (e.g. a trailing "— not yet
checked"); never present an unchecked claim as confirmed (philosophy habit 1).

**covers** is the index into the code: which files this spec is about. It scopes a
`challenge` — to check this spec, read the code under `covers`. Globs are relative to
the unit root; `**` matches across directories, `*` within a segment, and braces
like `{a,b}` expand as shells do. Granularity is the glob, not
the symbol: a claim whose truth depends on code outside `covers` will not be found by
reading `covers` alone — widen `covers` to the surface the claim truly depends on. A spec
carrying claims should have non-empty `covers`. When you set or edit `covers`, verify the
globs match actual paths, or mark the spec as needing that fix instead of letting
`challenge` silently miss the code.

**after** is optional; it lists the specs this one follows — the pipeline edges,
kept sparse and meaningful (real dependencies, not weak links). It records a
structural fact the design map in `spec_abstract.md` states in prose; set it in
`adopt` or when the pipeline becomes clear. It does not change how a spec is audited.

**progress** is not a core field — no core procedure reads it. The panel (`panel/`)
owns it as a display state: an absent value renders as `not-started`, and an explicit
panel edit may create or change the field through write-back or `follow`. The core never
sets `progress` from code or from a guess about completion.

## stages/*.md

Active work capsules. See `references/stages.md` for the lifecycle.

```yaml
---
scope:
  - src/preprocess/**
  - src/analysis/**
---
```

`scope` is the path globs the stage touches; it drives stage selection and overlap
detection (`references/stages.md`). The protocol that opened it, the topic, and the
creation date live in the filename;
the archive move and its date live in git.

Body sections, rewritten toward current state (never appended to chronologically);
omit any that would be empty:

```md
# Primary analysis

## Objective
## Current state
## Next actions
## Decisions
## Dead ends
## Handoff
```

Section contracts:

- `Objective`: what this work stream is for; a sentence or two that also orients a
  fresh agent.
- `Current state`: `Working`, `Broken/Blocked`, and `Modified files` bullets.
  `Modified files` is the work delta, not the `scope` declaration.
- `Next actions`: prioritized checklist, including what is blocked and what unblocks it.
- `Decisions`: settled choices with their reason (and a rejected alternative when there
  was one). Omit when empty.
- `Dead ends`: failed approaches worth not retrying, in `❌ [Approach] — [why it failed]`
  form. Omit when empty.
- `Handoff`: a few sentences a fresh agent can start from.

Reusable methods, gotchas, environment notes, and references are routed to `notes`,
not kept as fixed stage sections.

## notes/*.md

Durable agent knowledge: reusable methods, gotchas, literature, commands.

```yaml
---
purpose: <one line>
---
```

Every non-obvious claim needs a source pointer: `file:line`, a URL, command
output, or a commit. Notes never hold requirements or active tasks.

## Filename rules

- Stages: `[protocol]-[topic]-[date].md`, where `protocol` is the codename of the
  protocol that opened the stage (`handoff`, `challenge`, …), `topic` is short
  kebab-case, and `date` is the creation day `YYYY-MM-DD`. The prefix records origin —
  a creation fact like the date — so `ls stages/` reads as origin and topic at a glance.
  Reuse the file for the same topic/scope; a new file means a distinct work stream.
  Active vs archived is recorded by path: active stages live in `stages/`, closed
  ones in `stages/archive/`.
- Specs and notes: `<name>.md` with a short kebab-case name; the name is the
  identifier used when challenging a spec.
