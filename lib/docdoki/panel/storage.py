"""Optimistic source replacement, structured card transforms, and document creation."""
from __future__ import annotations

import json
import os
import re
import secrets
import sys
import threading
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from docdoki_lib import (
    allowed_path,
    document,
    library_paths,
    read_source,
    set_after,
    set_card_field,
    split_frontmatter,
    visibility_error,
)
from graph import build_graph

WRITE_LOCK = threading.Lock()
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def prepare(root: Path, edits: list[dict]) -> tuple[dict[Path, str], dict[Path, str]]:
    if not isinstance(edits, list) or not edits:
        raise ValueError("save requires a non-empty edits list")
    originals: dict[Path, str] = {}
    pending: dict[Path, str] = {}
    for edit in edits:
        if not isinstance(edit, dict) or edit.get("field") != "source":
            raise ValueError("Edit the complete document source; fragment writes are not supported")
        path = allowed_path(root, edit.get("path"))
        if path in pending:
            raise ValueError("Only one source edit per document is supported")
        if not isinstance(edit.get("from"), str) or not isinstance(edit.get("to"), str):
            raise ValueError("Source edits require string from/to preconditions")
        original = read_source(path)
        if original != edit["from"]:
            raise ValueError("conflict: " + edit["path"] + " changed since it was loaded; compare latest before retrying")
        proposed = edit["to"]
        split_frontmatter(proposed)
        error = visibility_error(root, path, proposed)
        if error:
            raise ValueError(error)
        originals[path] = original
        pending[path] = proposed
    return originals, pending


def validate_graph_changes(dd: Path, baseline_overrides: dict[str, str], next_overrides: dict[str, str]) -> dict:
    """Build updated graph and reject any newly introduced diagnostics."""
    graph = build_graph(dd, next_overrides)
    if not graph["diagnostics"]:
        return graph
    baseline = build_graph(dd, baseline_overrides)
    existing = {(d["code"], d["path"], d["message"]) for d in baseline["diagnostics"]}
    new = [d for d in graph["diagnostics"] if (d["code"], d["path"], d["message"]) not in existing]
    if new:
        raise ValueError("; ".join(d["path"] + ": " + d["message"] for d in new))
    return graph


def transform(root: Path, overrides: dict[str, str] | None = None, *, card=None, after=None) -> dict:
    """Apply a single card field or dependency change (or validate draft overrides) without writing to disk."""
    if card is not None and after is not None:
        raise ValueError("Apply one structured operation at a time")
    overrides = overrides or {}
    if not isinstance(overrides, dict) or any(not isinstance(v, str) for v in overrides.values()):
        raise ValueError("overrides must map document paths to source strings")

    validated_overrides: dict[str, str] = {}
    for rel, text in overrides.items():
        path = allowed_path(root, rel)
        split_frontmatter(text)
        err = visibility_error(root, path, text)
        if err:
            raise ValueError(err)
        validated_overrides[rel] = text

    baseline_overrides = dict(validated_overrides)
    changed_path: str | None = None
    proposed: str | None = None

    if after is not None:
        if (
            not isinstance(after, dict)
            or after.get("op") not in ("add", "remove")
            or not isinstance(after.get("stem"), str)
            or not after["stem"]
        ):
            raise ValueError("Dependency edit requires an add/remove op and a document stem")
        rel = after.get("path")
        path = allowed_path(root, rel)
        current_source = validated_overrides.get(rel) if rel in validated_overrides else read_source(path)
        items = split_frontmatter(current_source)[0].get("after")
        if items is None:
            items = []
        if not isinstance(items, list) or any(not isinstance(v, str) for v in items):
            raise ValueError("after must be a list of document stems")
        stem = after["stem"]
        if after["op"] == "remove":
            updated = [item for item in items if item != stem]
        else:
            updated = items if stem in items else [*items, stem]
        proposed = set_after(current_source, updated) if updated != items else current_source
        changed_path = rel
    elif card is not None:
        if not isinstance(card, dict) or "value" not in card:
            raise ValueError("Card edit requires a field and an explicit value")
        rel = card.get("path")
        path = allowed_path(root, rel)
        if "specs" not in path.relative_to(root / "docdoki").parts:
            raise ValueError("Card fields belong to specs")
        current_source = validated_overrides.get(rel) if rel in validated_overrides else read_source(path)
        proposed = set_card_field(current_source, card.get("field"), card["value"])
        changed_path = rel

    if changed_path is not None and proposed is not None:
        err = visibility_error(root, root / changed_path, proposed)
        if err:
            raise ValueError(err)
        validated_overrides[changed_path] = proposed

    graph = validate_graph_changes(root / "docdoki", baseline_overrides, validated_overrides)
    result = {"ok": True, "graph": graph}
    if changed_path is not None and proposed is not None:
        result["path"] = changed_path
        result["source"] = proposed
    return result


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(8)}.tmp")
    mode = (path.stat().st_mode & 0o7777) if path.exists() else 0o644
    try:
        with temporary.open("x", encoding="utf-8", newline="") as stream:
            os.chmod(temporary, mode)
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def create_document(
    root: Path,
    kind: str,
    slug: str,
    title: str,
    *,
    private: bool = False,
    area: str = "",
    purpose: str = "",
    specs: list[str] | None = None,
) -> dict:
    """Create a new spec, work item, or note using the canonical DocDoki schema."""
    kind_dirs = {"spec": "specs", "work": "work", "note": "notes"}
    if kind not in kind_dirs:
        raise ValueError("kind must be spec, work, or note")
    if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
        raise ValueError("slug must be lowercase kebab-case (a-z, 0-9, hyphens)")
    if not isinstance(title, str) or not title.strip() or any(c in title for c in "\r\n\0"):
        raise ValueError("title must be non-empty single-line text")
    title = title.strip()
    area_clean = area.strip()
    purpose_clean = purpose.strip()
    if any(c in area_clean for c in "\r\n\0") or "\0" in purpose_clean:
        raise ValueError("invalid control character in metadata")

    prefix = "docdoki/private/" if private else "docdoki/"
    rel = f"{prefix}{kind_dirs[kind]}/{slug}.md"

    with WRITE_LOCK:
        path = allowed_path(root, rel, must_exist=False)
        if path.exists():
            raise ValueError(f"document already exists: {rel}")
        existing_stems = {p.stem for p in library_paths(root / "docdoki")}
        if slug in existing_stems:
            raise ValueError(f"document stem already exists in this unit: {slug}")

        if kind == "spec":
            fm_lines = [f"purpose: {json.dumps(purpose_clean or 'Describe core obligations.', ensure_ascii=False)}"]
            if area_clean:
                fm_lines.append(f"area: {json.dumps(area_clean, ensure_ascii=False)}")
            fm_lines.extend(["status: proposed", "progress: not-started", "covers: []"])
            source = (
                "---\n" + "\n".join(fm_lines) + "\n---\n\n"
                f"# {title}\n\n## Goal\n\n- \n\n## Checks\n\n- \n"
            )
        elif kind == "work":
            spec_list = [s.strip() for s in (specs or []) if isinstance(s, str) and s.strip()]
            fm_lines = [f"specs: {json.dumps(spec_list, ensure_ascii=False)}", "scope: []", "status: active"]
            source = (
                "---\n" + "\n".join(fm_lines) + "\n---\n\n"
                f"# {title}\n\n## Objective\n\n\n## Current state\n\n- Working:\n- Broken/Blocked:\n- Not checked:\n\n## Next actions\n\n- [ ] \n"
            )
        else:
            fm_lines = []
            if purpose_clean:
                fm_lines.append(f"purpose: {json.dumps(purpose_clean, ensure_ascii=False)}")
            spec_list = [s.strip() for s in (specs or []) if isinstance(s, str) and s.strip()]
            if spec_list:
                fm_lines.append(f"relates: {json.dumps(spec_list, ensure_ascii=False)}")
            header = ("---\n" + "\n".join(fm_lines) + "\n---\n\n") if fm_lines else ""
            source = f"{header}# {title}\n\n"

        err = visibility_error(root, path, source)
        if err:
            raise ValueError(err)

        atomic_write(path, source)
        doc = document(path, root)
        graph = build_graph(root / "docdoki", extra=[rel])
        return {"ok": True, "path": rel, "document": doc, "graph": graph}


def apply_edits(root: Path, edits: list[dict]) -> dict:
    with WRITE_LOCK:
        originals: dict[Path, str] = {}
        pending: dict[Path, str] = {}
        written: list[Path] = []
        try:
            originals, pending = prepare(root, edits)
            validate_graph_changes(
                root / "docdoki",
                {p.relative_to(root).as_posix(): text for p, text in originals.items()},
                {p.relative_to(root).as_posix(): text for p, text in pending.items()},
            )
            for path, original in originals.items():
                if read_source(path) != original:
                    raise ValueError("conflict: file changed during save: " + str(path))
            for path, source in pending.items():
                allowed_path(root, path.relative_to(root).as_posix())
                if read_source(path) != originals[path]:
                    raise ValueError("conflict: file changed during save: " + str(path))
                atomic_write(path, source)
                written.append(path)
            docs = {p.relative_to(root).as_posix(): document(p, root) for p in pending}
            if any(docs[p.relative_to(root).as_posix()]["source"] != text for p, text in pending.items()):
                raise ValueError("conflict: a file changed immediately after save")
            return {
                "ok": True,
                "documents": docs,
                "receipt": [
                    {
                        "path": p.relative_to(root).as_posix(),
                        "from": originals[p],
                        "to": docs[p.relative_to(root).as_posix()]["source"],
                        "private": p.is_relative_to(root / "docdoki/private"),
                    }
                    for p in pending
                ],
            }
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
                message += "; best-effort rollback " + (
                    "incomplete: " + "; ".join(rollback_errors) if rollback_errors else "completed"
                )
            return {"ok": False, "error": message}
