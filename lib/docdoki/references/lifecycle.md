# Document lifecycles

Per-type ownership, update cadence, archival rules, and refactor handling. Use this when you need to decide whether something is allowed to change a given document, or how to handle a structural change.

## northstar.md

**Type**: state, extremely cold.

**Ownership**: human-led. The Agent may polish wording but never adds goals, constraints, or stage objectives that the user did not state. When the user is vague ("make it good"), the Agent paraphrases what they said rather than fabricating concrete commitments.

**Update cadence**: rare. Days to weeks between substantive edits in most projects.

**Structure**: append-only. New stage objectives go to the end. Existing main goal stays put. Stage objectives can be reordered for clarity, but their content should not change once a stage is in progress.

**Major-version reset**: when the project shifts so much that the old northstar is obsolete (rare), do not edit in place. Archive the old file:
```
mv docs/northstar.md docs/northstar.archived_YYMMDD.md
# write a fresh northstar.md from scratch
```
The archive file is retained for historical reference but no longer participates in any docdoki operation.

**Challenge harness**: when `challenge` is run against northstar (only on `--include northstar`), the prompt includes the instruction "Do not propose modifications to the northstar without overwhelming evidence. The user reviews northstar more carefully than any other document." This is a soft harness — it biases the LLM toward conservatism, not a hard refusal.

---

## glossary.md

**Type**: state, cold.

**Ownership**: human-led. The Agent may add terms derived from existing specs, but must not invent definitions or alter existing terms without human confirmation.

**Update cadence**: terms added whenever new concepts enter the project through specs or code. Typically days to weeks.

**Purpose**: a single-file canon of project-specific terminology. Defines what each term means, its relationship to other terms, and where it is used. Exists to give a human reviewer one place to understand the project's vocabulary without cross-referencing multiple spec files.

**Structure**: one H2 heading per term group (e.g., "Shape classification", "Experimental design"), with definition paragraphs for each term. No frontmatter required.

**Write policy**: polish → staged. Human edits directly. Challenge eligible under `--include glossary`.

**Anti-content**: glossary is not a spec. It does not define constraints, covers, or behavioral rules. It defines words. Constraints stay in specs.

---

## runbook.md

**Type**: state, warm.

**Ownership**: shared. The Agent updates runbook when generation commands, validation checklists, or deployment steps change. Human adds session-specific notes.

**Update cadence**: whenever operational commands change —  asset regeneration, validation checklists, deployment procedures. Typically weekly.

**Purpose**: a single-file record of the operational commands and checklists needed to run the project. Exists to give a human operator (reviewer, new team member, deployment person) one place to find "what do I actually type" without reverse-engineering it from spec constraints.

**Structure**: one H2 heading per operation group (e.g., "Asset generation", "Validation", "Deployment"), with shell commands, expected outputs, and brief explanations. No frontmatter required.

**Write policy**: go → direct (update command steps inline). Polish → staged. Challenge eligible under `--include runbook`.

**Anti-content**: runbook is not a spec. It does not explain why a command exists or what constraint it satisfies. It states what to run and what to expect. Rationale stays in specs. Runbook commands that drift from spec constraints are contradictions, not alternative truths.

---

## active_*.md

**Type**: state, hot.

**Ownership**: shared. `docdoki go` regenerates substantial portions; the user freely edits inline (re-orders tasks, adds notes, marks checkboxes).

**Update cadence**: many times per day during active development.

**Single-active rule**: a repo has **at most one** `active_*.md` at any moment. `status` and `go` both check this and refuse on multiple matches. Rationale: if you have parallel stages, you're really in two projects' worth of mental context simultaneously, which is exactly the failure mode docdoki exists to prevent.

**Archival**: when a stage ends, rename:
```
mv docs/todo/active_<desc>.md docs/todo/archive/<desc>_YYMMDD.md
```
The Agent may do this automatically when the user signals stage completion ("we're done with the auth refactor"); otherwise leave it to the user.

**Direct writes (no staging)**: `go` writes active todos directly. Staging would add friction to a high-frequency, low-stakes file. The trade-off is intentional.

---

## chores.md

**Type**: state, hot, transient.

**Ownership**: shared. Agent adds chores when the user requests something tangential to the main task ("oh and fix the button color too"). Human adds chores manually when they notice something. `garden` aggregates and prunes.

**Update cadence**: several entries per active dev session.

**Append-first**: new chores go at the end. Resolved chores (checkbox `[x]`) are removed by `garden`, not retained as history. (Git history retains the record if you need it.)

**ID assignment**: see `references/schemas.md` § chore line format. Use `scripts/new_chore_id.py`, not LLM guesses. Placeholders `chore-??????` get replaced by the next `go` or `garden`.

**No long-term storage**: chores are not a log. If a chore is worth keeping, it gets promoted to a spec by `garden`. If not, it's deleted. The ledger only holds open items.

---

## spec/*.md

**Type**: state, medium-cold.

**Ownership**: shared. Initial drafts often come from `adopt` or `polish`. Subsequent updates flow through `challenge` (fail → staged spec edit → approve) or `garden` (promotion from chores). Human can also edit directly.

**Update cadence**: changes when conventions evolve. Typically days to weeks between substantive edits per spec.

**`covers` field**:
- `paths` is the dispatch hint — which code to read during `challenge`. Required.
- `tags` is a soft semantic hint. Optional. Not validated.

**Refactor handling**:

| Refactor strength | What to do |
| :-- | :-- |
| Small rename / move (module boundary unchanged) | Edit `covers.paths` in place; content edits minimal |
| Large refactor (module boundary changed) | **Directory-level reorganization**: delete obsolete specs, create new ones reflecting the new boundaries. Do not try to patch the old specs to fit. |

**Signal that boundary itself is wrong**: if a spec's `covers.paths` after a refactor spans multiple unrelated areas in the new architecture, the spec's *boundary* has become wrong (not just its content). Time to split or merge specs.

**Spec naming**: filenames are `<id>.md` where `id` matches the frontmatter `id` field. Lowercase, kebab-case. Examples: `auth.md` → `id: spec-auth`. The `spec-` prefix in the frontmatter ID is conventional but not enforced.

**Deprecation**: when a spec is no longer relevant but you want to keep it for historical reference, set `status: deprecated`. `status` and `challenge` ignore deprecated specs. They remain in git but don't participate in workflows.

---

## challenge/*.md

**Type**: history.

**Ownership**: Agent-written. Never edited after creation. Human reads but does not modify.

**Update cadence**: one file per `challenge` invocation. Typically 1-10 per active development day.

**Dual purpose**: audit history AND alignment anchor. The most recent `verdict: pass` report for each spec defines that spec's alignment baseline (used by `status` for stale detection).

**Never challenged**: smart-mode `challenge` excludes `docs/challenge/**` from default inclusion. The doc is history, not state — auditing it would recurse without producing value.

**No cleanup**: challenge reports accumulate forever. They're small files; storage is not a concern. If you need to find a past verdict for a specific spec, grep the directory.

**Rebase friendly**: the alignment anchor is the commit that introduces the report file (`git log -1 --format=%H -- <report>`), not the report's diagnostic `git_rev`. The report file follows git history through rebase/squash/cherry-pick, so the anchor moves naturally. No external pointer is maintained.

---

## todo/archive/*.md

**Type**: history.

**Ownership**: archived from `active_*.md` by rename. Never edited after archival.

**Update cadence**: rare — once per stage completion.

**Filename convention**: `<description>_YYMMDD.md` where `<description>` matches the original `active_<description>` (preserves the slug) and `YYMMDD` is the archival date.

**Never challenged**: same reasoning as challenge reports. The document is what it was at the time; auditing past plans against present code is not meaningful.

---

## Summary table

| Doc type | State / History | Cadence | Owner | Write policy |
| :-- | :-- | :-- | :-- | :-- |
| `northstar.md` | state | days-weeks | human-led | polish → staged; otherwise human edits directly |
| `glossary.md` | state | days-weeks | human-led | polish → staged; otherwise human edits directly |
| `runbook.md` | state | weekly | shared | go → direct; polish → staged |
| `active_*.md` | state | hourly | shared | go → direct; polish → staged |
| `chores.md` | state | per-session | shared | go/garden → direct line edits; polish → staged |
| `spec/*.md` | state | days | shared | always staged (polish / challenge / garden) |
| `challenge/*.md` | history | per-audit | Agent | direct append (single new file per run) |
| `todo/archive/*.md` | history | per-stage | n/a (frozen) | direct rename only; never edited |

**Why this split**: high-frequency low-stakes docs (active todo, chores, runbook) tolerate direct edits because the cost of mistakes is small and the friction of staging would dominate. Structural decisions (spec, glossary) go through staging because silent corruption of a contract is far more expensive than one extra `approve` call. Northstar is human-only because its contents define the project's reason to exist and must not be rewritten by an Agent. Polish is always staged regardless of the target — polish authorities L3/L4 can rewrite structure and intent, so even a low-stakes target deserves the review step.

For the authoritative per-operation × per-doc-type matrix, see `../SKILL.md` § authoritative write matrix.
