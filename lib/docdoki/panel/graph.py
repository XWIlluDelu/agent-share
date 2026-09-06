"""Document catalog and linear-time dependency analysis; no implementation inference."""
from __future__ import annotations

import subprocess
from collections import Counter, deque
from datetime import datetime, timezone
from pathlib import Path

from documents import document


def library_paths(dd: Path) -> list[Path]:
    paths = [dd / "northstar.md", dd / "spec_abstract.md"]
    for base in (dd, dd / "private"):
        for kind in ("specs", "stages", "notes"):
            paths.extend((base / kind).rglob("*.md"))
    return sorted({p for p in paths if p.is_file()})


def allowed_path(root: Path, raw: str) -> Path:
    if not isinstance(raw, str) or Path(raw).is_absolute():
        raise ValueError("bad path")
    path = root / raw
    if ".." in Path(raw).parts or path.suffix != ".md":
        raise ValueError("bad path")
    if any(p.is_symlink() for p in (path, *path.parents) if p != root.parent):
        raise ValueError("symlink document paths are not supported")
    parts = Path(raw).parts
    tail = parts[1:] if parts and parts[0] == "docdoki" else ()
    top = tail in (("northstar.md",), ("spec_abstract.md",))
    if tail[:1] == ("private",):
        tail = tail[1:]
    section = len(tail) >= 2 and tail[0] in ("specs", "stages", "notes")
    if not (top or section) or not path.is_file():
        raise ValueError("missing or unsupported document path: " + raw)
    return path


def analyze(nodes: list[dict]) -> list[dict]:
    diagnostics = []

    def report(code, node, message):
        diagnostics.append({"code": code, "path": node["path"], "message": message})

    counts = Counter(n["stem"] for n in nodes)
    by_stem = {n["stem"]: n for n in nodes if counts[n["stem"]] == 1}
    outgoing = {n["path"]: [] for n in nodes}
    indegree = {n["path"]: 0 for n in nodes}
    columns = {n["path"]: 1 for n in nodes}
    for node in nodes:
        value = node.get("after")
        if value is None:
            value = []
        if not isinstance(value, list) or any(not isinstance(v, str) or not v for v in value):
            report("after-type", node, "after must be a list of nonempty document stems")
            value = []
        seen = set()
        valid = []
        for stem in value:
            if stem in seen:
                report("duplicate-edge", node, "Repeated dependency: " + stem)
                continue
            seen.add(stem)
            parent = by_stem.get(stem)
            if not parent:
                report("missing-edge", node, "Missing or ambiguous dependency: " + stem)
                continue
            if parent["path"] == node["path"]:
                report("self-edge", node, "A spec cannot depend on itself")
                continue
            if parent["private"] and not node["private"]:
                report("private-edge", node, "A shared spec cannot depend on a private spec")
                continue
            valid.append(stem)
            outgoing[parent["path"]].append(node["path"])
            indegree[node["path"]] += 1
        node["validAfter"] = valid
    queue = deque(path for path, degree in indegree.items() if degree == 0)
    while queue:
        path = queue.popleft()
        for child in outgoing[path]:
            columns[child] = max(columns[child], columns[path] + 1)
            indegree[child] -= 1
            if not indegree[child]:
                queue.append(child)
    for node in nodes:
        if indegree[node["path"]]:
            report("cycle", node, "Dependency cycle, or blocked by a cyclic dependency")
        node["col"] = columns[node["path"]] if not indegree[node["path"]] else 1
    return diagnostics


def build_graph(dd: Path, overrides: dict[str, str] | None = None, extra=()) -> dict:
    root = dd.parent
    overrides = overrides or {}
    extra = set(extra) | overrides.keys()
    catalog, docs, diagnostics = [], {}, []
    for path in library_paths(dd):
        relative = path.relative_to(root).as_posix()
        parts = path.relative_to(dd).parts
        private = parts[0] == "private"
        archived = "archive" in parts
        kind = next((k[:-1] for k in ("specs", "stages", "notes") if k in parts), "overview")
        entry = {"path": relative, "stem": path.stem, "title": path.stem,
                 "kind": kind, "private": private, "archived": archived}
        if any(p.is_symlink() for p in (path, *path.parents) if p != root.parent):
            diagnostics.append({"code": "symlink", "path": relative, "message": "Symlink document omitted"})
            continue
        catalog.append(entry)
        if (not archived and kind != "note") or relative in extra:
            try:
                doc = document(path, root, overrides.get(relative))
                docs[relative] = doc
                entry["title"] = doc["title"]
                if doc["error"]:
                    diagnostics.append({"code": "format", "path": relative, "message": doc["error"]})
            except (OSError, UnicodeError) as exc:
                diagnostics.append({"code": "read", "path": relative, "message": str(exc)})
    counts = Counter(item["stem"] for item in catalog)
    for item in catalog:
        if counts[item["stem"]] > 1:
            diagnostics.append({"code": "duplicate-stem", "path": item["path"],
                                "message": "Ambiguous document stem: " + item["stem"]})
    nodes = []
    for doc in docs.values():
        if doc["kind"] != "spec" or doc["archived"]:
            continue
        fm = doc["fm"]
        purpose, progress, covers = fm.get("purpose", ""), fm.get("progress"), fm.get("covers") or []
        for field, valid in (("purpose", isinstance(purpose, str)),
                             ("progress", progress in (None, "not-started", "in-progress", "done")),
                             ("covers", isinstance(covers, list) and all(isinstance(v, str) for v in covers))):
            if not valid:
                diagnostics.append({"code": "field", "path": doc["path"], "message": "Invalid " + field + " value"})
        nodes.append({"id": doc["path"], "path": doc["path"], "stem": doc["stem"],
                      "title": doc["title"], "content": purpose if isinstance(purpose, str) else "",
                      "progress": progress if isinstance(progress, str) else None,
                      "after": fm.get("after"), "covers": covers, "private": doc["private"]})
    diagnostics.extend(analyze(nodes))
    try:
        branch = subprocess.run(["git", "-C", str(root), "branch", "--show-current"],
                                capture_output=True, text=True, timeout=2).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        branch = ""
    return {"nodes": nodes, "documents": docs, "catalog": catalog, "diagnostics": diagnostics,
            "meta": {"title": root.name, "root": str(root), "branch": branch,
                     "loadedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                     "includesPrivate": any(d["private"] for d in catalog)}}
