# Operations

Read **Shared decisions** before applying a named operation, then its section.
For ordinary implementation, start with the work loop in [SKILL.md](../SKILL.md).
These are agent procedures using normal file, Git, and verification tools, not
a protocol CLI.

## Contents

- [Shared decisions](#shared-decisions)
- [Init](#init) · [Adopt](#adopt) · [Ask](#ask)
- [Follow](#follow) · [Challenge](#challenge) · [Groom](#groom)
- [Work stages](#work-stages): [selection](#select-or-create),
  [maintenance](#maintain-during-work), [handoff](#handoff), [closure](#close)

## Shared decisions

### Scope, authority, and mode

Start from the user's objective, applicable project instructions, current
decisions, and requested scope. Read files before changing them and inspect
existing work so you do not overwrite unrelated or unpropagated human edits.
A file's timestamp, Git authorship, or position in the library does not by itself
determine design authority.

The human sets intent and important tradeoffs. The agent drafts, organizes,
expands, and implements design within its delegated authority. A requirement is
decided when supported by an applicable human decision or an in-scope agent
design decision; an agent's tentative suggestion is not a user requirement.
Polishing preserves strength, scope, conditions, negation, and exceptions. A
meaning change needs authorization, even when it is a one-word edit in a note
or a low-level spec. Routine maintenance needs no extra approval in write mode.

**Read/review means zero project writes**, including formatting, status updates,
stages, caches, generated files, moves, and archives. Choose inspection commands
that do not write; if a test would create files, report it as not run or ask for
permission to run it in an isolated copy. Do not write and then restore. In
write mode, make the requested change and necessary supporting changes, not an
unrelated library cleanup or a full roadmap implementation. Inspection requests
such as “check” or “review” without a repair request default to review; `ask`
is always read-only. A request to repair/reconcile authorizes in-scope fixes.
When a named `follow` request says to propagate, use write mode unless restricted.

If a material decision or authorization is missing, identify the precise
question and its effect. Continue independent work; do not cross the unresolved
boundary. Preserve the gap in a matching stage when writes are permitted, or
report it in the answer when they are not. Do not commit, stash, reset, or rewrite
history merely because a DocDoki operation runs; follow the user's Git workflow.

### Evidence and repair direction

Keep three questions separate: what is decided, what exists, and what the
available checks establish. Read covered code, relevant tests and data; run
checks appropriate to the claim and permitted by the mode. Git differences help
locate work, but neither a diff nor its absence proves conformance or approval.

| Finding | In an authorized write operation |
| :-- | :-- |
| Implementation violates a valid contract; the correct fix is clear and in scope. | Fix implementation, then check the affected behavior. Keep the contract. |
| Documents lag an identifiable authorized design change. | Update the documents to that decision; verify relevant implementation claims. |
| A decided capability is knowingly unfinished. | Keep its contract and distinguish the known gap from a new regression. Implement only what this task authorizes; retain remaining work in a stage. |
| Evidence or authority cannot settle the difference. | Preserve it and state the missing evidence or decision. Do not pick the more convenient side. |

A local defect can be fixed without reconstructing its whole history. Conversely,
a plausible story about why the code changed is not authorization to change the
contract. Never weaken a correct requirement to make wrong code appear compliant.

Match conclusions to evidence. Reading a constant can establish its value;
a targeted test supports only the exercised behavior under its conditions;
performance, deployment, remote data, and filesystem claims may need different
checks. Distinguish **confirmed within stated checks**, **known unmet**, and
**not checked / inconclusive**. Do not mark an entire spec verified because one
check passed or its `covers` matched nothing. Keep useful evidence pointers and
limits in the stage or a note, without a log of every tool call.

## init

Use when the user wants a new library. Read the stated intent and existing project
instructions, inspect any existing library and nearest parent unit, then use
[Document schemas](schemas.md). Reuse existing files rather than overwrite them.

Create `docdoki/northstar.md` and `spec_abstract.md` with known intent, a useful
initial map, and explicit questions where important intent is missing. A draft
inference is not settled merely because you wrote it. Ask about those gaps, not
for ritual approval of already stated decisions. Add specs, stages, and notes
only when they have content; create directories as needed rather than empty
placeholder documents.

Use the existing Git repository. For a new project without one, initialize Git
as part of setup unless the user has excluded it. Read [Privacy](privacy.md),
append `/docdoki/private/` to the unit's `.gitignore` without replacing rules,
and run the checker even if the overlay is still empty. If Git setup is not
permitted, explain that the private boundary has not been established and do
not store private content under an unprotected directory.

For a child library, add the `parent` and `Contribution` navigation and the
parent's `Units` link, within the requested setup scope. Finish by identifying
the main reading paths and any unresolved intent. No panel, database, or cold
research report is required. Do not install or link the optional panel unless
the user asks for that integration.

## adopt

Use when the user wants a library for an existing project. Read entrypoints,
public interfaces, important data flow, tests, existing requirements and design
records, and any relevant local overlay. Bound a large adoption to a coherent
area if necessary and state what was not examined; do not claim complete
coverage from a sample.

Apply `init` setup to the missing parts. Draft intent from authorized sources;
when only behavior is known, call it an observation or a proposed reconstruction,
not an approved goal. Write specs for coherent areas from decided requirements,
including those not implemented yet. Where adoption delegates design judgment,
record in-scope decisions as agent decisions rather than attributing them to
the human. Keep unresolved design questions in stages or notes.

Associate specs with actual or explicitly planned code targets. Explain observed
conformance and gaps separately, route reusable discoveries to notes, and create
a stage for work that will continue. The overview should orient the human to
both the design and the limits of this adoption. Do not manufacture a contract
for every file or call all existing behavior correct.

## ask

Use for questions about the project or its progress. Read the main documents,
relevant specs and active stages; inspect code or other sources as needed using
read-only methods. Avoid routinely reading archives or the entire library.

Answer the question, distinguishing decided design, recorded status, freshly
checked facts, differences, and unknowns. If the overview is stale, say so rather
than treating it as authoritative evidence. A question does not authorize
polishing or repairing the library. Respect the intended audience; do not put
private context into an answer intended for publication.

## follow

Use for human design input: a spoken instruction, a document edit, an identified
commit, or an ordinary document write-back from an optional editor. Locate the
actual input before interpreting it. For Git work, useful views from the unit are:

```sh
git status --short
git diff -- <requested-paths>
git diff --cached -- <requested-paths>
git show <specified-commit> -- <requested-paths>
git diff <specified-base>..<specified-head> -- <requested-paths>
```

Choose the comparison from the user's identified change, not an arbitrary recent
commit. A clean worktree does not exclude a committed human amendment. Mixed
staged, unstaged, and prior-agent changes are not all approved new design.
If attribution affects the outcome and cannot be resolved from the request and
records, ask for the change range; continue clearly scoped independent work.
Without Git, use the supplied old/new text and current files.

Read the changed documents and affected contracts and implementation. Preserve
the input's actual conditions and strength when improving wording. In review,
report meaning, impact, conflicts, and suggested changes only. In write mode:

1. Put the decided design in the appropriate contracts and align linked summaries.
2. Implement the authorized scope, using **Evidence and repair direction** above.
3. Check the changed behavior and update meaningful work state. Leave remaining
   gaps explicit, rather than weakening the design or silently expanding scope.

If the user requests documentation-only propagation, update documents only and
record the implementation gap. An explicit change in a human-edited summary
can authorize a new contract; an unexplained conflicting file cannot. Private
input stays private unless a disclosure decision permits a public, independently
supported claim. See [Privacy](privacy.md).

## challenge

Use to assess conformance or repair drift in a named spec, area, or library.
State the selected scope if the user leaves it open. Reconcile touched contracts
during ordinary implementation too; that does not initiate a whole-library audit.

Read in-scope specs, their actual `covers` matches, relevant dependencies, and
stages that explain known gaps. Check targets outside `covers` when the claims
depend on them; report or repair the association within mode. For missing targets,
determine whether the association is planned, broken, or unknown. No matches is
not a successful check.

Compare the obligations with appropriate evidence and apply **Evidence and repair
direction**. In review, leave every project file unchanged and report findings,
evidence, consequences, recommended actions, and limits. In write mode, make the
reliably determined in-scope repairs, check them, and update affected records and
summaries. Do not turn an acknowledged roadmap gap into a demand to implement
everything now. End with what was checked, fixed, remains unmet, or needs a decision.

## groom

Use for deliberate library cleanup; during authorized write work, apply the same
judgment only to touched content. Read before editing, including pending human
input and relevant sources. Choose by future value:

- **Leave** useful content that is already clear.
- **Polish** wording or format without changing meaning.
- **Route or consolidate** misplaced detail into its proper home, or synthesize
  several observations into one supported lesson. Update links and summaries.
- **Forget** obsolete or low-value material whose removal loses no active
  obligation, important reason, or hard-to-recover knowledge.

Remove chronology, duplicate raw output, and inconsequential preference wavering.
Keep a reason that may change a future decision, including a rejected option
that was never implemented. For example, “we tried blue at 09:12” can go;
“remote conversion was rejected because rows must remain local” should stay.
Stable constraints can still belong on the human's main reading surface.

Do not drop requirements because implementation is absent, hide unfinished work
in notes, or erase an unpropagated edit as “noise.” Route durable content before
deleting its old home. Git can recover committed text, but not uncommitted text
or private material absent from that repository. Commit messages and external
agent memory are not the retained lesson's home.

Grooming does not authorize code changes or new design/disclosure decisions.
Record such findings instead. Do not undertake unrelated audits, create churn
for a cleanup quota, or block independent work on a minor formatting question.
A pass that finds nothing worth changing is complete.

## Work stages

### Select or create

Use the active public and private stage sets together; exclude `stages/archive/`
from routine selection. Choose an existing stage by:

1. explicit user identification;
2. a unique match of objective and `scope` to the work;
3. the only active stage, **if its objective fits**;
4. otherwise ask which existing stream the work belongs to when that choice matters.

Multiple active stages are normal. Overlapping paths signal coordination, not
an error: identify the intended stage explicitly instead of assigning state to
whichever file is found first. Read current edits before writing shared state.
Do not commandeer a single unrelated stage.

Reuse a stage for the same objective. Create one when a distinct stream needs
persistent state, not for every small edit or every session. Populate `scope`,
including intended paths where necessary, and use the shape in
[Document schemas — Stages](schemas.md#stagesmd). A new meaningful public stream
should be discoverable from the overview during ordinary write work. Public
work must remain resumable without a private-only stage; separate any private
context without making public records depend on it.

### Maintain during work

Update the selected stage when a milestone, blocker, decision, check result, or
next action materially changes what the next reader should do. Rewrite current
state; do not append a diary. Route durable decisions and knowledge during the
authorized work and refresh affected overview summaries. If nothing relevant
changed, no documentation write is needed. None of this requires ending the
session or producing a kickoff prompt.

### handoff

Use when the user wants work to continue in another session or with another
executor. “Compact,” “wrap up,” or “save context” can express that intent; a
summary for an email does not. Do not initiate a full handoff merely because a
session is long, and do not treat a read-only summary as permission to write.

Select or create the matching stage. Read current files and available work
context, then rewrite objective, present state, next actions, decisions, and dead
ends needed for a cold start. Recheck changed-file state where useful, but do not
start a fresh conformance audit or implement pending work. If context or evidence
is missing, state the gap rather than reconstructing it as fact.

A standalone handoff writes only the selected stage (or corresponding public
and private stages when necessary). It does not groom the whole library or
promote content into other documents. Capture a durable item noticed here in
`Decisions` or `Dead ends` for later routing. Preserve private boundaries even
in the response. Finish with a short kickoff prompt naming the stage and asking
the next executor to read the relevant contracts and continue from
`## Next actions`. It must not rely on access to this chat.

### Close

Close a stage when its objective is completed, abandoned, superseded, split, or
merged, within the authorized work. Before archiving:

1. Route still-valid design into specs and reusable reasons/evidence into notes.
2. Move unfinished obligations to an appropriate active stage, or record an
   authorized cancellation or supersession. Do not silently cancel requirements
   to make a stage look complete.
3. Rewrite a compact final snapshot with the outcome and any continuation link;
   move it to `stages/archive/` in the same visibility scope.
4. Update current-work summaries and affected relative links, then run the
   [privacy check](privacy.md#establish-and-check-the-boundary) for changed document
   paths/references. Leave `progress` display fields alone unless their change
   was explicitly requested.

Do not close work whose remaining obligations have no owner or disposition.
Closure needs no special seal commit. Archives preserve context but are not
routine status or challenge inputs; consult them when explicitly requested or
when current records lack necessary context, then restore useful missing
knowledge to its active home when writing is authorized.
