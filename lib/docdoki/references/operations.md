# Operations

Read **Evidence and repair direction** and the matching workflow when performing a specialized operation. All workflows obey the four standing invariants in [SKILL.md](../SKILL.md).

## Evidence and repair direction

Keep three facts distinct: **what is decided**, **what exists**, and **what checks establish**.

| Finding | In an authorized write operation |
| :--- | :--- |
| Code violates a valid contract; fix is clear and in scope. | Fix code and verify; keep the contract intact. |
| Docs lag an identifiable authorized design change. | Update docs to the decision; verify affected claims. |
| A decided requirement is knowingly unimplemented. | Keep the contract, record the gap in `work/`, and implement only what is authorized. |
| Authority or evidence cannot settle the discrepancy. | Leave both visible and record the question in `overview.md` (`## Open decisions`) or the active work item. |

## 1. Setup (`init` / `adopt`)

Use when creating a new library or adding DocDoki to an existing repository.

1. **Inspect first:** Read user intent, existing project docs, and (for existing repos) entrypoints, public interfaces, key data flow, and tests. Bound large adoptions to a coherent area and state what was not examined.
2. **Establish files:** Create `docdoki/northstar.md` and `docdoki/overview.md` (reusing existing files rather than overwriting). Add `specs/`, `work/`, and `notes/` only when they have real content.
   - In existing repos, distinguish **decided intent** from **observed behavior** (mark inferred specs `status: proposed` until confirmed, and record observed gaps in `work/`).
   - Put unresolved questions in `overview.md` under `## Open decisions` rather than inventing binding choices.
3. **Establish privacy boundary:** Ensure the unit is in Git (initialize if appropriate for a new project), append `/docdoki/private/` to the unit's `.gitignore`, and run `scripts/validate.py <unit>`.
4. **Child units:** Wire `parent:` and `## Contribution` in the child's `northstar.md` and add the `## Units` link in the parent when within scope.
5. Do not install the optional Panel into the project unless asked.

## 2. Reconcile (`follow` / `challenge`)

Use when propagating human design input (conversation, document edits, specified Git commits, or Panel handoffs) or auditing conformance between contracts and code.

1. **Locate exact changes or scope:**
   - For human edits, inspect `git status --short`, `git diff`, `git diff --cached`, or `git show <commit>` for the requested paths. Do not assume an arbitrary recent commit or mixed worktree diff is all approved design; ask only when attribution materially changes the outcome.
   - For conformance audits (`challenge`), read in-scope specs, their `covers:` matches (plus unmapped dependencies if claims rely on them), and linked `work/` items.
2. **Assess:** Compare obligations against code and checks using the table above.
   - In **review mode** (inspection/review requests without a repair request): change zero files; report findings, evidence, impact, and recommended actions.
   - In **write mode** (explicit propagation or repair): update affected contracts and summaries, implement in-scope fixes (or record remaining gaps in `work/` if documentation-only), verify changed behavior, and run `scripts/validate.py <unit>`.
3. Never turn an acknowledged unimplemented roadmap into an unasked full rewrite.

## 3. Lifecycle (`work`, `handoff`, `close`, `groom`)

### Work stream selection and maintenance

- Exclude `work/archive/` from routine selection. Reuse an existing active `work/<slug>.md` when its objective and `specs`/`scope` match; create a new file only when a distinct stream needs persistent state.
- Update `Current state` in place at meaningful milestones (separating Working / Broken-Blocked / Not checked). Update affected spec `progress` and route clear decisions or lessons as you go.

### Handoff (`handoff`, "wrap up", "compact", "save context")

Use when work will continue in another session or executor (not for ordinary chat summaries or emails).

- Update the matching `work/<slug>.md` with current objective, state, next actions, key decisions, and dead ends.
- In write mode, you may also sync obvious `progress` changes or route a settled decision into its spec/note if already clear from this session—just do not launch an unrelated full-library audit.
- Finish with a concise, self-contained cold-start prompt naming the `work/<slug>.md` file and relevant specs so the next executor needs no access to this chat.

### Close a work stream

Before moving `work/<slug>.md` to `work/archive/<YYYY-MM-DD>-<slug>.md` (preserving visibility scope):

1. Route still-valid design into `specs/` and durable evidence, rationale, or lessons into `notes/` (updating `## Sources` in affected specs if they pointed only to the closing work item).
2. Move any unfinished obligations to another active work file or record an authorized cancellation; never silently drop requirements.
3. Reconcile affected spec `progress` against actual verified outcomes (closing a work file alone does not prove `done`).
4. Run `scripts/validate.py <unit>` after moving or renaming files.

### Groom

Use for deliberate library cleanup (or apply locally to touched files during ordinary work). Judge strictly by future value:

- **Keep** clear, high-value content.
- **Consolidate** duplicated facts into their authoritative home and link rather than copy.
- **Prune** chronological logs, raw tool output, and inconsequential churn while retaining reasons that affect future choices (including rejected untried options).
- Do not silently drop unimplemented requirements, hide active gaps in `notes/`, or erase unpropagated human edits. Grooming does not authorize code changes or public disclosure of private content.
