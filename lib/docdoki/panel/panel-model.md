# Panel: macro intent

This records only the macro thinking behind the panel — its nature, philosophy, and
purpose. The concrete form lives elsewhere: the visual contract in `panel-design.md`, the
tool in `panel.py`.

The panel is docdoki's secondary surface, an optional extension outside the core skill.
It makes no semantic judgment — it only *presents* the document library; understanding,
propagation, and alignment stay with the agent through `follow` and the other protocols.
Without it the library still works in full; with it, a human just sees the documents more
easily and is more willing to maintain them.

Its nature is presentation. The panel reads project facts from documents and computes
only view state: layout, grouping, and panel-owned display defaults such as absent
`progress` rendering as `not-started`. It does not infer new project facts. It generally
shows only the *important* information, organized in the most intuitive way, without
being bound by which documents that information happens to be scattered across.
An intuitive, interactive surface lowers the barrier to using the system and raises the
will to use it; the panel is not built for any single purpose — it serves to let a human
understand and steer the project more easily.

The panel both shows and edits. Editing on the panel is editing the documents: saving
writes straight back to the file. After an edit you either have the agent `follow` it
directly, or copy the prompt the panel assembles and use that to drive `follow`. Either
way, what you write is rough intent that the agent re-understands, polishes, and
propagates into the other documents and the code — the panel never does this itself.

It mainly serves to let a human see the project's overall architecture and the flow and
progress of development, and these are one thing: architecture is the flow at rest,
progress is that same structure carrying state.

Running through all of it is one restraint: the panel must not push the document system
toward complexity for its own sake. Whatever it wants to show must first exist as a fact
in the documents, not as a parallel structure stood up for the panel. This does not
forbid slight adjustments to the library — the schema has room to improve, and the
panel's needs can be an occasion to refine it — but any adjustment should move the
document model toward being better in itself, never pile on to suit the panel's
convenience.
