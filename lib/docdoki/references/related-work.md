# Related work

## Shared project knowledge

[Harness engineering](https://openai.com/index/harness-engineering/) combines a
thin entrypoint, repository knowledge, agent maintenance, and deterministic
checks. [Cline Memory Bank](https://github.com/cline/prompts/blob/main/.clinerules/memory-bank.md)
distributes goals, architecture, and current state across a small set of files,
with updates prompted by discoveries and changes as well as explicit requests.
These approaches inform DocDoki's human-readable overview and on-demand detail,
without requiring their surrounding platforms.

[Spec Kit](https://github.com/github/spec-kit) and
[Kiro Specs](https://kiro.dev/docs/specs/) separate requirements, design, planning,
and implementation. [OpenSpec](https://github.com/Fission-AI/OpenSpec) separates a
current baseline from proposed changes. DocDoki uses a different boundary:
decided targets belong in specs even when unimplemented; stages hold the gaps
and next actions. A separate change-package system is unnecessary for this model.

## Maintenance and continuity

[Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
and [Agent Skills guidance](https://agentskills.io/skill-creation/best-practices)
support direct instructions and progressive disclosure. Keep the complete rule
in one place, with short reminders at consequential steps rather than a growing
collection of repeated warnings.

[Long-running agent practices](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
support persistent progress, but particular compensation mechanisms depend on
the model and host. DocDoki does not require context-pressure notifications,
fixed compaction intervals, background workers, or multi-agent approval.

[Living Documentation](https://books.google.com/books/about/Living_Documentation.html?id=8_6ZDwAAQBAJ)
and [executable documentation](https://docs.python.org/3/library/doctest.html)
connect documentation with implementation and checks. This is useful for
conformance evidence, but generating all design from code would erase intent
and requirements the code does not yet satisfy.

## Verification without a separate platform

[Skill evaluation guidance](https://developers.openai.com/blog/eval-skills)
supports inspecting actual artifacts and tool calls rather than trusting a
completion claim. Static validation and the private-boundary checker catch
mechanical errors; a few representative tasks test behavior. These are
complementary, not reasons to embed a model-specific evaluation platform.

[AGENTS.md studies](https://arxiv.org/abs/2602.11988v2) and
[related efficiency research](https://arxiv.org/abs/2601.20404v2) examine different
conditions and outcomes. They do not establish that this particular skill
improves success rates, token cost, or human review effort. The approaches above
are design references, not evidence that DocDoki is uniquely correct or that
all their mechanisms have been reproduced here.
