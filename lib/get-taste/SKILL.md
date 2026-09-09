---
name: get-taste
description: "Develop foundational knowledge, disciplinary language, and research habits and taste through reusable field guides. Use when the user wants research prompts for one or more fields, synthesis of returned research reports, or autonomous research through final delivery. Supports manual handoff to a research LLM/agent and an auto mode that executes the same workflow directly."
---

# Get Taste

Build the background that helps an agent understand a field, discuss it naturally,
and exercise informed judgment across projects. Teach research habits and taste
through concepts, distinctions, and examples, rather than a list of generic rules.
The deliverables are research prompts and one integrated field guide.

## Establish the task

Use the conversation and supplied materials to recover the fields, intended
reader, interests, and current stage. Start with prompts, returned reports, or an
existing guide as appropriate.

Default to **manual handoff**: the user takes prompts to a research LLM/agent and
returns its reports. Use **auto** when the user asks you to do the research and
deliver the guide directly. A later change of mode continues the existing work.

Honor the requested prompt count and any explicit grouping. Otherwise, choose a
useful number from the scope and briefly explain the grouping. Combine related
fields or split a broad field into complementary research directions. Give every
requested field clear coverage; organize by substantive connections rather than
equal-sized groups. Ask only when an unresolved scope choice would materially
change the work.

The final guide defaults to **English, approximately 4,000 main-text words,
excluding references**, across all requested fields. Prompts and returned reports
may use the user's language while retaining established technical terms. Honor
explicit language and length overrides. Prefer selection and compression to
expansion; if essential connections still require substantially more space,
propose a specific increase and its content tradeoff for approval.

## Prepare research prompts

Read [Research design and source practice](references/research.md).

Write the requested number of clearly separated, independently copyable prompts,
preceded by a brief scope/grouping explanation. Each prompt is a complete research
brief: purpose, field scope, substantive directions, source expectations, and the
complete knowledge report to return. Include the context an external researcher
needs; it cannot see this conversation, the skill files, or the other prompts.

In manual mode, deliver the prompts and wait for the reports. A prompt-only request
ends here. In auto mode, retain the same prompts and execute them without a handoff
or an approval step for each group.

## Research and integrate

Use the source practice in [research.md](references/research.md) in either mode.

**Returned reports:** Read the supplied reports in full, including source notes.
Relate their coverage to the agreed fields, identify overlap and useful connections,
and examine consequential disagreements or missing foundations. Accept reports
incrementally and continue from the material already received. If more reports
are forthcoming, wait to finalize until they arrive or the user asks you to proceed.

**Auto:** Execute the research prompts using available search, retrieval, and
source-reading tools. Work sequentially or delegate bounded groups where useful.
The user need not relay reports or approve routine research steps.

In both modes, re-read, reinterpret, and supplement the material as needed within
the agreed scope. Resolve important gaps and conflicts through targeted research;
when another external research session is needed, provide a focused follow-up
prompt. Respect any user-specified limits on source use. Synthesize when the
foundations and central connections are supported and further reading would
mainly add redundant examples.

## Write the field guide

Read [Field-guide editing](references/field-guide.md). Select the concepts and
relationships that will carry the guide, then rewrite the material as one coherent
account. Research groups and returned-report outlines need not become chapters.

For editorial calibration, use the [example index](examples/README.md) to choose
a relevant guide. Learn from its explanatory depth, terminology, and selection,
not its disciplinary scope or chapter structure.

## Save and deliver

Save only the research prompts and final guide in the user's chosen workspace.
Keep working notes, source extracts, intermediate reports, and drafts in context,
not in separate files. Read user-supplied reports where they are and leave those
inputs unchanged. Reuse the agreed guide path for revisions; keep unrelated files
and the installed skill directory unchanged.

In manual mode, make the prompts available at handoff. In auto mode, make them
available with the final guide. Deliver full Markdown in the conversation when
files are not requested or available.

Review explanations, terminology, selection, and citation support. Check the
finished guide's body length and footnotes with the bundled helper:

```bash
python3 <skill-dir>/scripts/check_guide.py <guide.md> --budget 4000
```

Resolve `<skill-dir>` to the canonical skill directory and use the agreed budget.
For an inline guide, pass `-` and its complete Markdown on standard input. A custom
bibliography heading can use `--references-heading "Heading text"`. The helper
checks approximate English word counts and footnote consistency; scientific and
editorial quality require reading the guide. Use a suitable length measure for
other languages, and distinguish estimates from measured counts.

Deliver the completed guide with its body length excluding references and
reference count. Mention coverage or source-access limitations only when they
materially affect the result.
