# Privacy

## One library, two visibility scopes

- Public documents live under `docdoki/` outside `private/`.
- Local-only documents live under `docdoki/private/`, using the same `specs/`, `work/`, and `notes/` schemas.
- Visibility comes strictly from the path—never add a `private` frontmatter field as an access-control substitute. `northstar.md` and `overview.md` stay public.
- **Direction rule:** Private documents may reference public ones. Public documents, links, `after`/`specs`/`relates` fields, and public-facing answers must neither depend on nor expose private content. A public clone must remain coherent and resumable without the overlay.
- **Disclosure rule:** Routine maintenance, grooming, or closing work never authorizes moving private facts into public documents. Require explicit disclosure intent first.
- **No secrets:** Never store credentials, tokens, or private keys in either scope. `.gitignore` is not a secret vault.

## Establish and check the boundary

Append this anchored rule to the **unit's** `.gitignore` without replacing existing rules:

```gitignore
/docdoki/private/
```

Verify the boundary after setup and whenever document paths, links, or visibility change:

```sh
python3 /path/to/docdoki/scripts/validate.py /path/to/unit
# or privacy-only:
python3 /path/to/docdoki/scripts/validate.py /path/to/unit --privacy
```

`validate.py` checks Git ignore rules, tracked private files, duplicate stems across scopes/archives, and recognized public-to-private references without modifying the project. Passing does not guarantee the absence of sensitive prose or historical commits—review prose as well.

If a private file is already tracked by Git, stop further disclosure, report the affected paths without echoing contents, and agree on index/history remediation before rewriting history. Rotate any exposed credential through its owner.

Private files have no recovery history in the public repository; if versioned recovery is needed, a separate access-controlled repository may own `docdoki/private/` while the parent ignores it.
