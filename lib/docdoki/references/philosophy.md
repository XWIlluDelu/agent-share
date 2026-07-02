# Philosophy

Why docdoki exists, and how humans and agents are meant to share its document
library. This is the thinking the rest of the design must serve; it stays at the
level of principle, not mechanism.

## The problem

Under agent-driven development the agent writes most of the code — and two things go
wrong at once.

The human loses grip on their own project. Faced with a codebase built loosely by
an agent, its documentation scattered, missing, or wrong, the human cannot see how far
the work has got, cannot tell where it matches their intent and where it has wandered
off, pays a steep cost to review or tidy the docs, and struggles to hand down a
structural change. Reducing this burden is the point.

The agent loses context between sessions and re-derives the project each time. That
re-deriving keeps its understanding up to date is a strength, not a defect; the problem
is cost — redoing it from scratch every session is expensive and, under that pressure,
error-prone. It needs a durable, human-readable substrate that lowers that cost, not a
substitute for its own checking: a distillation that orients a cold agent fast — the
intent, the contracts, the work in flight, the dead ends.

And a document is itself an unbacked claim. Left alone it drifts from the code and
becomes a confident lie — a wrong, stale document is worse than none, because it
actively misleads whoever leans on it.

## What docdoki is: a high-quality collaborative file system

docdoki is a file system where humans and agents collaborate, kept at high
quality. Its purpose is fixed by one fact: human time and attention are scarce.

- **Reduce the human's burden** — the primary purpose. The agent carries the
  detail; the human is freed from curating it.
- **Preserve alignment** — the human can always review and edit, so the library
  stays aligned with the design as the human holds it in mind.
- **Serve the agent** — record enough execution detail that an agent can retrieve what
  it needs on demand.

Autonomy is the yardstick. The human should seldom need to step in; frequent human
intervention is a defect in the design, not a fact to accept.

Information flow and anti-rot exist only to keep this library high-quality and
truth-aligned: don't let something important get buried in detail, and don't let
the human's main review surface fill with trivia or with facts long settled and out
of the development focus. So the agent grooms continuously: low-value churn is let go
— the document reads as if it had always said the current thing — and accumulated
detail is promoted into structure once quantity becomes a qualitative change. Forgetting
is the exposed move: a dropped spec claim can be re-confirmed against the code, but a
dropped lesson the code cannot re-derive has nothing left to prove the drop was right.
So the default is restraint — when a fact could still change a later decision, keep or
route it. Committed history remains a recovery trace for what this discards; it is not
where durable lessons live.

Both flow and anti-rot are the agent's **semantic** work, not a deterministic
script's: information is too flexible to distill, promote, or audit by rule.
Anti-rot runs on request — the human points at a spec, a module, or the whole
library — and it rides along whenever you work in code a spec covers, reconciling
what you touched. In either case the agent reads the covered code and reconciles
what drifted; git is there to focus on what changed, but the library persists no
per-claim state. The library stays trustworthy by a few operating habits the agent
carries out:

1. **Honesty over completeness.** The agent does not present a claim it has not checked
   against the code as confirmed truth; it says plainly what it has and has not
   verified. Better a gap than a lie.
2. **Drift is made visible, not hidden.** The agent surfaces where docs and code
   diverged; it never silently papers over it.
3. **No guessing.** The agent records only what it has grounds for — read from the
   code, or heard from the human. Reconstructing what the code does is grounds;
   asserting intent or behavior that neither the code nor the human supports is
   speculation — flag it (habit 1), never present it as fact.

## Ownership: knowledge goes to whoever keeps it true cheapest

In the agent era the library need not belong to the human. Knowledge is tiered by
who is the cheapest reliable source of its truth:

- **Intent** (mission, success criteria, hard constraints, design direction) is the
  human's to set and finally settle. The agent has wide latitude to draft it, infer it,
  even reconstruct it from the code, and to propose changes — but what the intent *is*,
  only the human settles → human-authority, high-threshold. This is where human attention
  should rise to.
- **Contracts** (specs) and their alignment with code are checkable by an
  agent → agent-owned, reconciled with the code when challenged. The human reviews the
  design map, not every spec.
- **Evidence** (implementation detail, history, dead ends, gotchas) is collected and
  kept by the agent as supporting material, consulted on demand, not curated by the
  human.

In practice the human writes very little. Even the northstar is drafted by the agent
from the human's stated intent and then refined; the human is the *source and
approver* of intent, not its typist.

The human ascends to intent; the agent descends to evidence. The library becomes an
agent-maintained, human-steered substrate.

## Collaboration: intent is the human's, maintenance is the agent's

- The human owns intent and decisions; the agent owns propagation and alignment.
- Human input — a direct file edit or spoken intent — is rough intent, not final text.
  The agent reads it, re-understands it, and polishes it to standard (consistent style,
  no typos) while preserving the intent; where the edit implies changes elsewhere, it
  propagates them and flags what it has not yet checked against the code. Often a polish
  in place is all that is wanted — no ceremony, no intermediate state.
- The agent keeps specs aligned to code and surfaces drift. When the spec is merely
  behind a legitimate code change, the agent updates the spec; but it must never
  weaken a correct spec to ratify wrong code. The split: code evolved legitimately →
  fix the doc (the agent may, for clear cases); the code is wrong → fix the code, not
  the spec; neither side is clearly right → the human decides.
- Nothing blocks. Drift and pending work are visible obligations, not gates; the
  human stays in flow.

## What stays out

A document earns its place only by holding what the code, git, and tooling do not already
give cheaply; the library is a distillation, never a second copy. So out goes anything that
merely restates the code, the raw history git already holds (commit logs, the blow-by-blow
of how the work unfolded), what a linter or the build already enforces, and anything one
document says that another already says. A copy is also precisely what rots — transcribe
code into prose and the prose starts drifting from it the same moment — so point to the
code rather than transcribe it.

What stays in is what that raw material does not hand you cheaply: the intent, an index
into the code, and the lessons worth not re-learning — why a choice was made, what was
tried and failed, the gotchas. These are often re-derivable from the code in principle,
but re-deriving them each session is costly and error-prone, so the distilled form is the
point. Keep the cut sharp on history: a dead end is an approach that was tried and
failed for a reason, kept as "❌ X — because Y" — a reconsidered option or a changed
preference is deliberation, not failure, and goes; and it stays only if re-encountering
it could change a later decision. The chronological story of how you reached it is a
process log and goes. Keep such lessons few; when one stays, route it to a note and
back it with a source pointer — a commit, a file, a source — so a future reader can
re-judge it cheaply and it stays maintainable.
