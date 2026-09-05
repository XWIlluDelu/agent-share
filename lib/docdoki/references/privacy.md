# Privacy

Read this when setting up a library, handling private material, producing public
output from mixed sources, or changing paths and references. The boundary applies
to every operation, including questions and handoffs.

## One library, two visibility scopes

Public documents live under `docdoki/` outside `private/`. Local-only documents
live under `docdoki/private/`, using the same spec, stage, and note schemas.
Visibility is determined by path; do not add a `private` or `visibility` metadata
field as an access-control substitute. `northstar.md` and `spec_abstract.md`
remain public, not duplicated private authorities.

Private documents may reference public ones. Public documents, links, `after`
dependencies, summaries, and public-facing answers must neither depend on nor
expose private content. A public clone must remain understandable and truthful
without the overlay. Keep document stems unique across both scopes and archives.

Decide placement by the information's use and disclosure authority. A durable
local host alias or machine path may belong in a private note; a temporary
location needed to resume belongs in a private stage. Public documents describe
independently supported portable requirements, not the local identities behind
them. Public work needs sufficient public continuation state; do not make a
private stage its only handoff.

An ordinary cleanup, close, or alignment operation does not authorize changing
visibility. Obtain explicit disclosure intent before moving private content into
public documents, even if it seems harmless. Sanitizing a summary is not enough
if it still reveals private facts or depends on a private source. For mixed work,
retain public facts in public records and local additions privately, with links
only in the permitted direction. Ask about audience when it materially affects
what can be safely included.

Credentials, private keys, and tokens belong in their credential system, never
in either document scope. Git ignore is not a secret vault.

## Establish and check the boundary

Append this entry to the **unit's** `.gitignore` without replacing existing rules:

```gitignore
/docdoki/private/
```

A unit may be the repository root or a child directory. The rule is anchored to
that unit; private `covers` and stage `scope` still refer to its code root.
Ensure the boundary is in place before creating private documents. If a private
file is already tracked, ignoring it does not untrack it or erase earlier commits.
Stop further disclosure, report the affected paths without echoing their contents,
and agree on index/history remediation. Do not rewrite history unasked. Rotate
any exposed credential through its owner; deleting a document is not rotation.

Run the bundled checker after `init`/`adopt` setup and whenever document paths,
references, or visibility change. Resolve the script against the **installed
skill root**, not the project directory. For example, after substituting the
actual two absolute paths:

```sh
python3 /absolute/path/to/docdoki-skill/scripts/check_privacy.py /absolute/path/to/unit
```

It requires Python 3 and Git and reads without modifying the project. It checks
current ignored/untracked state, duplicate stems, and recognized public-to-private
references. Passing does not prove an absence of sensitive prose, historical
leaks, unsafe symlinks, or undiscovered references. Review content and destinations
as well. Do not suppress a failure by weakening the checker or publishing the
private document. If Git is unavailable, report the check as blocked and do not
claim that ignoring or protection has been verified.

Private files have no recovery history in the public repository. If private
versioned recovery is wanted, a separately access-controlled repository may own
that subtree while the parent still ignores it. Setting up that repository is a
separate choice, not automatic `init` work. Preserve valuable uncommitted content
before destructive cleanup; a later commit cannot recover text already deleted.
