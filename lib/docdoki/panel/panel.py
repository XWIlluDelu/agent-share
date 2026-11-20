#!/usr/bin/env python3
"""Local DocDoki steering board and source editor: python3 panel/panel.py [root ...] [--no-open].

Python standard library only. Offline single-page delivery with vendored marked.js;
no runtime package manager, network assets, or build step.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import secrets
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit

HERE = Path(__file__).resolve().parent
SCRIPTS_DIR = HERE.parent / "scripts"
for directory in (HERE, SCRIPTS_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from docdoki_lib import allowed_path, catalog_entry, document, extract_unit_links, library_paths
from graph import build_graph, search_library
from storage import apply_edits, create_document, transform

MAX_REQUEST_BYTES = 1_048_576
APP_ASSETS = ("board.js", "changes.js", "panel.js")


def assets(paths) -> str:
    return "\n".join((HERE / path).read_text(encoding="utf-8") for path in paths)


def find_docdoki(start: Path) -> Path | None:
    current = start.resolve()
    return next((p / "docdoki" for p in (current, *current.parents) if (p / "docdoki").is_dir()), None)


def _unit_counts(dd: Path) -> tuple[int, int]:
    root = dd.parent
    specs = work = 0
    for p in library_paths(dd):
        e = catalog_entry(p, root)
        if e["archived"]:
            continue
        if e["kind"] == "spec":
            specs += 1
        elif e["kind"] == "work":
            work += 1
    return specs, work


def discover_unit_tree(seed_dds: list[Path], *, include_counts: bool = True) -> tuple[dict[str, Path], list[dict]]:
    """Build an allowlisted, ordered unit tree from one or more seed docdoki/ directories.

    Walks up to each seed's top parent unit, then DFS down child links so every unit
    in a hierarchy is always visible and navigable regardless of which unit was opened.
    """
    seeds = [dd.resolve() for dd in seed_dds]
    by_path: dict[Path, str] = {}
    used_ids: set[str] = set()

    def assign_id(dd: Path, is_default: bool = False) -> str:
        if dd in by_path:
            return by_path[dd]
        if is_default and "main" not in used_ids:
            uid = "main"
        else:
            base = re.sub(r"[^a-z0-9_-]+", "-", dd.parent.name.lower()).strip("-") or "unit"
            uid = base
            suffix = 2
            while uid in used_ids:
                uid = f"{base}-{suffix}"
                suffix += 1
        used_ids.add(uid)
        by_path[dd] = uid
        return uid

    # Find top ancestors for each seed
    roots: list[Path] = []
    seen_roots: set[Path] = set()
    for seed in seeds:
        cur = seed
        visited = {cur}
        while True:
            parent_link = next((u for u in extract_unit_links(cur) if u["relation"] == "parent"), None)
            if not parent_link:
                break
            nxt = (Path(parent_link["root"]) / "docdoki").resolve()
            if nxt in visited or not nxt.is_dir():
                break
            visited.add(nxt)
            cur = nxt
        if cur not in seen_roots:
            seen_roots.add(cur)
            roots.append(cur)

    # Reserve "main" for the primary requested seed
    if seeds:
        assign_id(seeds[0], is_default=True)

    # DFS from every top root to build tree order
    ordered_nodes: list[dict] = []
    visited_dfs: set[Path] = set()

    def walk(dd: Path, depth: int, label: str | None, parent_dd: Path | None):
        if dd in visited_dfs or len(ordered_nodes) >= 64:
            return
        visited_dfs.add(dd)
        uid = assign_id(dd)
        specs, work = _unit_counts(dd) if include_counts else (0, 0)
        ordered_nodes.append({
            "id": uid,
            "title": label or dd.parent.name,
            "name": dd.parent.name,
            "root": str(dd.parent),
            "depth": depth,
            "parentId": by_path.get(parent_dd) if parent_dd else None,
            "specs": specs,
            "work": work,
        })
        for link in extract_unit_links(dd):
            if link["relation"] != "child":
                continue
            child_dd = (Path(link["root"]) / "docdoki").resolve()
            if child_dd.is_dir() and child_dd not in visited_dfs:
                walk(child_dd, depth + 1, link["title"], dd)

    for r in roots:
        walk(r, 0, None, None)
    for seed in seeds:
        if seed not in visited_dfs:
            walk(seed, 0, None, None)

    allowed = {uid: path for path, uid in by_path.items()}
    return allowed, ordered_nodes


def attach_unit_meta(graph: dict, unit_id: str, tree: list[dict]) -> dict:
    graph["meta"]["unitId"] = unit_id
    graph["meta"]["unitTree"] = tree
    by_root = {str(Path(u["root"]).resolve()): u["id"] for u in tree}
    for link in graph["meta"].get("units", []):
        uid = by_root.get(str(Path(link["root"]).resolve()))
        if uid:
            link["id"] = uid
    return graph


def _hjson(data) -> str:
    return json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")


def render(dd: Path, save_token: str = "", unit_id: str = "main", unit_tree: list[dict] | None = None) -> str:
    graph = attach_unit_meta(build_graph(dd), unit_id, unit_tree or [])
    values = {
        "TITLE": html.escape(graph["meta"]["title"]),
        "DATA": _hjson(graph),
        "TOKEN": _hjson(save_token),
        "NONCE": html.escape(save_token, quote=True),
        "CSS": assets(("panel.css", "board.css")),
        "ICON": quote((HERE / "favicon.svg").read_text(encoding="utf-8"), safe=""),
        "VENDOR": (HERE / "vendor/marked.js").read_text(encoding="utf-8"),
        "STATE": (HERE / "state.js").read_text(encoding="utf-8"),
        "APP": assets(APP_ASSETS),
    }
    return re.sub(
        r"__(TITLE|DATA|TOKEN|NONCE|CSS|ICON|VENDOR|STATE|APP)__",
        lambda match: values[match[1]],
        (HERE / "panel.html").read_text(encoding="utf-8"),
    )


def request_host_error(headers, expected_host: str):
    return None if headers.get("Host") == expected_host else (403, "invalid request host")


def data_request_error(headers, token: str, expected_origin: str):
    host_error = request_host_error(headers, urlsplit(expected_origin).netloc)
    if host_error:
        return host_error
    if headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
        return 415, "request requires application/json"
    supplied = headers.get("X-DocDoki-Token", "")
    if not supplied or not secrets.compare_digest(supplied, token):
        return 403, "invalid request token"
    if headers.get("Origin") not in (None, expected_origin):
        return 403, "invalid request origin"
    return None


class Handler(BaseHTTPRequestHandler):
    seed_dds: list[Path] = []
    save_token = ""

    def log_message(self, *_):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; "
            f"script-src 'nonce-{self.save_token}'; style-src 'unsafe-inline'; "
            "connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def respond(self, body, content_type="application/json", status=200):
        data = json.dumps(body, ensure_ascii=False).encode() if content_type == "application/json" else body.encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _resolve_unit(self, params: dict[str, list[str]], *, include_counts: bool = True) -> tuple[str, Path, list[dict]]:
        allowed, tree = discover_unit_tree(self.seed_dds, include_counts=include_counts)
        unit_id = params.get("unit", ["main"])[0] or "main"
        if unit_id not in allowed:
            raise ValueError("unknown or disallowed unit: " + unit_id)
        return unit_id, allowed[unit_id], tree

    def do_GET(self):
        error = request_host_error(self.headers, f"127.0.0.1:{self.server.server_address[1]}")
        if error:
            self.send_error(*error)
            return
        route = urlsplit(self.path)
        params = parse_qs(route.query)
        try:
            if route.path in ("/", "/index.html"):
                unit_id, dd, tree = self._resolve_unit(params)
                self.respond(render(dd, self.save_token, unit_id, tree), "text/html")
            elif route.path in ("/snapshot", "/document"):
                if not secrets.compare_digest(self.headers.get("X-DocDoki-Token", ""), self.save_token):
                    self.send_error(403, "invalid read token")
                    return
                if route.path == "/snapshot":
                    unit_id, dd, tree = self._resolve_unit(params)
                    self.respond(attach_unit_meta(build_graph(dd), unit_id, tree))
                else:
                    _, dd, _ = self._resolve_unit(params, include_counts=False)
                    path = allowed_path(dd.parent, params.get("path", [""])[0])
                    self.respond(document(path, dd.parent))
            else:
                self.send_error(404)
        except (OSError, ValueError, UnicodeError) as exc:
            self.respond({"ok": False, "error": str(exc)}, status=400)

    def do_POST(self):
        route = urlsplit(self.path)
        if route.path not in ("/save", "/transform", "/create", "/search"):
            self.send_error(404)
            return
        error = data_request_error(self.headers, self.save_token, f"http://127.0.0.1:{self.server.server_address[1]}")
        if error:
            self.send_error(*error)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_REQUEST_BYTES:
                self.respond(
                    {"ok": False, "error": "Request exceeds the 1 MiB capacity limit; reduce this edit batch."},
                    status=413,
                )
                return
            if length <= 0:
                raise ValueError("Empty request body")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("JSON object required")
            params = parse_qs(route.query)
            needs_tree = route.path in ("/transform", "/create")
            unit_id, dd, tree = self._resolve_unit(params, include_counts=needs_tree)

            if route.path == "/save":
                if not isinstance(payload.get("edits"), list):
                    raise ValueError("save requires an edits list")
                self.respond(apply_edits(dd.parent, payload["edits"]))
            elif route.path == "/transform":
                result = transform(
                    dd.parent,
                    payload.get("overrides"),
                    card=payload.get("card"),
                    after=payload.get("after"),
                )
                attach_unit_meta(result["graph"], unit_id, tree)
                self.respond(result)
            elif route.path == "/create":
                result = create_document(
                    dd.parent,
                    payload.get("kind", ""),
                    payload.get("slug", ""),
                    payload.get("title", ""),
                    private=bool(payload.get("private", False)),
                    area=str(payload.get("area") or ""),
                    purpose=str(payload.get("purpose") or ""),
                    specs=payload.get("specs") if isinstance(payload.get("specs"), list) else None,
                )
                attach_unit_meta(result["graph"], unit_id, tree)
                self.respond(result)
            else:
                overrides = payload.get("overrides") if isinstance(payload.get("overrides"), dict) else None
                self.respond({"ok": True, "results": search_library(dd, str(payload.get("q") or ""), overrides)})
        except (OSError, ValueError) as exc:
            self.respond({"ok": False, "error": str(exc)}, status=400)


def make_server(dd: Path | list[Path], port=0, token=None):
    seed_dds = [d.resolve() for d in (dd if isinstance(dd, list) else [dd])]

    class BoundHandler(Handler):
        pass

    BoundHandler.seed_dds = seed_dds
    BoundHandler.save_token = token or secrets.token_urlsafe(32)
    return ThreadingHTTPServer(("127.0.0.1", port), BoundHandler)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Local DocDoki steering board and source editor")
    parser.add_argument("roots", nargs="*", default=["."], help="one or more project/unit roots containing docdoki/")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args(argv)
    dds: list[Path] = []
    for raw in args.roots or ["."]:
        dd = find_docdoki(Path(raw))
        if dd is None:
            parser.error(f"no docdoki/ found at or above {raw}")
        if dd not in dds:
            dds.append(dd)
    server = make_server(dds, args.port)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    joined = ", ".join(str(d) for d in dds)
    print(f"DocDoki → {url}  (libraries: {joined})\nPause other writers before saving the same files. Ctrl-C to stop.", flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
