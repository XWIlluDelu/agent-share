# Field-guide editing

- [Choose the knowledge spine](#choose-the-knowledge-spine)
- [Write useful scientific prose](#write-useful-scientific-prose)
- [Apply the agreed editorial budget](#apply-the-agreed-editorial-budget)
- [Select and format references](#select-and-format-references)
- [Finish with an editorial pass](#finish-with-an-editorial-pass)

## Choose the knowledge spine

Read across the reports before choosing an outline. Identify the small set of
concepts, phenomena, explanatory relationships, and measurement distinctions
that will help an experienced technical collaborator enter the field. Use that
spine to decide what stays. Report length, chronological research order, and the
number of original fields are not measures of a topic's editorial importance.

Combine overlapping material by rewriting its explanation. Keep a concrete case
when it carries several useful ideas; omit other cases that mainly repeat it.
Preserve core connections across levels or subfields, even if doing so means
removing a long list of individually interesting details. The full reports can
retain the wider coverage.

Organize chapters, subheadings, and tables around the selected content. A methods
comparison may deserve a table; a developmental account may need connected prose.
Merge sections with overlapping explanatory work and split sections that contain
different operations or questions. There is no fixed chapter count, prescribed
neuroscience syllabus, or requirement to reproduce the outline of a style model.

## Write useful scientific prose

Explain what concepts mean and how they are used. Connect theory to concrete
phenomena and, where relevant, to data or model operations. Retain equations when
they make a quantity or operation substantially clearer. Briefly define their
variables, units, and relevant assumptions. A few well-chosen analyses are more
useful than a complete list of metrics and preprocessing steps.

Let the knowledge carry the research judgment. For example:

- Replace “a classifier does not prove a mechanism” repeated after every analysis
  with a description of what was decoded, which conditions were held out, and
  how that finding relates to the substantive question.
- Preserve distinctions such as an estimate versus its target quantity, or a
  within-person change versus a between-group comparison. They add knowledge
  rather than serving as generic caution.
- Explain the operations a model performs and the results it accounts for;
  discuss unsettled implementation when it matters to the claim at hand.

Use the discipline's established terminology, not generic engineering metaphors
or invented labels. Explain a term at its first substantive use; retain a compact
terminology comparison only when it adds a useful distinction or supports lookup.
Professional writing examples should name quantities and comparisons. Label
invented teaching examples and illustrative formulations as such.

Keep observations, source authors' interpretations, and your synthesis distinct.
Allow exploratory results to remain useful at their current stage. Attribute
consequential claims and preserve real disagreements rather than surrounding
every paragraph with a declaration that nothing has been proved.

The guide should stand on its own: explain essential prerequisites and do not
make a reader reconstruct the original research sessions. A project can supply
motivation, but avoid project paths, private datasets, implementation plans, or
acceptance gates in the reusable knowledge body. Keep production history,
archiving details, and references to local working materials out of guides and
example indexes; these do not contribute to the reader's field knowledge.

## Apply the agreed editorial budget

Use the language and body budget established in SKILL.md or overridden by the
user. Count the main text separately from the bibliography; tables and substantive
captions are part of the body. Do not hide surplus content in giant appendices or
count references as a reason to shrink useful explanations.

First improve selection and remove redundant definitions, examples, and generic
warnings. If important connections still need substantially more space, request
a specific increase before drafting beyond the agreed budget. Explain the
content tradeoff. A shorter coherent guide needs no padding to hit a target.

## Select and format references

Choose a small set of useful reviews and empirical or methodological anchors.
Support the guide's particular claims and offer good reading entry points. Do
not transfer every source from the reports, and do not reduce apparent reference
count by hiding bundles of unrelated papers in one entry. No fixed citation quota
can replace this selection.

Use Markdown footnotes. In each entry, give author surnames, year, linked title,
italicized publication or book information, and a short note about its relevance.
For up to four authors, list all surnames; for more than four, use the first
surname followed by `et al.`. In prose, a phrase such as “X and colleagues” is fine.
Verify the actual author list before deciding whether to abbreviate it.

A schematic format (replace every placeholder with verified metadata):

```markdown
[^key]: Surname, Surname & Surname (Year). [Title](DOI-or-stable-URL).
    *Publication*. Brief reading or scientific contribution.
```

Check that links identify the cited work, titles and author order match the
source, and all footnote markers resolve. Prefer accessible source links when
helpful; DOI and stable full-text links can use the same citation format.

Describe source access honestly in the research records or handoff. A guide
synthesized from supplied reports is not a new independent reading of all their
original papers. Keep these process notes outside the reusable guide while
preserving scientifically material limitations alongside the claims they qualify.
Do not cite a source as support merely to preserve a short bibliography when it
does not support the relevant claim.

## Finish with an editorial pass

Read for coherence, not just coverage. Check that key terms have usable meanings,
examples explain something, chapter boundaries follow the argument, and analysis
detail serves the field's substantive questions. Remove repeated setup and
boilerplate without deleting important scientific distinctions. Verify body
length and references, deliver the artifact, and stop rather than proposing
another expansion by default.
