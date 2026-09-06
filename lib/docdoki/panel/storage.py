"""Optimistic source replacement for a local, single-writer save window.

The lock coordinates this server's requests, not arbitrary editors. External
writers must pause while saving. Prechecks, atomic per-file replacement and
best-effort rollback do not constitute a filesystem compare-and-swap transaction.
"""
from __future__ import annotations

import os
import re
import secrets
import threading
from pathlib import Path
from urllib.parse import unquote

from documents import document, read_source, set_after, split_frontmatter
from graph import allowed_path, build_graph, library_paths

WRITE_LOCK = threading.Lock()


def visibility_error(root: Path, path: Path, source: str) -> str | None:
    private = root / "docdoki/private"
    if path.is_relative_to(private):
        return None
    stems = {p.stem for p in library_paths(root / "docdoki") if p.is_relative_to(private)}
    fm, _ = split_frontmatter(source)
    after = fm.get("after") or []
    targets = after if isinstance(after, list) else []
    targets = [str(v) for v in targets] + re.findall(r"\[\[([^\]#|]+)(?:[#|][^\]]*)?\]\]", source)
    for target in targets:
        target = target.replace("\\", "/").strip()
        if target.removesuffix(".md").rsplit("/", 1)[-1] in stems or target.startswith(("private/", "docdoki/private/")):
            return "Shared document cannot reference a private document: " + target
    hrefs = re.findall(r"\]\(([^)\s]+)(?:\s+[^)]*)?\)", source)
    hrefs += re.findall(r"(?<![\w/.-])((?:(?:\.\.?)/)*private/[^\s`'\"\)\]]+)", source)
    for href in hrefs:
        if "://" in href or href.startswith(("#", "mailto:")):
            continue
        target = (path.parent / unquote(href.split("#", 1)[0])).resolve()
        if target.is_relative_to(private):
            return "Shared document cannot contain a private path"
    if "docdoki/private/" in source:
        return "Shared document cannot contain a private path"
    return None


def prepare(root: Path, edits: list[dict], check_disk=True) -> tuple[dict, dict]:
    if not isinstance(edits, list) or not edits:
        raise ValueError("save requires a non-empty edits list")
    originals, pending = {}, {}
    for edit in edits:
        if not isinstance(edit, dict) or edit.get("field") != "source":
            raise ValueError("Edit the complete document source; fragment writes are not supported")
        path = allowed_path(root, edit.get("path"))
        if path in pending:
            raise ValueError("Only one source edit per document is supported")
        if not isinstance(edit.get("from"), str) or not isinstance(edit.get("to"), str):
            raise ValueError("Source edits require string from/to preconditions")
        original = read_source(path)
        if check_disk and original != edit["from"]:
            raise ValueError("conflict: " + edit["path"] + " changed since it was loaded; compare latest before retrying")
        proposed = edit["to"]
        split_frontmatter(proposed)
        error = visibility_error(root, path, proposed)
        if error:
            raise ValueError(error)
        originals[path] = original
        pending[path] = proposed
    return originals, pending


def validate_graph(dd: Path, originals: dict, pending: dict) -> dict:
    overrides = {p.relative_to(dd.parent).as_posix(): text for p, text in pending.items()}
    graph = build_graph(dd, overrides)
    baseline = build_graph(dd, {p.relative_to(dd.parent).as_posix(): text for p, text in originals.items()})
    existing = {(d["code"], d["path"], d["message"]) for d in baseline["diagnostics"]}
    new = [d for d in graph["diagnostics"] if (d["code"], d["path"], d["message"]) not in existing]
    if new:
        raise ValueError("; ".join(d["path"] + ": " + d["message"] for d in new))
    return graph


def preview(root: Path, edits: list[dict], after: dict | None = None, extra=(), base=None) -> dict:
    # Render the client's snapshot plus drafts, not a mixture of newly read disk
    # content and old edit preconditions. Refresh/Compare latest are explicit.
    originals = {}
    if base is not None:
        if not isinstance(base, dict) or any(not isinstance(v, str) for v in base.values()):
            raise ValueError("preview base must map document paths to sources")
        originals = {allowed_path(root, p): text for p, text in base.items()}
    pending = dict(originals)
    if edits:
        old, changed = prepare(root, edits, check_disk=False)
        for path, text in old.items():
            originals.setdefault(path, text)
        pending.update(changed)
    if after is not None:
        if (not isinstance(after, dict) or after.get("op") not in ("add", "remove")
                or not isinstance(after.get("stem"), str) or not after["stem"]):
            raise ValueError("Dependency edit requires an add/remove op and a document stem")
        path = allowed_path(root, after.get("path"))
        disk = read_source(path)
        original = pending.get(path, disk)
        originals.setdefault(path, disk)
        items = split_frontmatter(original)[0].get("after")
        if items is None:
            items = []
        if not isinstance(items, list) or any(not isinstance(v, str) for v in items):
            raise ValueError("after must be a list of document stems")
        # Apply the operation to canonical source, not the client's parsed view.
        stem = after["stem"]
        if after["op"] == "remove":
            updated = [item for item in items if item != stem]
        else:
            updated = items if stem in items else [*items, stem]
        proposed = set_after(original, updated) if updated != items else original
        error = visibility_error(root, path, proposed)
        if error:
            raise ValueError(error)
        pending[path] = proposed
        graph = validate_graph(root / "docdoki", originals, pending)
    else:
        graph = build_graph(root / "docdoki", {p.relative_to(root).as_posix(): s for p, s in pending.items()}, extra)
    return graph


def atomic_write(path: Path, text: str) -> None:
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(8)}.tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="") as stream:
            os.chmod(temporary, path.stat().st_mode & 0o7777)
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def apply_edits(root: Path, edits: list[dict]) -> dict:
    with WRITE_LOCK:
        originals, pending = {}, {}
        written = []
        try:
            originals, pending = prepare(root, edits)
            validate_graph(root / "docdoki", originals, pending)
            for path, original in originals.items():
                if read_source(path) != original:
                    raise ValueError("conflict: file changed during save: " + str(path))
            for path, source in pending.items():
                allowed_path(root, path.relative_to(root).as_posix())
                if read_source(path) != originals[path]:
                    raise ValueError("conflict: file changed during save: " + str(path))
                atomic_write(path, source)
                written.append(path)
            # Return storage results, not request values, as the next baseline.
            docs = {p.relative_to(root).as_posix(): document(p, root) for p in pending}
            if any(docs[p.relative_to(root).as_posix()]["source"] != text for p, text in pending.items()):
                raise ValueError("conflict: a file changed immediately after save")
            return {"ok": True, "documents": docs,
                    "receipt": [{"path": p.relative_to(root).as_posix(), "from": originals[p],
                                 "to": docs[p.relative_to(root).as_posix()]["source"],
                                 "private": p.is_relative_to(root / "docdoki/private")}
                                for p in pending]}
        except (OSError, ValueError, UnicodeError) as exc:
            rollback_errors = []
            for path in reversed(written):
                try:
                    if read_source(path) != pending[path]:
                        raise ValueError("file changed again; not rolled back")
                    atomic_write(path, originals[path])
                except (OSError, ValueError) as rollback:
                    rollback_errors.append(f"{path}: {rollback}")
            message = str(exc)
            if written:
                message += "; best-effort rollback " + ("incomplete: " + "; ".join(rollback_errors) if rollback_errors else "completed")
            # Memory-only recovery material. It cannot recover an uncoordinated
            # writer's bytes replaced in the final check-to-replace window.
            return {"ok": False, "error": message,
                    "recovery": [{"path": p.relative_to(root).as_posix(), "from": originals[p], "to": s}
                                 for p, s in pending.items()]}
