---
name: meeting-executive-summary
description: Generate executive-summary style Markdown reports from meeting transcripts or transcript file paths. Use when the user wants a meeting recap, leadership summary, decision log, action-item tracker, follow-up notes, or asks to extract key decisions, owners, deadlines, and the top discussion points from a transcript and save the result to a Markdown file.
allowed-tools: Read, Write, Bash
---

# Meeting Executive Summary

Turn a raw meeting transcript into a concise Markdown report that a project lead or executive can scan quickly. Focus on what changed because of the meeting: what was decided, what needs follow-up, and which topics dominated the conversation.

Do not retell the full transcript. Distill it.

## When To Use This Skill

Use this skill when the user:
- pastes a meeting transcript directly into chat
- gives a local file path to a transcript
- asks for an executive summary of a meeting, call, interview, standup, review, or planning session
- wants decisions, action items, owners, deadlines, or main discussion points extracted from a transcript
- wants the result saved as a Markdown report

Do not use this skill for:
- verbatim transcript cleanup without summarization
- generic note-taking that is not transcript-driven
- highly specialized legal or medical compliance extraction where domain-specific review is the main goal

## Accepted Inputs

Accept one transcript in either form:
- raw pasted text
- a local file path to a readable text document

If the user gives a file path:
1. Read the file first.
2. If it is clearly not a readable text file, say so and ask for a text export or pasted transcript.
3. If the path is ambiguous or missing, ask one short clarifying question instead of guessing.

If the user gives raw text:
1. Treat the pasted content as the source of truth.
2. Do not ask them to reformat it first unless it is genuinely unreadable.

## Core Extraction Standard

The report must cover exactly these three things:
1. Key decisions made
2. Action items with owners and deadlines
3. Top 3-5 discussion points

Be conservative about factual claims. Separate what was explicitly decided from what was merely suggested, debated, or left unresolved.

## Workflow

### 1. Load The Transcript

Read the transcript from the provided text or file path.

While reading:
- notice speaker names, roles, timestamps, and agenda shifts when available
- ignore filler such as greetings, backchannels, false starts, and repeated phrasing
- keep wording grounded in the transcript rather than inventing cleaner facts

### 2. Identify Decision Candidates

A decision belongs in `Key Decisions` only when the transcript shows clear commitment or agreement, for example:
- explicit approval or sign-off
- clear agreement on a direction
- commitment to a scope, timeline, owner, or next step
- rejection of one option in favor of another

Do not promote an item to a decision if it was only:
- brainstormed
- proposed but not accepted
- discussed without closure
- deferred for later

If the meeting contains no clear decisions, state that explicitly instead of forcing one.

### 3. Extract Action Items

Capture concrete follow-up work. Each action item should contain:
- the task
- the owner
- the deadline

Use these rules:
- Use a person or team as owner only if the transcript supports it.
- If ownership is implied but not explicit, prefer `Not explicitly assigned`.
- If no deadline is given, use `No deadline stated`.
- If the transcript uses relative time like `next Tuesday`, convert it to an absolute date only when the reference date is available in the transcript or user context. Otherwise preserve the original phrase and note that it is transcript-relative.

Prefer actionable wording such as `Prepare revised budget draft` over vague wording such as `Budget follow-up`.

### 4. Select The Top Discussion Points

Choose the 3-5 discussion points that mattered most. Rank by salience, not transcript order.

A discussion point is salient when it:
- consumed meaningful time
- shaped a decision or action item
- revealed a major tradeoff, risk, disagreement, or dependency
- mattered to leadership, timeline, scope, or execution

Merge duplicate threads into one clean topic. Phrase each point as a substantive theme, not a one-word label.

### 5. Write The Report

Keep the report concise, structured, and easy to scan. Prefer sharp paraphrase over long quotations.

Use this exact section structure:

```markdown
# Meeting Executive Summary

## Key Decisions
1. [Decision]
2. [Decision]

## Action Items
| Action Item | Owner | Deadline |
| --- | --- | --- |
| [Task] | [Owner or "Not explicitly assigned"] | [Deadline or "No deadline stated"] |

## Top Discussion Points
1. [Topic] — [1-2 sentence summary]
2. [Topic] — [1-2 sentence summary]
3. [Topic] — [1-2 sentence summary]
```

Formatting rules:
- Use numbered lists for `Key Decisions` and `Top Discussion Points`.
- Use a Markdown table for `Action Items`.
- If a section has no valid items, write `None explicitly identified in transcript.`
- Keep each decision and discussion point concise; usually one sentence, two at most.
- Do not add extra sections unless the user explicitly asks for them.

## Saving Behavior

Always save the final report to a Markdown file.

Default naming:
- if the source is a file path, save next to it as `<original-stem>-executive-summary.md`
- if the source is pasted text, save in the current working directory as `meeting-executive-summary.md`
- if that filename already exists, append a timestamp or numeric suffix instead of overwriting silently

After saving:
1. Tell the user the output path.
2. Briefly summarize what was extracted, for example: `Saved report with 3 decisions, 5 action items, and 4 discussion points.`

## Quality Bar

Before finalizing, check:
- decisions are truly decisions rather than unresolved discussion
- every action item is concrete and not a restatement of a discussion topic
- owners and deadlines are not hallucinated
- discussion points are distinct and ranked by importance
- the file was actually written successfully

## Edge Cases

### Messy Or Incomplete Transcript

If the transcript is noisy, fragmented, or obviously partial:
- still extract what is reasonably supported
- keep uncertainty local to the affected item
- avoid pretending the meeting was more conclusive than it was

### Multiple Candidate Owners

If several people discussed doing something but no owner was assigned, do not guess. Use `Not explicitly assigned`.

### Implied But Unfinished Decisions

If the group leaned toward an option but deferred confirmation, put it under `Top Discussion Points`, not `Key Decisions`.

### Fewer Than Three Meaningful Discussion Points

Return fewer than three rather than padding with weak material. The target is 3-5, not a quota that justifies filler.

## Example

**Input**

`Summarize this product review transcript and save the report as markdown: /tmp/q2-review.txt`

**Expected behavior**

- Read `/tmp/q2-review.txt`
- Extract decisions, action items, and top discussion points
- Save a file such as `/tmp/q2-review-executive-summary.md`
- Tell the user where the file was saved
