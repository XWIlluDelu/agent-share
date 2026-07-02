# Anti-patterns

Use this file when an operation feels ambiguous or a write would be easy to justify but hard to undo. It lists DocDoki-specific wrong moves; it does not replace `commands.md`, `schemas.md`, or `lifecycle.md`.

## Do not create a write just because an operation ran

If `polish`, `garden`, or smart `challenge` produces no material change, report `no_change` and write nothing. Empty staging drafts make the user review noise.

## Do not silently resolve ambiguous document references

When a natural-language document reference matches more than one candidate, stop and ask. Cold documents such as `northstar.md` and archived todos are too easy to damage by guessing.

## Do not bypass staging for specs

Spec changes from `polish`, `challenge`, and `garden` go through `.docdoki/staging/` and land only through `approve`. Direct spec edits are for explicit human edits, not Agent convenience.

## Do not ratify bad code by weakening a correct spec

A failed `challenge` needs `resolution: code_change`, `doc_change`, or `human_decision`. Only `doc_change` may stage a spec edit. If the code is wrong, append a chore or fix the code; do not relax the spec.

## Do not treat chores as a log

`docs/chores.md` holds open transient work. If an item matters permanently, promote it to a spec through `garden`; otherwise remove it when it is done or discarded.

## Do not challenge history documents

`docs/challenge/*.md` and `docs/todo/archive/*.md` are history. They are not alignment targets and should not be rewritten to fit present code.

## Do not leave staging as hidden truth

Staging drafts are pending proposals, not canonical docs. Surface them in `status`; land them with `approve` or delete them with `discard`.

## Do not improvise helper paths or random IDs

Resolve helpers from the installed skill root, not the project root. Use `new_chore_id.py`, `staging_path.py`, and `allocate_challenge_report.py`; do not invent IDs, staging paths, or report filenames by hand.

## Do not write operational commands into specs

Commands, validation checklists, and generation flows belong in `docs/runbook.md`. Specs define constraints and boundaries; runbooks define what to type and what to expect. Putting shell commands inside a spec forces the human operator to search multiple files for the command they need and risks the command drifting independently of the constraint it serves.

## Do not define terms inline in specs when a glossary exists

When `docs/glossary.md` contains the canonical definition of a term, specs should use that term without re-defining it. A term defined differently in two specs creates ambiguity for human reviewers and Agents alike. If a spec needs to narrow a glossary definition for a specific context, it must explicitly acknowledge the glossary baseline and state the narrowing.
