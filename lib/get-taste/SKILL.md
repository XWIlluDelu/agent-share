---
name: get-taste
description: "Build research literacy and reusable field guides: turn one field or a related set of fields into standalone research prompts, accept returned reports, or research autonomously in auto mode. Use when the user wants foundational knowledge, authentic disciplinary language and research taste, a staged research-prompt workflow, or selective synthesis of research reports into a cross-project guide. Not for a quick factual answer, a project-specific experiment plan, or a publication-style systematic review."
---

# Get Taste

Develop shared scientific background, fluency in a field's actual language, and
informed research judgment. The lasting artifact is a reusable field guide;
research prompts and reports are intermediate materials. Apply this workflow to
the requested disciplines, without importing a particular field's syllabus.

## Establish the task

Recover scope, decisions, and existing materials from the conversation before
asking questions. Determine:

- **Fields:** one field or a semantically connected collection. Preserve stated
  interests and boundaries; a motivating project need not define the guide's
  scope.
- **Mode:** default to manual handoff. Use **auto** when requested, including
  an instruction to do the research directly and deliver the guide.
- **Prompt count:** in manual mode, use the requested number. Infer one for a
  single field. For several fields, clarify an unspecified count unless the
  user delegates that choice. In auto mode, a count is optional: honor one if
  supplied, otherwise choose a sensible internal grouping.
- **Current stage:** generate research prompts, process returned reports, or
  synthesize/revise a guide. Start at the appropriate stage; supplied reports
  do not require another round of prompt generation.

Default the final guide to **English, approximately 4,000 main-text words,
excluding references**. This is one budget for the integrated guide, not a
budget per field. Prompts and intermediate reports may use the user's language
while retaining the field's standard terminology. Honor explicit overrides.

If important content will not fit after substantive selection and compression,
request a larger body budget. Explain what the existing budget would omit, why
that loss matters, and the proposed new limit. Obtain approval before materially
expanding the guide. A large field or a long pile of reports is not, by itself,
a reason to ask for more space. Do not pad a sufficient shorter guide.

## Organize the research

Identify the substantive fields in the request, not just comma-separated words.
Group through shared phenomena, concepts, explanatory traditions, or analytic
questions. Explain the grouping briefly.

- One prompt can cover one field or several connected fields.
- When prompt and field counts match, give each field its own prompt.
- When fewer prompts are requested, form that many coherent groups, one prompt
  per group. Groups need not be equal in size.
- Assign each requested field a clear primary home. Shared prerequisites and
  useful cross-references can cross group boundaries.
- If more prompts are requested than there are supplied fields, ask whether to
  reduce the count or agree a finer field scope. Do not silently invent fields
  or turn one field into several research stages to satisfy the count.

For example, four cognitive domains and two data-analysis domains may form one
cognition group and one analysis group. The reason is their explanatory
connection, not a rule to split six inputs three-and-three. Find the appropriate
connections afresh for other disciplines.

## Manual handoff

Read [Research design and source practice](references/research.md) before
composing prompts.

Produce a short scope/grouping explanation followed by the requested number of
clearly separated, independently copyable prompts. A prompt is a complete
research brief, not necessarily one paragraph. Include its field scope,
learning purpose, substantive research directions, source-reading expectations,
and requested report artifact. Carry relevant prior context into each prompt;
an external research session cannot see this conversation or the other prompts.

Ask for coherent knowledge reports with traceable sources and reading scope.
Do not conduct the full research or substitute a field guide when the user has
asked only for prompts.

When reports return:

1. Read their full available text, including source notes. Follow local file
   paths and continue truncated reads; a pasted summary may not be the report.
2. Relate their coverage to the agreed fields. Track useful connections,
   overlap, consequential disagreements, and missing core material.
3. Resolve important uncertainties through targeted source checks. Distinguish
   a report's account from an original source you have personally inspected.
4. If a central area is missing, request the report, offer a clearly scoped
   interim guide, or ask to research the gap. Minor omissions do not require
   restarting the whole workflow.
5. Proceed to synthesis when the requested coverage is adequately supported.

Accept reports incrementally and preserve their source files. Continue from
previous work rather than treating every returned report as a new project.

## Auto mode

Use the same grouping and research standard, but execute the plans yourself.
Read [Research design and source practice](references/research.md), then:

1. Form the group plans and give a brief progress outline. Do not pause for
   approval of every group or require the user to relay prompts and reports.
2. Search and inspect sources using the available research, retrieval, and
   document-reading tools. Use supplied source collections where appropriate.
   Work sequentially or delegate bounded groups if the environment supports it.
3. Keep concise research notes linking explanations and important findings to
   sources and actual access level. Follow significant gaps or contradictions
   until the intended guide has an adequate foundation.
4. Synthesize the material rather than presenting a concatenation of search
   results or group reports. Stop gathering when additional reading mainly
   adds examples instead of changing the guide's core understanding.

Auto removes the external handoff, not source reading or editorial judgment.
Ask the user about material scope changes, additional budget, or consequential
tradeoffs; otherwise continue through delivery. If retrieval is unavailable,
use adequate supplied sources or report the specific access/material needed.
Do not describe memory-based writing as completed literature research.

## Synthesize and edit

Read [Field-guide editing](references/field-guide.md) before drafting or
revising the guide. Select its knowledge spine across all materials, then write
a coherent document. Organize sections, headings, and tables by meaning; neither
research groups nor an example guide's section count determine the final outline.

For optional editorial calibration or quality comparison, start with the
[example index](examples/README.md), then choose a relevant guide:
[computational neuroscience](examples/computational-neuroscience-field-guide.md),
[systems and cognitive neuroscience](examples/systems-cognitive-neuroscience-field-guide.md),
or [neural control](examples/neural-control-field-guide.md). Learn from their
editorial choices, not their outlines or disciplinary scope. Do not load all
three by default.

Preserve important foundations and explanatory connections while retiring
redundant cases, exhaustive method lists, and repetitive interpretation warnings.
Use a small set of references that supports the selected content and offers
valuable reading entry points. Keep fuller research records outside the guide.

Write artifacts in the user's chosen project/workspace, not the installed skill
directory. Reuse an agreed guide path for revisions and preserve unrelated files.
When files are unavailable, provide the full Markdown in the response.

## Check and hand off

Check scientific explanations, terminology, source support, and editorial
selection by reading the result. Verify citation metadata and footnote links.
Measure the final body before delivery, including inline-only responses; do not
report the target budget as a measured count. For English guides, run the bundled
helper from the canonical skill directory:

```bash
python3 <skill-dir>/scripts/check_guide.py <guide.md> --budget 4000
```

For an inline draft, pass `-` instead of a file and provide its complete Markdown
on standard input. Use the approved budget if it differs. The helper reports
approximate English body words separately from references and checks footnote
consistency. It does not judge scientific quality or authorize an increased
budget. For a custom bibliography heading, pass
`--references-heading "Heading text"`. If the user changes the guide's language,
use an appropriate counting convention; if tools are unavailable, label an
estimate honestly rather than claiming a measured count.

Deliver the guide path (or full text), body word count excluding references,
reference count, and material coverage/access limitations. For a prompt-only
request, deliver the prompts and stop at that stage. Avoid dumping all research
notes into the handoff or inventing a further round after the task is complete.
