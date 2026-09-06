#!/usr/bin/env python3
"""Local DocDoki reader/editor: python panel/panel.py [root] [--no-open].

Python standard library only. Browser assets are bundled locally and assembled
into one page; no runtime package manager, network assets or build step.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import secrets
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from documents import document
from graph import allowed_path, build_graph
from storage import apply_edits, preview

HERE = Path(__file__).resolve().parent
MAX_SAVE_BYTES = 1_048_576


def find_docdoki(start: Path) -> Path | None:
    current = start.resolve()
    return next((p / "docdoki" for p in (current, *current.parents) if (p / "docdoki").is_dir()), None)


def _hjson(data) -> str:
    return json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")


def render(dd: Path, save_token: str = "") -> str:
    graph = build_graph(dd)
    values = {"TITLE": html.escape(graph["meta"]["title"]), "DATA": _hjson(graph),
              "TOKEN": _hjson(save_token), "NONCE": html.escape(save_token, quote=True),
              "CSS": (HERE / "panel.css").read_text(encoding="utf-8"),
              "VENDOR": (HERE / "vendor/marked.js").read_text(encoding="utf-8"),
              "STATE": (HERE / "state.js").read_text(encoding="utf-8"),
              "APP": (HERE / "panel.js").read_text(encoding="utf-8")}
    return re.sub(r"__(TITLE|DATA|TOKEN|NONCE|CSS|VENDOR|STATE|APP)__",
                  lambda match: values[match[1]], (HERE / "panel.html").read_text(encoding="utf-8"))


def request_host_error(headers, expected_host: str):
    return None if headers.get("Host") == expected_host else (403, "invalid request host")


def save_request_error(headers, token: str, expected_origin: str):
    host_error = request_host_error(headers, urlsplit(expected_origin).netloc)
    if host_error:
        return host_error
    if headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
        return 415, "save requires application/json"
    supplied = headers.get("X-DocDoki-Token", "")
    if not supplied or not secrets.compare_digest(supplied, token):
        return 403, "invalid save token"
    if headers.get("Origin") not in (None, expected_origin):
        return 403, "invalid save origin"
    return None


class Handler(BaseHTTPRequestHandler):
    dd = Path(".")
    save_token = ""

    def log_message(self, *_):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'none'; "
                         f"script-src 'nonce-{self.save_token}'; style-src 'unsafe-inline'; "
                         "connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        super().end_headers()

    def respond(self, body, content_type="application/json", status=200):
        data = json.dumps(body, ensure_ascii=False).encode() if content_type == "application/json" else body.encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        error = request_host_error(self.headers, f"127.0.0.1:{self.server.server_address[1]}")
        if error:
            self.send_error(*error)
            return
        route = urlsplit(self.path)
        try:
            if route.path in ("/", "/index.html"):
                self.respond(render(self.dd, self.save_token), "text/html")
            elif route.path in ("/snapshot", "/document"):
                if not secrets.compare_digest(self.headers.get("X-DocDoki-Token", ""), self.save_token):
                    self.send_error(403, "invalid read token")
                    return
                params = parse_qs(route.query)
                if route.path == "/snapshot":
                    extra = params.get("extra", [])
                    for raw in extra:
                        allowed_path(self.dd.parent, raw)
                    self.respond(build_graph(self.dd, extra=extra))
                else:
                    path = allowed_path(self.dd.parent, params.get("path", [""])[0])
                    self.respond(document(path, self.dd.parent))
            else:
                self.send_error(404)
        except (OSError, ValueError, UnicodeError) as exc:
            self.respond({"ok": False, "error": str(exc)}, status=400)

    def do_POST(self):
        if self.path not in ("/save", "/preview"):
            self.send_error(404)
            return
        error = save_request_error(self.headers, self.save_token, f"http://127.0.0.1:{self.server.server_address[1]}")
        if error:
            self.send_error(*error)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_SAVE_BYTES:
                self.send_error(413 if length > MAX_SAVE_BYTES else 400, "invalid request body size")
                return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict) or not isinstance(payload.get("edits"), list):
                raise ValueError("request requires an edits list")
            if self.path == "/save":
                self.respond(apply_edits(self.dd.parent, payload["edits"]))
            else:
                graph = preview(self.dd.parent, payload["edits"], payload.get("after"), payload.get("extra", []), payload.get("base"))
                self.respond({"ok": True, "graph": graph})
        except (OSError, ValueError, TypeError, AttributeError) as exc:
            self.respond({"ok": False, "error": str(exc)}, status=400)


def make_server(dd: Path, port=0, token=None):
    class BoundHandler(Handler):
        pass
    BoundHandler.dd = dd
    BoundHandler.save_token = token or secrets.token_urlsafe(32)
    return ThreadingHTTPServer(("127.0.0.1", port), BoundHandler)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Local DocDoki reader and source editor")
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args(argv)
    dd = find_docdoki(Path(args.root))
    if dd is None:
        parser.error(f"no docdoki/ found at or above {args.root}")
    server = make_server(dd, args.port)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"DocDoki → {url}  (library: {dd})\nPause other writers before saving the same files. Ctrl-C to stop.", flush=True)
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
