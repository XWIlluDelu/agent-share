# Document schemas

Exact frontmatter and body shape for every DocDoki document. Keep frontmatter to
simple shapes: scalars, inline lists `[a, b]`, and block lists. Every body opens
with an `# H1` title: the panel shows it as the document's display name and
falls back to the raw lowercase filename stem when it is missing.

## Contents

- Formatting conventions
- Visibility and private overlay
- northstar.md
- spec_abstract.md
- specs/*.md (+ covers)
- stages/*.md
- notes/*.md
- Filename rules

## Formatting conventions

These hold for every document; the per-type sections below add only what is
specific to a type. Formatting is not decoration — a malformed line makes a
claim the author did not mean, so it is a defect like any other and is fixed on
sight during `groom`.

- **Headings are sentence case.** Capitalize the first word and proper nouns
  only. A title or heading may open with an identifier in its own casing — a
  package, path, symbol, or product name keeps it (`smc_rnns repo`, `docdoki
  panel`, `numpy dtypes`). That exception is for real identifiers, not licence
  for a lowercase ordinary word: `# data acquisition` is sloppy, `# Data
  acquisition` is right.
- **One `# H1` per body, and it is the title.** No second H1 anywhere below it.
- **Fence every display code line.** A shell command, code snippet, program
  output, or standalone file path shown on its own line goes inside a
  triple-backtick fence (with a language tag where it helps); unfenced, a command
  reads as prose and a leading `#` output line reads as a heading. A name woven
  into a sentence stays inline in backticks (`train_data_a.npy`), never fenced.
- **No empty headings or empty fields.** A section heading with nothing under it
  is a promise unkept: write the content or delete the heading. Omit a
  schema-optional section entirely rather than leave its heading bare, and
  likewise omit an optional frontmatter field rather than write it empty (`after:
  []`, a blank `progress`).
- **Lists earn their place.** Use a list only for genuinely parallel items, and
  keep them parallel in grammar and terminal punctuation — all fragments or all
  sentences, not a mix. Prose is the default for anything explanatory. Use a
  table only for data that is actually tabular (rows sharing columns), and keep
  the pipes readable.

## Visibility and private overlay

Document visibility is derived only from path. The existing library root is
public; private documents live under a gitignored overlay:

```text
docdoki/private/
  specs/<name>.md
  stages/<protocol>-<topic>-<date>.md
  stages/archive/<protocol>-<topic>-<date>.md
  notes/<topic>.md
```

Private specs, stages, and notes use the same frontmatter and body schemas as
their public counterparts. Do not add a `visibility` or `private` frontmatter
field: it would duplicate the path authority without enforcing Git behavior.
`northstar.md` and `spec_abstract.md` remain the single public intent and design
surfaces; private constraints and context descend into private specs, stages,
or notes rather than creating parallel high-level authorities.

Filename stems remain unique across both scopes and archives. A private document
may use `[[stem]]` to reference a public document. A public document may not
reference a private stem or path, because the public library must remain true
when the overlay is absent. `covers` globs in private specs are still relative
to the unit root, not to `docdoki/private/`.

The unit's `.gitignore` contains `/docdoki/private/`. Verify every private file
is ignored and none is tracked by the public repository with
`scripts/check_privacy.py <unit>`. Secrets do not become document-safe merely by
being ignored: credentials, private keys, and tokens never enter this subtree.

## northstar.md

The only high-threshold document. Edit it only when necessary and say why; never
weaken its intent without the human's approval.

Optional frontmatter, present only in child units:

```yaml
---
parent: ../../docdoki/northstar.md
---
```

The body opens with `# Northstar`. Required sections: `## Mission`,
`## Success criteria`, `## Hard constraints`. `Hard constraints` are binding
limits on how the work may proceed — what must hold and what is forbidden (an
execution boundary, a licensing obligation, an invariant the design cannot
break). Repository inventory, git-tracking policy, and directory maps are not
constraints; `.gitignore` and the tree already hold them, and they do not belong
on the human's highest-threshold surface.
Child units add `## Contribution` (one paragraph: how the child serves the
parent). Parent units with children add `## Units`, one link per child:

```md
## Units

- [analysis](../analysis/docdoki/northstar.md) — primary statistical analysis
```

The filesystem is the source of truth for unit discovery; `parent` and `##
Units` are human navigation links — reconcile them when they drift from the
tree.

## spec_abstract.md

The human's spec review and steering surface. It is a real document, not a
generated view: a human edit to it is a design instruction you must propagate
into concrete specs and implementation, or leave as a visible mismatch. No
frontmatter — it describes how the specs fit together, not a code area.

Recommended body:

```md
# Spec abstract

## Design map

| Area | Spec | Design | Attention |
|---|---|---|---|

## Cross-spec direction

## Review targets
```

The map is a map, not a status board. `Design` holds the one settled design fact
that places the area for a human scanning across areas — the decision that
distinguishes it, not a re-summary of the spec (that is the spec's `purpose`) and
never live status. `Attention` holds what the human must see: an open decision, a
deviation to ratify, a spec that looks drifted. Keep live progress out of both
columns — that state is the stage's by the standing-contract rule (specs/*.md
below), and a spec's own completion shows in its `progress` field.
A cell that reads like a stage's `Current state` is the leak this table exists to
prevent.

State cross-spec direction in prose; concrete obligations belong in the linked
specs. `Cross-spec direction` and `Review targets` appear only when they carry
something — omit an empty section rather than leave a bare heading. In `Review
targets` name any spec you believe has drifted and should be challenged. When the
abstract and specs disagree, reconcile them or record an open mismatch — neither
silently wins; keeping the map in step is ordinary `follow`/`groom` work.

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

A spec is a **standing** contract: assertions true of the code as it stands, that
can be re-checked against it at any time. It is timeless — it says what holds, not
what happened or where the work is now. So a spec never carries a stage's
material: no status or progress narration, no next actions, no resume commands, no
dated or interim result tables, no run logs, no "we did X and it worked." That
content is a stage's (`Current state`, `Next actions`, `Handoff`); a spec that
grows a `## Status`, `## Pending`, `## Resume`, `## Interim results`, or an
`## Evidence`-of-one-past-run section has absorbed the stage,
and the fact now lives in two places that will disagree the moment the work
moves. A measurement earns a place in a spec only as a binding constraint the code
must satisfy (a memory ceiling, an array shape, a rate threshold), never as a
benchmark record of one run. If what you are recording is a completed activity
rather than a property of the code — a validation that passed, a download that
finished — its durable residue is a note (reusable evidence) or a stage (if the
work is in flight), not a new spec.

`purpose` is required and carries weight: the panel renders it as the spec card's
face, the few lines a reader sees before expanding the card, so it must hold the
item's highest-density summary. Write what the item is and holds — for a data
area, what was acquired, in what form, and what is missing; for an environment,
what was built and how it deviates — leading with the facts a reader most needs
and folding in the binding constraints when those are the densest information.
Keep it to what the card shows without expanding: a sentence or two, compressed
hard when it runs long, not a paragraph. It is neither a topic label that restates
the H1 title nor a bare list of constraints: the first carries no information, the
second drops the summary. The test: read the H1 title, then `purpose` — if
`purpose` told you nothing the title did not, it has not earned its bytes and
must be made denser (`purpose: mackelab/smc_rnns repo code map + paper↔code
discrepancies` earns its line under `# smc_rnns repo`; a bare restatement of the
title does not). The body starts with an `# H1` title (the spec's display
name — free case, editable from the panel) followed by `## Goal`, then short
checkable claim bullets — one assertion per bullet that you can audit against
code, data, or output. Rigid WHEN/THEN syntax is deliberately absent. A claim
you have not checked against the code, flag in prose (e.g. a trailing "— not yet
checked"); never present an unchecked claim as confirmed (philosophy habit 1).

`## Goal` is the one required section — every spec opens with it. Beyond Goal,
add only sections that carry standing contract; `## Checks` (the assertions to
audit), `## Non-goals` (what the spec deliberately excludes), and `## Sources`
(the pointers a claim rests on) recur across specs and are the recommended
names, and a domain area may add its own (`## Binding constraints`, `##
Deviations`) when the content is genuinely different rather than a renamed Goal.
Status-, progress-, and run-flavored sections are the stage's or a note's,
forbidden by the standing-contract rule above; a spec that grows one has drifted
and the `groom` pass routes it out.

**covers** is the index into the code: which files this spec is about. It scopes
a `challenge` — to check this spec, read the code under `covers`. Globs are
relative to the unit root; `**` matches across directories, `*` within a
segment, and braces like `{a,b}` expand as shells do. It indexes code and data,
not other docdoki documents — relate those with wiki-links, never by listing a
`docdoki/...` path under `covers`. Scope it to the surface the claims actually
depend on, in both directions: a claim whose truth depends on code outside
`covers` will not be found by reading `covers` — widen it; and a file the spec
makes no claim about does not belong there, since a glob that pulls in unrelated
code makes `challenge` read files it cannot judge against this spec. When the
truth a spec asserts lives off-tree — an environment installed on a remote host,
data staged elsewhere, an external service — no glob can see it: leave `covers`
at whatever code is in the tree (or empty) and state in prose the check that does
verify it (a command to run, a checksum to match), rather than a glob that
silently checks nothing. A spec carrying in-tree claims should have non-empty
`covers`. When you set or edit `covers`, verify the globs match actual paths, or
mark the spec as needing that fix instead of letting `challenge` silently miss
the code.

**after** is optional; it lists the specs this one follows — the pipeline edges,
kept sparse and meaningful (real dependencies, not weak links). It records a
structural fact the design map in `spec_abstract.md` states in prose; set it in
`adopt` or when the pipeline becomes clear. It does not change how a spec is
audited.

**progress** is the spec's one status marker, and a display state the panel
(`panel/`) owns: an absent value renders as `not-started`, and an explicit panel
edit may create or change it through write-back or `follow`. The core never sets
`progress` from code or from a guess about completion. Because it is the single
marker, a spec does not also carry a prose status section and the abstract does
not restate it — one status, one place.

## stages/*.md

Active work capsules. See `references/stages.md` for the lifecycle.

```yaml
---
scope:
  - src/preprocess/**
  - src/analysis/**
---
```

`scope` is the path globs the stage touches; it drives stage selection and
overlap detection (`references/stages.md`). The protocol that opened it, the
topic, and the creation date live in the filename; the archive move and its date
live in git.

The body opens with a short stage title (`# Primary analysis` below — the
display name; the date and protocol stay in the filename). Sections are
rewritten toward current state (never appended to chronologically); omit any
that would be empty:

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

- `Objective`: what this work stream is for; a sentence or two that also orients
  a fresh agent.
- `Current state`: `Working`, `Broken/Blocked`, and `Modified files` bullets.
  `Modified files` is the work delta, not the `scope` declaration.
- `Next actions`: prioritized checklist, including what is blocked and what
  unblocks it.
- `Decisions`: settled choices with their reason (and a rejected alternative
  when there was one). A decision that turns on a detail a spec holds points to
  that spec rather than restating it — one authority per fact. Omit when empty.
- `Dead ends`: failed approaches worth not retrying, in `❌ [Approach] — [why it
  failed]` form. Omit when empty.
- `Handoff`: a few sentences a fresh agent can start from.

Reusable methods, gotchas, environment notes, and references are routed to
`notes`, not kept as fixed stage sections.

## notes/*.md

Durable agent knowledge: reusable methods, gotchas, literature, commands.

```yaml
---
purpose: <one line>
---
```

`purpose` summarizes what the note holds and why it earns keeping, under the
same density test as a spec's `purpose` — it must out-inform the H1 title. Notes
are not rendered on the panel, so a `purpose` that only echoes the title is
dropped rather than padded out.

Every non-obvious claim needs a source pointer: `file:line`, a URL, command
output, or a commit. Notes never hold requirements or active tasks.

## Filename rules

- Stages: `[protocol]-[topic]-[date].md`, where `protocol` is the codename of
  the protocol that opened the stage (`handoff`, `challenge`, …), `topic` is
  short kebab-case, and `date` is the creation day `YYYY-MM-DD`. The prefix
  records origin — a creation fact like the date — so `ls stages/` reads as
  origin and topic at a glance. Reuse the file for the same topic/scope; a new
  file means a distinct work stream. Active vs archived is recorded by path:
  active stages live in `stages/`, closed ones in `stages/archive/`.
- Specs and notes: `<name>.md` with a short kebab-case name; the name is the
  identifier used when challenging a spec.
- Cross-references: a document is addressed by its filename stem — the identifier
  a spec's `after:` uses, that `challenge` names, and that a `[[stem]]` wiki-link
  points to in prose. `[[stem]]` is a reading aid the reader resolves, not
  tooling, so keep stems unique across the public tree, private overlay, and
  archives: a public `specs/x.md` beside `private/notes/x.md` is still ambiguous.
  Because a reference keys on the stem and not the path, moving a document
  between directories leaves references intact; renaming its file breaks them,
  so update the references when you rename. Public documents cannot reference
  private stems; run the privacy checker after cross-scope moves or edits.
