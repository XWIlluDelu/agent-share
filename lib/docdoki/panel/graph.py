"""Document catalog, steering summaries, backlinks, search, and spec DAG analysis."""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from docdoki_lib import (
    PROGRESS_VALUES,
    STATUS_VALUES,
    allowed_path,
    analyze_spec_graph,
    catalog_entry,
    document,
    document_title,
    extract_bullets,
    extract_section,
    extract_tasks,
    extract_unit_links,
    extract_wiki_stems,
    is_symlink_within,
    library_paths,
    read_source,
    split_frontmatter_raw,
)

DECISION_HEADINGS = ("open decisions", "human decisions", "review questions")


def _extract_doc_links(doc: dict, by_stem: dict[str, str], catalog_paths: set[str]) -> set[str]:
    """Return paths referenced by `doc` via wiki-links, frontmatter, or relative Markdown links."""
    targets: set[str] = set()
    fm = doc.get("fm") or {}
    for key in ("after", "specs", "relates"):
        vals = fm.get(key)
        if isinstance(vals, list):
            for stem in vals:
                if isinstance(stem, str) and stem in by_stem:
                    targets.add(by_stem[stem])

    _, body = split_frontmatter_raw(doc["source"])
    for raw in extract_wiki_stems(body):
        stem = raw.removesuffix(".md").rsplit("/", 1)[-1]
        if stem in by_stem:
            targets.add(by_stem[stem])

    doc_dir = Path(doc["path"]).parent
    for match in re.finditer(r"\]\(([^)\s]+)(?:\s+[^)]*)?\)", body):
        href = match.group(1)
        if "://" in href or href.startswith(("#", "mailto:")):
            continue
        clean = href.split("#", 1)[0]
        if not clean.endswith(".md"):
            continue
        parts = []
        base = () if clean.startswith("docdoki/") else doc_dir.parts
        for part in (*base, *Path(clean).parts):
            if part == "..":
                if parts:
                    parts.pop()
            elif part and part != ".":
                parts.append(part)
        resolved = "/".join(parts)
        if resolved in catalog_paths:
            targets.add(resolved)

    targets.discard(doc["path"])
    return targets


def _extract_overview_path(dd: Path) -> str:
    if (dd / "overview.md").is_file():
        return "docdoki/overview.md"
    if (dd / "spec_abstract.md").is_file():
        return "docdoki/spec_abstract.md"
    return "docdoki/overview.md"


def build_graph(dd: Path, overrides: dict[str, str] | None = None, extra=()) -> dict:
    root = dd.parent
    overrides = overrides or {}
    extra = set(extra) | overrides.keys()
    catalog: list[dict] = []
    docs: dict[str, dict] = {}
    all_loaded: dict[str, dict] = {}
    diagnostics: list[dict] = []

    for path in library_paths(dd):
        entry = catalog_entry(path, root)
        relative = entry["path"]
        if is_symlink_within(path, root):
            diagnostics.append({"code": "symlink", "path": relative, "message": "Symlink document omitted"})
            continue
        catalog.append(entry)
        try:
            should_ship = (not entry["archived"] and entry["kind"] != "note") or relative in extra
            if not entry["archived"] or relative in extra:
                doc = document(path, root, overrides.get(relative))
                entry["title"] = doc["title"]
                if entry["kind"] == "spec" and isinstance(doc["fm"].get("area"), str) and doc["fm"]["area"].strip():
                    entry["area"] = doc["fm"]["area"].strip()
                all_loaded[relative] = doc
                if should_ship:
                    docs[relative] = doc
                if doc["error"]:
                    diagnostics.append({"code": "format", "path": relative, "message": doc["error"]})
            else:
                entry["title"] = document_title(path)
        except (OSError, UnicodeError) as exc:
            diagnostics.append({"code": "read", "path": relative, "message": str(exc)})

    counts = Counter(item["stem"] for item in catalog)
    for item in catalog:
        if counts[item["stem"]] > 1:
            diagnostics.append({
                "code": "duplicate-stem",
                "path": item["path"],
                "message": "Ambiguous document stem: " + item["stem"],
            })

    by_stem = {item["stem"]: item["path"] for item in catalog if counts[item["stem"]] == 1}
    catalog_paths = {item["path"] for item in catalog}

    # Backlinks across all non-archived documents (including unopened notes!)
    backlinks: dict[str, list[str]] = {item["path"]: [] for item in catalog}
    for rel, doc in all_loaded.items():
        for target in _extract_doc_links(doc, by_stem, catalog_paths):
            backlinks.setdefault(target, []).append(rel)
    for rel in backlinks:
        backlinks[rel].sort()

    # Active work summaries
    work_items: list[dict] = []
    work_by_spec: dict[str, list[dict]] = {}
    for doc in docs.values():
        if doc["kind"] != "work" or doc["archived"]:
            continue
        fm = doc["fm"]
        _, body = split_frontmatter_raw(doc["source"])
        linked_specs = fm.get("specs") if isinstance(fm.get("specs"), list) else []
        linked_specs = [s for s in linked_specs if isinstance(s, str)]
        if not linked_specs:
            # Backward-compatible inference for legacy stages linking specs via [[stem]].
            spec_stems = {d["stem"] for d in docs.values() if d["kind"] == "spec" and not d["archived"]}
            linked_specs = sorted({
                raw.removesuffix(".md").rsplit("/", 1)[-1]
                for raw in extract_wiki_stems(body)
                if raw.removesuffix(".md").rsplit("/", 1)[-1] in spec_stems
            })
        objective = extract_section(body, ("objective",))
        state_sec = extract_section(body, ("current state",))
        state_bullets = extract_bullets(state_sec)[:4]
        tasks = extract_tasks(body)
        status = fm.get("status") if isinstance(fm.get("status"), str) else "active"
        if status.strip().lower() in ("done", "completed", "archived", "cancelled"):
            continue
        scope = fm.get("scope") if isinstance(fm.get("scope"), list) else []
        summary = {
            "path": doc["path"],
            "stem": doc["stem"],
            "title": doc["title"],
            "status": status,
            "specs": linked_specs,
            "scope": [s for s in scope if isinstance(s, str)],
            "objective": objective.splitlines()[0].strip() if objective else "",
            "state": state_bullets,
            "tasks": tasks,
            "private": doc["private"],
        }
        work_items.append(summary)
        for spec_stem in linked_specs:
            work_by_spec.setdefault(spec_stem, []).append({
                "path": doc["path"],
                "stem": doc["stem"],
                "title": doc["title"],
                "status": status,
            })

    work_items.sort(key=lambda w: (w["status"] != "blocked", w["private"], w["title"].lower()))

    # Spec nodes
    nodes: list[dict] = []
    for doc in docs.values():
        if doc["kind"] != "spec" or doc["archived"]:
            continue
        fm = doc["fm"]
        purpose = fm.get("purpose", "")
        progress = fm.get("progress")
        status = fm.get("status")
        area = fm.get("area")
        covers = fm.get("covers") or []
        for field, valid in (
            ("purpose", isinstance(purpose, str)),
            ("progress", progress in PROGRESS_VALUES),
            ("status", status in STATUS_VALUES),
            ("area", area is None or isinstance(area, str)),
            ("covers", isinstance(covers, list) and all(isinstance(v, str) for v in covers)),
        ):
            if not valid:
                diagnostics.append({"code": "field", "path": doc["path"], "message": "Invalid " + field + " value"})
        nodes.append({
            "path": doc["path"],
            "stem": doc["stem"],
            "title": doc["title"],
            "content": purpose if isinstance(purpose, str) else "",
            "area": area if isinstance(area, str) else "",
            "status": status if isinstance(status, str) else "decided",
            "progress": progress if isinstance(progress, str) else None,
            "after": fm.get("after"),
            "covers": covers if isinstance(covers, list) else [],
            "activeWork": work_by_spec.get(doc["stem"], []),
            "private": doc["private"],
        })

    diagnostics.extend(analyze_spec_graph(nodes))

    # Open Decisions / Needs Attention steering queue
    overview_path = _extract_overview_path(dd)
    decisions: list[dict] = []
    overview_doc = docs.get(overview_path)
    if overview_doc:
        _, ov_body = split_frontmatter_raw(overview_doc["source"])
        sec = extract_section(ov_body, DECISION_HEADINGS)
        for text in extract_bullets(sec):
            decisions.append({"kind": "decision", "path": overview_path, "title": text})
    for node in nodes:
        if node["status"] == "proposed":
            decisions.append({
                "kind": "proposed",
                "path": node["path"],
                "title": node["title"],
                "detail": node["content"],
                "private": node["private"],
            })
        if node["progress"] == "blocked":
            decisions.append({
                "kind": "blocked",
                "path": node["path"],
                "title": node["title"],
                "detail": node["content"],
                "private": node["private"],
            })
    for item in work_items:
        if item["status"] == "blocked":
            decisions.append({
                "kind": "blocked",
                "path": item["path"],
                "title": item["title"],
                "detail": item["objective"],
                "private": item["private"],
            })

    # Northstar mission snippet for Project Pulse strip
    mission = ""
    ns_doc = docs.get("docdoki/northstar.md")
    if ns_doc:
        _, ns_body = split_frontmatter_raw(ns_doc["source"])
        sec = extract_section(ns_body, ("mission",))
        mission = next((line.strip() for line in sec.splitlines() if line.strip()), "")

    return {
        "nodes": nodes,
        "work": work_items,
        "decisions": decisions,
        "backlinks": backlinks,
        "documents": docs,
        "catalog": catalog,
        "diagnostics": diagnostics,
        "meta": {
            "title": root.name,
            "root": str(root),
            "overviewPath": overview_path,
            "northstarPath": "docdoki/northstar.md",
            "mission": mission,
            "units": extract_unit_links(dd),
        },
    }


def search_library(dd: Path, query: str, overrides: dict[str, str] | None = None) -> list[dict]:
    """Full-text search across the entire unit (including unopened notes and archives)."""
    q = (query or "").strip().casefold()
    if not q:
        return []
    root = dd.parent
    overrides = overrides or {}
    results: list[dict] = []
    for path in library_paths(dd):
        if is_symlink_within(path, root):
            continue
        entry = catalog_entry(path, root)
        rel = entry["path"]
        try:
            source = overrides[rel] if rel in overrides else read_source(path)
        except (OSError, UnicodeError):
            continue
        folded = source.casefold()
        idx = folded.find(q)
        if idx < 0 and q not in rel.casefold():
            continue
        title = document(path, root, source)["title"]
        snippet = ""
        if idx >= 0:
            start = max(0, idx - 40)
            end = min(len(source), idx + len(q) + 80)
            snippet = source[start:end].replace("\r", "").replace("\n", " ").strip()
            if start > 0:
                snippet = "…" + snippet
            if end < len(source):
                snippet = snippet + "…"
        results.append({
            "path": rel,
            "title": title,
            "kind": entry["kind"],
            "private": entry["private"],
            "archived": entry["archived"],
            "snippet": snippet,
        })
    return results
