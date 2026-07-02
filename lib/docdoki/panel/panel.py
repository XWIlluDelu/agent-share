#!/usr/bin/env python3
"""Local docdoki panel server.

    python panel/panel.py [root] [--port 8765] [--no-open]

`root` is the unit directory that contains `docdoki/` (default: nearest at/above cwd).
Visual language: dell-1996 (see panel/panel-design.md). Standard library only.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# --- frontmatter (the deliberately small YAML subset; see references/schemas.md) ---

def _indent(raw: str) -> int:
    return len(raw) - len(raw.lstrip(" "))


def split_frontmatter_raw(text: str) -> tuple[str | None, str]:
    text = text.replace("\r\n", "\n")
    m = re.match(r"^---\n(.*?)\n---[ \t]*(?:\n(.*))?\Z", text, re.DOTALL)
    return (m.group(1), (m.group(2) or "").lstrip("\n")) if m else (None, text)


def split_frontmatter(text: str) -> tuple[dict, str]:
    raw, body = split_frontmatter_raw(text)
    return (parse_frontmatter(raw), body) if raw is not None else ({}, body)


def parse_frontmatter(block: str) -> dict:
    data: dict = {}
    lines = block.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        if not raw.strip() or raw.lstrip().startswith("#"):
            i += 1
            continue
        if not raw.startswith(" ") and ":" in raw:
            key, _, val = raw.partition(":")
            key, val = key.strip(), val.strip()
            if val == "":
                children, i = _read_indented(lines, i + 1, _indent(raw))
                data[key] = children
                continue
            data[key] = _scalar(val)
        i += 1
    return data


def _read_indented(lines, i, parent_indent):
    items: list = []
    mapping: dict = {}
    child_indent = None
    while i < len(lines):
        raw = lines[i]
        if not raw.strip() or raw.lstrip().startswith("#"):
            i += 1
            continue
        ind = _indent(raw)
        if ind <= parent_indent:
            break
        if child_indent is None:
            child_indent = ind
        elif ind < child_indent:
            break
        s = raw.strip()
        if s.startswith("- "):
            items.append(_scalar(s[2:].strip()))
            i += 1
        elif ":" in s:
            k, _, v = s.partition(":")
            k, v = k.strip(), v.strip()
            if v == "":
                child, i = _read_indented(lines, i + 1, ind)
                mapping[k] = child
            else:
                mapping[k] = _scalar(v)
                i += 1
        else:
            break
    return (mapping if mapping else items), i


def _split_list(inner: str) -> list[str]:
    out, buf, depth = [], [], 0
    for ch in inner:
        if ch == "{":
            depth += 1; buf.append(ch)
        elif ch == "}":
            depth -= 1; buf.append(ch)
        elif ch == "," and depth == 0:
            out.append("".join(buf).strip()); buf = []
        else:
            buf.append(ch)
    if buf:
        out.append("".join(buf).strip())
    return [x for x in out if x]


def _scalar(val: str):
    if val.startswith("[") and val.endswith("]"):
        inner = val[1:-1].strip()
        return _split_list(inner) if inner else []
    return val.strip().strip("'\"")


# --- body helpers ---

def sections(body: str) -> dict:
    secs: dict = {}
    cur = None
    buf: list = []
    for ln in body.splitlines():
        m = re.match(r"^##\s+(.*)$", ln)
        if m:
            if cur is not None:
                secs[cur] = "\n".join(buf).strip()
            cur = m.group(1).strip()
            buf = []
        elif cur is not None:
            buf.append(ln)
    if cur is not None:
        secs[cur] = "\n".join(buf).strip()
    return secs


def h1(body: str) -> str:
    for ln in body.splitlines():
        m = re.match(r"^#\s+(.*)$", ln)
        if m:
            return m.group(1).strip()
    return ""


def bullets(text: str) -> list:
    out = []
    for ln in text.splitlines():
        s = ln.strip()
        if s.startswith(("- ", "* ")):
            out.append(s[2:].strip())
    return out


# --- read the library into a graph the renderer understands ---

def find_docdoki(start: Path) -> Path | None:
    cur = start.resolve()
    for d in [cur, *cur.parents]:
        if (d / "docdoki").is_dir():
            return d / "docdoki"
    return None


def rel(p: Path, root: Path) -> str:
    try:
        return p.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return p.as_posix()


def build_graph(dd: Path) -> dict:
    """Canvas = the spec pipeline (one node type, `after` edges). northstar, the
    abstract, and active stages are not cards — they ride in the documents overlay
    (`docs`), each as an ordered list of editable `## section` blocks."""
    root = dd.parent

    def doc(path: Path, did: str):
        if not path.exists():
            return None
        _, body = split_frontmatter(path.read_text(encoding="utf-8"))
        return {"id": did, "path": rel(path, root), "title": h1(body) or path.stem,
                "sections": [[k, v] for k, v in sections(body).items()]}

    spec_dir = dd / "specs"
    raw = {}
    for p in (sorted(spec_dir.glob("*.md")) if spec_dir.is_dir() else []):
        fm, body = split_frontmatter(p.read_text(encoding="utf-8"))
        raw[p.stem] = {"fm": fm, "secs": sections(body), "path": p, "body": body}

    def depth(name, seen=()):  # column = longest `after` chain (pipeline order)
        af = [a for a in (raw[name]["fm"].get("after") or []) if a in raw and a not in seen]
        return 1 + max([depth(a, seen + (name,)) for a in af], default=-1)

    nodes = []
    for name, r in raw.items():
        fm, secs, p = r["fm"], r["secs"], r["path"]
        progress = fm.get("progress") or "not-started"
        after = fm.get("after") or []
        covers = fm.get("covers") or []
        sid = "S:" + name
        title = h1(r["body"]) or name
        nodes.append({"id": sid, "kind": "spec", "title": title,
                      "content": fm.get("purpose", ""), "status": progress,
                      "path": rel(p, root), "edit": ["content", "title"],
                      "col": 1 + depth(name),
                      "claims": bullets(secs.get("Goal", "")), "after": after, "covers": covers})

    st_dir = dd / "stages"
    stages = []
    for p in (sorted(st_dir.glob("*.md")) if st_dir.is_dir() else []):  # active only; archived live in archive/
        d = doc(p, "G:" + p.stem)
        if d:
            stages.append(d)

    docs = {"northstar": doc(dd / "northstar.md", "northstar"),
            "abstract": doc(dd / "spec_abstract.md", "abstract"),
            "stages": stages}
    meta = {"title": root.name}
    return {"nodes": nodes, "docs": docs, "meta": meta}


# --- write-back: surgical patch of just the edited fragment ---

def _join_fm(fm: str | None, body: str) -> str:
    return body if fm is None else "---\n" + fm + "\n---\n" + body


def _inline(val) -> str:
    return " ".join(str(val).replace("\r\n", "\n").splitlines()).strip()


def replace_fm_key(text: str, key: str, new_lines: list[str]) -> str:
    fm, body = split_frontmatter_raw(text)
    if fm is None:
        return _join_fm("\n".join(new_lines), body)
    lines = fm.split("\n")
    out: list[str] = []
    i = 0
    done = False
    while i < len(lines):
        if re.match(rf"^{re.escape(key)}:", lines[i]):
            out.extend(new_lines)
            done = True
            i += 1
            while i < len(lines) and lines[i].startswith(" "):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    if not done:
        out.extend(new_lines)
    return _join_fm("\n".join(out), body)


def set_fm_scalar(text, key, val):
    return replace_fm_key(text, key, [f"{key}: {_inline(val)}"])


def set_fm_list(text, key, items):
    val = ", ".join(_inline(x) for x in items)
    return replace_fm_key(text, key, [f"{key}: [{val}]"])


def section_bounds(lines: list[str], heading: str) -> tuple[int, int] | None:
    start = None
    for i, ln in enumerate(lines):
        m = re.match(r"^##\s+(.*)$", ln)
        if m and m.group(1).strip() == heading:
            start = i
            break
    if start is None:
        return None
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^#{1,2}\s+\S", lines[j]):
            end = j
            break
    return start, end


def replace_claim(text, index, to):
    fm, body = split_frontmatter_raw(text)
    lines = body.split("\n")
    bounds = section_bounds(lines, "Goal")
    if bounds is None:
        return None
    start, end = bounds
    seen = 0
    for i in range(start + 1, end):
        s = lines[i].strip()
        if s.startswith(("- ", "* ")):
            if seen == index:
                indent = lines[i][:len(lines[i]) - len(lines[i].lstrip())]
                marker = s[:2]
                lines[i] = indent + marker + _inline(to)
                return _join_fm(fm, "\n".join(lines))
            seen += 1
    return None


def replace_section(text, heading, new_body):
    fm, body = split_frontmatter_raw(text)
    lines = body.split("\n")
    bounds = section_bounds(lines, heading)
    if bounds is None:
        return None
    start, end = bounds
    block = ["## " + heading, ""]
    if new_body.strip():
        block += new_body.rstrip("\n").split("\n") + [""]
    return _join_fm(fm, "\n".join(lines[:start] + block + lines[end:]))


def replace_h1(text, new_title):
    fm, body = split_frontmatter_raw(text)
    lines = body.split("\n")
    for i, ln in enumerate(lines):
        m = re.match(r"^(#)\s+(.*)$", ln)
        if m:
            lines[i] = "# " + _inline(new_title)
            return _join_fm(fm, "\n".join(lines))
    lines.insert(0, "# " + _inline(new_title))
    return _join_fm(fm, "\n".join(lines))


def edit_path(root: Path, e: dict) -> tuple[Path | None, str]:
    raw = e.get("path")
    if not raw:
        return None, "bad path: " + str(raw)
    base = root.resolve()
    path = (base / raw).resolve()
    try:
        path.relative_to(base)
        path.relative_to((base / "docdoki").resolve())
    except ValueError:
        return None, f"bad path: {raw}"
    if not path.exists():
        return None, f"missing path: {raw}"
    return path, "ok"


def patch_text(text: str, e: dict) -> tuple[bool, str, str]:
    field, to = e.get("field"), e.get("to", "")
    if field == "progress":
        return True, "ok", set_fm_scalar(text, "progress", to)
    if field == "content":  # a spec card's body == its purpose line
        return True, "ok", set_fm_scalar(text, "purpose", to)
    if field == "title":
        return True, "ok", replace_h1(text, to)
    if field in ("after", "covers"):
        return True, "ok", set_fm_list(text, field, _split_list(to))
    if field == "claim":
        try:
            index = int(e.get("i"))
        except (TypeError, ValueError):
            return False, "bad claim index", text
        out = replace_claim(text, index, to)
        return (True, "ok", out) if out is not None else (False, "claim not found", text)
    if field == "section":  # overlay edit of a `## section` body block
        out = replace_section(text, e.get("section", ""), to)
        return (True, "ok", out) if out is not None else (False, "section not found", text)
    return False, f"unknown field: {field}", text


def apply_edits(root: Path, edits: list[dict]) -> list[tuple[bool, str]]:
    pending: dict[Path, str] = {}
    results: list[tuple[bool, str]] = []
    for e in edits:
        path, msg = edit_path(root, e)
        if path is None:
            results.append((False, msg))
            break
        text = pending.get(path)
        if text is None:
            text = path.read_text(encoding="utf-8")
        ok, msg, text = patch_text(text, e)
        results.append((ok, msg))
        if not ok:
            break
        pending[path] = text
    if len(results) < len(edits):
        results.extend([(False, "not written: batch failed")] * (len(edits) - len(results)))
    if not all(ok for ok, _ in results):
        return [(False, msg if not ok else "not written: batch failed") for ok, msg in results]
    for path, text in pending.items():
        path.write_text(text, encoding="utf-8")
    return results


def apply_edit(root: Path, e: dict) -> tuple[bool, str]:
    return apply_edits(root, [e])[0]


# --- render ---

def _hjson(data) -> str:
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def render(dd: Path) -> str:
    graph = build_graph(dd)
    return (TEMPLATE
            .replace("__TITLE__", html.escape(graph["meta"]["title"] or "workspace"))
            .replace("__GRAPH_JSON__", _hjson(graph)))


# --- server ---

class Handler(BaseHTTPRequestHandler):
    dd: Path = Path(".")

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.split("?")[0] not in ("/", "/index.html"):
            self.send_error(404)
            return
        page = render(self.dd).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        self.wfile.write(page)

    def do_POST(self):
        if self.path != "/save":
            self.send_error(404)
            return
        n = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(n) or b"{}")
            results = apply_edits(self.dd.parent, payload.get("edits", []))
        except Exception as ex:  # surface failure to the panel rather than 500-crash
            results = [(False, str(ex))]
        ok = all(r[0] for r in results)
        body = json.dumps({"ok": ok, "results": [{"ok": a, "msg": b} for a, b in results]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main(argv=None):
    ap = argparse.ArgumentParser(description="docdoki panel")
    ap.add_argument("root", nargs="?", default=".")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true")
    a = ap.parse_args(argv)
    dd = find_docdoki(Path(a.root))
    if dd is None:
        ap.error(f"no docdoki/ found at or above {a.root}")
    Handler.dd = dd
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    url = f"http://127.0.0.1:{a.port}/"
    print(f"docdoki panel → {url}  (library: {dd})\nCtrl-C to stop.")
    if not a.no_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__ · DocDoki</title>
<style>
  /* dell-1996 — black page frame, ribbon cards (white title bar over a status-tinted
     body), Arial Black over Times Roman, hard 2px borders, 0 radius, sticker chrome.
     See panel/panel-design.md. */
  :root{
    --red:#e91d2a; --yellow:#fcc20f; --link:#0000ee;
    --t-done:#c0d4a7; --t-inprog:#8c9ae0; --t-notstarted:#a5b8c0;   /* spec tints: lime / periwinkle / steel — palette closed by design */
    --fs-disp:"Arial Black","Helvetica Neue",Helvetica,Arial,"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;
    --fs-ui:Helvetica,"Helvetica Neue",Arial,"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;
    --fs-body:"Times New Roman",Times,Georgia,"Noto Serif CJK SC","Source Han Serif SC","Songti SC",STSong,SimSun,serif;
    --fs-mono:"Courier New",Courier,ui-monospace,monospace;
  }
  *{box-sizing:border-box;}
  html,body{height:100%;}
  body{margin:0;background:#000;color:#000;font-family:var(--fs-body);font-size:14px;line-height:1.4;}
  button{font:inherit;border:0;background:none;color:inherit;cursor:pointer;}
  .num{font-variant-numeric:tabular-nums;}
  :focus-visible{outline:2px solid var(--link);outline-offset:2px;}
  .app{display:grid;grid-template-columns:400px 1fr 348px;grid-template-rows:50px 1fr;height:100vh;
    border:8px solid #000;background:#fff;}
  .top{grid-column:1/4;display:flex;align-items:center;gap:14px;padding:0 14px;background:#000;color:#fff;}
  .brand{font-family:var(--fs-disp);font-weight:900;font-size:18px;text-transform:uppercase;white-space:nowrap;}
  .brand .heart{color:var(--red);font-size:1em;vertical-align:middle;margin:0 3px;line-height:1;}
  .search{display:flex;align-items:center;border:1px solid #fff;background:#fff;height:26px;}
  .search input{border:0;outline:0;font-family:var(--fs-ui);font-size:12px;padding:0 8px;width:150px;background:#fff;color:#000;}
  .search .sx{font-family:var(--fs-disp);font-weight:900;font-size:14px;padding:0 8px;color:#000;border-left:1px solid #000;cursor:pointer;}
  .grow{flex:1;}
  .langbtn{font-family:var(--fs-ui);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#000;background:var(--yellow);border:1px solid #fff;padding:5px 10px;cursor:pointer;min-width:39px;text-align:center;}
  .langbtn:hover{background:#fff;}
  .rail{background:#fff;}
  .stage{position:relative;overflow:hidden;cursor:grab;user-select:none;background:
    linear-gradient(#f1f1f1 1px,transparent 1px) 0 0/100% 34px,
    linear-gradient(90deg,#f1f1f1 1px,transparent 1px) 0 0/34px 100%, #fff;}
  .stage [contenteditable]{user-select:text;}
  .stage.grabbing{cursor:grabbing;}
  .vp{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform;}
  svg.links{position:absolute;top:0;left:0;overflow:visible;pointer-events:none;}
  .link{fill:none;stroke:#000;stroke-width:1.2;pointer-events:stroke;cursor:pointer;}
  .link.dim{stroke:#cfcfcf;} .link.lit{stroke:var(--red);stroke-width:2.4;}
  .link-hit{fill:none;stroke:transparent;stroke-width:14;pointer-events:stroke;cursor:pointer;}
  .stage.connect .node .card{cursor:pointer;}
  .stage.connect .node .card:hover{box-shadow:3px 3px 0 var(--yellow);}
  .stage.connect [contenteditable]{pointer-events:none;}
  .node.conn-pick .card{box-shadow:5px 5px 0 var(--yellow);outline:2px solid var(--yellow);outline-offset:-1px;}
  .node{position:absolute;width:256px;}
  .card{position:relative;background:#fff;border:2px solid #000;}
  .node:hover .card{box-shadow:3px 3px 0 rgba(0,0,0,.30);}
  .node.sel .card{box-shadow:5px 5px 0 #000;}
  .node.dirty .card{box-shadow:5px 5px 0 var(--red);}
  .node.dim{opacity:.4;} .node.nomatch{opacity:.18;} .node.hit .card{outline:3px solid var(--yellow);outline-offset:-1px;}
  .bar{padding:8px 11px 9px;background:#fff;border-bottom:2px solid #000;}
  .pill{font-family:var(--fs-ui);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;
    padding:1px 6px;border:1.5px solid #000;background:#fff;color:#000;cursor:pointer;white-space:nowrap;display:flex;align-items:center;}
  .pill.editable::after{content:"";}
  .ttl{font-family:var(--fs-ui);font-weight:700;font-size:14px;line-height:1.2;color:#000;word-break:break-word;display:inline-block;max-width:100%;cursor:text;}
  .ttl[contenteditable]:focus{outline:2px solid var(--link);outline-offset:1px;background:#fff;}
  .body{padding:9px 11px 11px;font-family:var(--fs-body);font-size:14px;line-height:1.4;color:#000;outline:none;}
  .body.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .body:empty::before{content:attr(data-ph);color:#6b6256;font-style:italic;}
  .body[contenteditable]:hover{box-shadow:inset 0 0 0 1px rgba(0,0,0,.22);}
  [contenteditable]:focus{outline:2px solid var(--link);outline-offset:1px;background:rgba(255,255,255,.7);}
  .more{display:none;border-top:2px solid #000;padding:9px 11px;background:#fafafa;}
  .node.open .more{display:block;} .node.open .body.clamp{-webkit-line-clamp:unset;}
  .more h5{margin:0 0 4px;font-family:var(--fs-ui);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;}
  .claim{font-family:var(--fs-body);font-size:13px;line-height:1.5;padding:2px 0 2px 12px;position:relative;outline:none;}
  .claim::before{content:"–";position:absolute;left:0;color:#777;}
  .claim[contenteditable]:hover{box-shadow:inset 0 0 0 1px rgba(0,0,0,.2);}
  .kv{display:grid;grid-template-columns:64px 1fr;gap:6px;font-family:var(--fs-body);font-size:12px;padding:3px 0;color:#000;}
  .kv b{font-family:var(--fs-ui);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;}
  .kv .ev{outline:none;}
  .kv .ev[contenteditable]:hover{box-shadow:inset 0 0 0 1px rgba(0,0,0,.2);}
  .kv .mono{font-family:var(--fs-mono);font-size:11px;}
  .foot{display:flex;align-items:stretch;border-top:2px solid #000;}
  .foot button{flex:0 0 auto;font-family:var(--fs-ui);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#000;padding:6px 12px;border:0;border-right:2px solid #000;min-width:62px;text-align:center;}
  .foot button:hover{background:var(--yellow);}
  .foot .pill{flex:0 0 auto;justify-content:center;align-items:center;margin:0 0 0 auto;padding:6px 12px;min-width:62px;text-align:center;border:0;border-left:2px solid #000;border-right:0;display:flex;}
  .foot .pill:hover{filter:brightness(.95);}
  .pill.c-done{background:var(--t-done);} .pill.c-in-progress{background:var(--t-inprog);}
  .pill.c-not-started{background:var(--t-notstarted);}
  .node.c-done .body,.node.c-done .more{background:var(--t-done);}
  .node.c-in-progress .body,.node.c-in-progress .more{background:var(--t-inprog);}
  .node.c-not-started .body,.node.c-not-started .more{background:var(--t-notstarted);}
  .toolbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;
    background:#fff;border:2px solid #000;box-shadow:3px 3px 0 #000;z-index:8;}
  .toolbar button{width:36px;height:30px;font-family:var(--fs-disp);font-weight:900;font-size:15px;border-right:1px solid #000;}
  .toolbar button:hover{background:var(--yellow);} .toolbar button:last-child{border-right:0;}
  .toolbar .z{width:auto;min-width:48px;text-align:center;font-family:var(--fs-ui);font-size:12px;font-weight:700;border-right:1px solid #000;line-height:30px;}
  .toolbar .z.locked{background:#000;color:#fff;}
  .toolbar .z.locked:hover{background:#222;}
  .toolbar button:disabled{opacity:.4;cursor:not-allowed;}
  .toolbar button:disabled:hover{background:#fff;}
  .toolbar button.active{background:#000;color:#fff;}
  .minimap{position:absolute;right:14px;top:14px;width:184px;height:120px;background:#fff;border:2px solid #000;box-shadow:3px 3px 0 #000;overflow:hidden;z-index:8;cursor:pointer;}
  .mm-inner{position:absolute;inset:0;}
  .mm-node{position:absolute;border:1px solid #000;}
  .mm-view{position:absolute;border:2px solid var(--red);pointer-events:none;}
  .menu{position:fixed;z-index:50;background:#fff;border:2px solid #000;box-shadow:3px 3px 0 #000;min-width:122px;}
  .menu button{display:block;width:100%;text-align:left;font-family:var(--fs-ui);font-size:12px;font-weight:700;
    text-transform:uppercase;letter-spacing:.02em;padding:6px 11px;border-bottom:1px solid #000;}
  .menu button:last-child{border-bottom:0;} .menu button:hover{background:var(--yellow);} .menu button.cur{background:#000;color:#fff;}
  .toasts{position:fixed;left:50%;bottom:62px;transform:translateX(-50%);z-index:60;display:flex;flex-direction:column;gap:8px;align-items:center;}
  .toast{background:#000;color:#fff;border:2px solid #000;box-shadow:3px 3px 0 var(--yellow);font-family:var(--fs-ui);
    font-size:12px;font-weight:700;padding:8px 12px;transition:opacity .25s;}
  .rail.right{border-left:2px solid #000;display:flex;flex-direction:column;padding:0;overflow:hidden;position:relative;}
  .disp-h{padding:13px 14px;border-bottom:2px solid #000;background:#000;color:#fff;}
  .disp-h .t{font-family:var(--fs-disp);font-weight:900;font-size:15px;text-transform:uppercase;}
  .badge{font-family:var(--fs-ui);font-size:11px;font-weight:700;color:#000;background:var(--yellow);border:1.5px solid #fff;padding:0 7px;margin-left:9px;}
  .badge.zero{background:#333;color:#999;border-color:#555;}
  .changes{flex:1;overflow:auto;padding:12px 13px;display:flex;flex-direction:column;gap:9px;}
  .ov-body,.changes{scrollbar-width:none;overflow-x:hidden;}
  .ov-body::-webkit-scrollbar,.changes::-webkit-scrollbar{display:none;}
  .rail-thumb{position:fixed;width:6px;background:#9a9a9a;cursor:grab;z-index:30;display:none;}
  .rail-thumb:hover{background:#555;}
  .chg{border:2px solid #000;background:#fff;}
  .chg .h{display:flex;gap:7px;align-items:center;padding:6px 9px;border-bottom:1px solid #000;background:#f4f4f4;}
  .chg .ctag{font-family:var(--fs-ui);font-size:9.5px;font-weight:700;text-transform:uppercase;padding:1px 6px;border:1.5px solid #000;background:var(--t-inprog);}
  .chg .who{font-family:var(--fs-disp);font-weight:900;font-size:12px;}
  .chg .undo{margin-left:auto;font-family:var(--fs-ui);font-size:10px;font-weight:700;text-transform:uppercase;border:1px solid #000;padding:1px 6px;}
  .chg .undo:hover{background:var(--red);color:#fff;}
  .chg .sub{font-family:var(--fs-mono);font-size:10px;color:#666;}
  .chg .desc{padding:7px 9px;font-family:var(--fs-body);font-size:13px;line-height:1.45;}
  .chg .desc .from{color:#999;text-decoration:line-through;}
  .chg .desc .arr{color:#999;margin:0 5px;font-family:var(--fs-ui);}
  .chg .desc .to{font-weight:700;}
  .chg .desc .ph{font-style:italic;color:#b0a89a;text-decoration:none;}
  .chg .diff{font-family:var(--fs-mono);font-size:11px;line-height:1.5;}
  .chg .diff .dl{display:flex;gap:6px;white-space:pre-wrap;word-break:break-word;}
  .chg .diff .dm{flex:0 0 9px;text-align:center;color:#bbb;}
  .chg .diff .dt{flex:1;}
  .chg .diff .eq{color:#9a9a9a;}
  .chg .diff .del .dm{color:var(--red);}
  .chg .diff .del .dt{color:#9a9a9a;text-decoration:line-through;}
  .chg .diff .add .dt{font-weight:700;color:#000;}
  .chg .diff .dfold{color:#bbb;padding-left:15px;}
  .chg .diff .mod .dm{color:#999;}
  .chg .diff .mod .dt{color:#666;}
  .chg .diff .w-del{color:var(--red);text-decoration:line-through;}
  .chg .diff .w-add{color:#000;font-weight:700;}
  .disp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:#555;padding:26px;}
  .disp-empty .mk{width:46px;height:46px;border:2px solid #000;display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-family:var(--fs-disp);font-weight:900;font-size:22px;background:var(--yellow);transform:rotate(-6deg);box-shadow:2px 2px 0 #000;}
  .disp-empty p{margin:0;font-family:var(--fs-body);font-size:13px;line-height:1.55;max-width:230px;}
  .disp-foot{border-top:2px solid #000;padding:12px 13px;}
  .out{width:100%;min-height:108px;max-height:220px;border:2px solid #000;padding:10px;font-family:var(--fs-mono);font-size:11px;line-height:1.55;color:#000;resize:vertical;white-space:pre-wrap;display:none;margin-bottom:10px;outline:none;}
  .btns{display:flex;gap:9px;}
  .btn-primary{flex:1;background:#000;color:#fff;border:2px solid #000;padding:9px;font-family:var(--fs-ui);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;}
  .btn-primary:hover:not(:disabled){background:var(--red);} .btn-primary:disabled{background:#fff;color:#aaa;border-color:#aaa;cursor:not-allowed;}
  .btn-ghost{background:#fff;color:#000;border:2px solid #000;padding:9px 12px;font-family:var(--fs-ui);font-weight:700;font-size:12px;text-transform:uppercase;min-width:71px;text-align:center;}
  .btn-ghost:hover{background:var(--yellow);}
  .empty{padding:48px;color:#666;text-align:center;font-style:italic;}
  /* documents left rail — northstar / abstract / active stages, view + edit */
  .rail.left{border-right:2px solid #000;display:flex;flex-direction:column;padding:0;overflow:hidden;position:relative;}
  .ov-tabs{display:flex;border-bottom:2px solid #000;background:#f4f4f4;}
  .ov-tab{flex:1;text-align:center;font-family:var(--fs-ui);font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;padding:9px 8px;border-right:2px solid #000;color:#000;}
  .ov-tab:last-child{border-right:0;}
  .ov-tab:hover{background:var(--yellow);} .ov-tab.on{background:#000;color:#fff;}
  .ov-body{flex:1;overflow:auto;padding:14px 14px;}
  .ov-doc{margin-bottom:22px;} .ov-doc:last-child{margin-bottom:0;}
  .ov-h1{font-family:var(--fs-disp);font-weight:900;font-size:18px;line-height:1.1;display:flex;align-items:center;gap:9px;margin:0 0 10px;}
  .ov-sec{border:2px solid #000;margin-bottom:11px;}
  .ov-sec.dirty{box-shadow:4px 4px 0 var(--red);}
  .ov-sec h4{margin:0;font-family:var(--fs-ui);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#000;padding:6px 10px;background:#f4f4f4;border-bottom:2px solid #000;}
  .docsec{font-family:var(--fs-body);font-size:14px;line-height:1.4;color:#000;padding:10px;white-space:pre-wrap;outline:none;min-height:34px;}
  .docsec:hover{box-shadow:inset 0 0 0 1px rgba(0,0,0,.22);}
  .docsec:empty::before{content:attr(data-ph);color:#6b6256;font-style:italic;}
  .ov-empty{padding:40px;text-align:center;color:#666;font-style:italic;font-family:var(--fs-body);}
</style>
</head>
<body>
<div class="app">
  <div class="top">
    <div class="brand">Doc<span class="heart">♥</span>Doki</div>
    <div class="grow"></div>
    <div class="search"><input id="q" spellcheck="false"><span class="sx" id="qx">×</span></div>
    <div class="grow"></div>
    <button class="langbtn" id="langbtn">中</button>
  </div>
  <div class="rail left">
    <div class="ov-tabs" id="ov-tabs"></div>
    <div class="ov-body" id="ov-body"></div>
    <div class="rail-thumb" id="lthumb"></div>
  </div>
  <div class="stage" id="stage">
    <div class="vp" id="vp"></div>
    <div class="toolbar">
      <button id="zout" title="Zoom out (−)">−</button><button class="z num" id="zl" title="">100%</button><button id="zin" title="Zoom in (+)">+</button>
      <button id="fit" title="Fit (0)">▣</button><button id="reset" title="Reset dragged layout (r)">⟲</button><button id="conn" title="Connect mode (c)">⇄</button>
    </div>
    <div class="minimap" id="minimap"><div class="mm-inner" id="mm"></div><div class="mm-view" id="mmview"></div></div>
  </div>
  <div class="rail right">
    <div class="disp-h"><span class="t" id="lbl-changes">Changes</span><span class="badge zero" id="badge">0</span></div>
    <div class="changes" id="changes"></div>
    <div class="rail-thumb" id="rthumb"></div>
    <div class="disp-foot">
      <textarea class="out" id="out" readonly spellcheck="false"></textarea>
      <div class="btns">
        <button class="btn-primary" id="save" disabled></button>
        <button class="btn-ghost" id="gen" disabled></button>
        <button class="btn-ghost" id="clear" style="display:none"></button>
      </div>
    </div>
  </div>
</div>
<div class="toasts" id="toasts"></div>
<div class="menu" id="menu" style="display:none"></div>
<script>
const GRAPH = __GRAPH_JSON__;
let lang=(localStorage.getItem("ddpanel-lang")||"en");
const I18N={
 en:{searchPh:"Search… ( / )",clear:"Clear (Esc)",changes:"Changes",writeBack:"Write back",copyPrompt:"Copy",clearBtn:"Clear",emptyChanges:"No changes yet.",emptyCanvas:"No specs to show yet.",expand:"Expand",collapse:"Collapse",noClaims:"no claims",goalClaims:"Goal / claims",emptyBody:"(empty)",saved:"Written back — now let the agent follow",copied:"Prompt copied",saveFail:"Write-back failed: ",undo:"undo",mmTip:"Click/drag to navigate",connMode:"Connect mode — click two cards to toggle",connOff:"Connect (c)",connected:"Connected",disconnected:"Disconnected",zoomLock:"Lock zoom",zoomLocked:"Zoom locked — click to release",langBtn:"中",docNorthstar:"Northstar",docAbstract:"Abstract",docStage:"Active stages",docMissing:"This document does not exist yet.",noStages:"No active stages.",promptIntro:"These edits come from the docdoki panel; treat them as one human document edit and follow them: apply each to its file, then propagate into the other documents and the code, judging order and method yourself.",fields:{content:"content",claim:"claim",title:"title",after:"after",covers:"covers",progress:"progress",section:"section"}},
 zh:{searchPh:"搜索… ( / )",clear:"清除 (Esc)",changes:"改动",writeBack:"写回文件",copyPrompt:"复制",clearBtn:"清空",emptyChanges:"还没有改动。",emptyCanvas:"该库还没有可呈现的规格。",expand:"展开",collapse:"收起",noClaims:"无断言",goalClaims:"目标 / 断言",emptyBody:"（空）",saved:"已写回文件 — 现在执行 follow",copied:"提示已复制",saveFail:"写回失败：",undo:"撤销",mmTip:"点击/拖动定位",connMode:"连接模式 — 点两张卡切换连接",connOff:"连接 (c)",connected:"已连接",disconnected:"已断开",zoomLock:"锁定缩放",zoomLocked:"缩放已锁定 — 点击解锁",langBtn:"EN",docNorthstar:"北极星",docAbstract:"设计图",docStage:"进行中阶段",docMissing:"该文档尚不存在。",noStages:"没有进行中的阶段。",promptIntro:"这些改动来自 docdoki 面板的一次编辑，请作为一次人类文档编辑来 follow：把每一项落到对应文件，再传播到其他文档与代码，顺序与做法你自行判断。",fields:{content:"内容",claim:"断言",title:"标题",after:"after",covers:"covers",progress:"进度",section:"小节"}}
};
const STATUS={en:{"not-started":"not started","in-progress":"in progress",done:"done"},zh:{"not-started":"未开始","in-progress":"进行中",done:"已完成"}};
const STATUS_OPTS={spec:["not-started","in-progress","done"]};
const t=k=>I18N[lang][k];
const statusLabel=s=>STATUS[lang][s]||s;
const fieldLabel=f=>(I18N[lang].fields[f]||f);
let scale=1,panX=0,panY=0,selId=null,curL=null,query="",zoomLocked=false,connMode=false,connPick=null;
const dragOff={};   // id -> {x,y} runtime displacement added atop auto layout
const titleEditing=new Set();   // spec ids whose title is in edit mode
let syncLThumb=()=>{},syncRThumb=()=>{};
const byId={},edgeById={},ORIG={},open=new Set(),measured={};
const CH=new Map();   // key id|field[|sub] -> {id,path,field,from,to,who,i?,section?}
GRAPH.nodes.forEach(n=>{byId[n.id]=n;ORIG[n.id]={title:n.title,content:n.content,status:n.status,claims:(n.claims||[]).slice(),after:(n.after||[]).join(", "),covers:(n.covers||[]).join(", ")};});
function regDoc(d){if(!d)return;byId[d.id]={path:d.path,title:d.title,kind:"doc"};ORIG[d.id]={sections:{}};d.sections.forEach(([n,tx])=>{ORIG[d.id].sections[n]=tx;});}
regDoc(GRAPH.docs.northstar);regDoc(GRAPH.docs.abstract);(GRAPH.docs.stages||[]).forEach(regDoc);

const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const matchNode=n=>{if(!query)return true;const q=query.toLowerCase();
  return (n.title||"").toLowerCase().includes(q)||(n.content||"").toLowerCase().includes(q)||statusLabel(n.status).toLowerCase().includes(q);};
const trim=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n-1)+"…":s;};

/* ── layout: columns come from the server (pipeline depth via `after`) ── */
function cardHeight(id){if(measured[id])return measured[id];return open.has(id)?248:104;}
function measure(){document.querySelectorAll('#vp .node').forEach(el=>{measured[el.dataset.node]=el.offsetHeight;});}
function rectUnion(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),r=Math.max(a.x+a.w,b.x+b.w),d=Math.max(a.y+a.h,b.y+b.h);return{x,y,w:r-x,h:d-y};}
function rectPad(r,p){return{x:r.x-p,y:r.y-p,w:r.w+p*2,h:r.h+p*2};}
function boundsOf(ids,pos){let b=null;ids.forEach(id=>{const p=pos[id];if(!p)return;const r={x:p.x,y:p.y,w:p.w,h:p.h};b=b?rectUnion(b,r):r;});return b||{x:0,y:0,w:1,h:1};}
/* live edges: derived from each spec's current `after` (ORIG + pending CH), so connect/disconnect reflects immediately. */
const stemToId={};GRAPH.nodes.forEach(n=>{stemToId[stemOf(n.id)]=n.id;});
function curAfter(id){const v=eff(id,"after");return (v!=null?v:(ORIG[id].after||"")).split(",").map(s=>s.trim()).filter(Boolean);}
function liveEdges(){const out=[];GRAPH.nodes.forEach(n=>{curAfter(n.id).forEach(stem=>{const from=stemToId[stem];if(from){const e={id:`E:af:${stem}:${stemOf(n.id)}`,from,to:n.id,type:"after"};edgeById[e.id]=e;out.push(e);}});});return out;}
function layout(){
  const ns=GRAPH.nodes;const ids=new Set(ns.map(n=>n.id));
  const es=liveEdges().filter(e=>ids.has(e.from)&&ids.has(e.to));
  const cols={};ns.forEach(n=>{(cols[n.col]=cols[n.col]||[]).push(n.id);});
  const W=256,xG=150,topPad=46,leftPad=48;
  const keys=Object.keys(cols).map(Number).sort((a,b)=>a-b);
  const colH={};keys.forEach(k=>{colH[k]=cols[k].reduce((s,id)=>s+cardHeight(id)+30,-30);});
  const maxH=Math.max(1,...Object.values(colH));const pos={};
  keys.forEach((k,ci)=>{const arr=cols[k].slice().sort((a,b)=>a.localeCompare(b));
    let y=topPad+(maxH-colH[k])/2;
    arr.forEach(id=>{const h=cardHeight(id);pos[id]={x:leftPad+ci*(W+xG),y,w:W,h};y+=h+30;});});
  for(const id in dragOff){if(pos[id]){pos[id].x+=dragOff[id].x;pos[id].y+=dragOff[id].y;}}
  const content=boundsOf(ns.map(n=>n.id),pos);
  const width=Math.max(900,...Object.values(pos).map(p=>p.x+p.w+120));
  const height=Math.max(560,...Object.values(pos).map(p=>p.y+p.h+120));
  return {ids:ns.map(n=>n.id),edges:es.map(e=>e.id),pos,width,height,content};
}
/* Deterministic edge routing: sides come from card-center direction, same-row edges
   keep the center slot, and siblings fan out in far-endpoint order. This is not an
   obstacle router; it stays simple so edges remain smooth and predictable. */
const PORT_GAP=10;
const SIDE={left:{x:-1,y:0},right:{x:1,y:0},top:{x:0,y:-1},bottom:{x:0,y:1}};
function centerOf(p){return{x:p.x+p.w/2,y:p.y+p.h/2};}
function sidesFor(a,b){const ac=centerOf(a),bc=centerOf(b),dx=bc.x-ac.x,dy=bc.y-ac.y;
  if(Math.abs(dx)>=Math.abs(dy)*0.85)return dx>=0?["right","left"]:["left","right"];
  return dy>=0?["bottom","top"]:["top","bottom"];}
function portAt(p,side,off){const c=centerOf(p);
  if(side==="left")return{x:p.x-PORT_GAP,y:c.y+off};
  if(side==="right")return{x:p.x+p.w+PORT_GAP,y:c.y+off};
  if(side==="top")return{x:c.x+off,y:p.y-PORT_GAP};
  return{x:c.x+off,y:p.y+p.h+PORT_GAP};}
function routeEdges(L){
  const E=L.edges.map(eid=>{const e=edgeById[eid],a=L.pos[e.from],b=L.pos[e.to];
    if(!a||!b)return null;const sd=sidesFor(a,b);return{eid,from:e.from,to:e.to,a,b,ss:sd[0],ts:sd[1],os:0,ot:0};}).filter(Boolean);
  const groups={};
  E.forEach(x=>{(groups[x.from+"|"+x.ss]=groups[x.from+"|"+x.ss]||[]).push([x,"s"]);
    (groups[x.to+"|"+x.ts]=groups[x.to+"|"+x.ts]||[]).push([x,"t"]);});
  const cross=it=>{const x=it[0],far=it[1]==="s"?x.b:x.a,side=it[1]==="s"?x.ss:x.ts,c=centerOf(far);
    return (side==="left"||side==="right")?c.y:c.x;};
  for(const k in groups){const list=groups[k];
    list.sort((u,v)=>cross(u)-cross(v)||u[0].eid.localeCompare(v[0].eid));
    const host=list[0][1]==="s"?list[0][0].a:list[0][0].b,side=list[0][1]==="s"?list[0][0].ss:list[0][0].ts;
    const hc=centerOf(host),axis=(side==="left"||side==="right")?"y":"x",span=(side==="left"||side==="right")?host.h:host.w;
    const mid=list.findIndex(it=>Math.abs(cross(it)-hc[axis])<=6),maxSlot=span*0.275;
    const dist=mid>=0?Math.max(mid,list.length-1-mid,1):Math.max((list.length-1)/2,1);
    const step=list.length<2?0:Math.min(18,maxSlot/dist);
    list.forEach((it,idx)=>{let off;
      if(list.length<2)off=0;else if(mid>=0)off=(idx-mid)*step;else off=(idx-(list.length-1)/2)*step;
      if(it[1]==="s")it[0].os=off;else it[0].ot=off;});}
  return E;}
function edgePath(x){const s=portAt(x.a,x.ss,x.os),t=portAt(x.b,x.ts,x.ot),sv=SIDE[x.ss],tv=SIDE[x.ts];
  const len=Math.max(28,Math.min(150,Math.hypot(t.x-s.x,t.y-s.y)*0.42));
  const c1={x:s.x+sv.x*len,y:s.y+sv.y*len},c2={x:t.x+tv.x*len,y:t.y+tv.y*len};
  return `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${t.x} ${t.y}`;}

let relatedSel=new Set();
function chKey(id,field,sub){return sub==null?id+"|"+field:id+"|"+field+"|"+sub;}
function eff(id,f,sub){const k=chKey(id,f,sub);return CH.has(k)?CH.get(k).to:null;}
function cardHTML(id){
  const n=byId[id],o=ORIG[id];const editC=(n.edit||[]).includes("content"),editT=(n.edit||[]).includes("title");
  const status=eff(id,"progress")??o.status,content=eff(id,"content")??o.content,title=eff(id,"title")??o.title;
  const afterS=eff(id,"after")??o.after,coversS=eff(id,"covers")??o.covers;
  const dirty=[...CH.keys()].some(k=>k.startsWith(id+"|"));
  const dim=selId&&selId!==id&&!relatedSel.has(id);
  const hit=query&&matchNode(n),nomatch=query&&!hit;
  const pillEditable=!!STATUS_OPTS[n.kind];
  const body=`<div class="body clamp" data-ph="${esc(t('emptyBody'))}" ${editC?`contenteditable data-id="${id}" data-f="content"`:""}>${esc(content)}</div>`;
  const claims=(o.claims||[]).map((c,ci)=>`<div class="claim" contenteditable data-id="${id}" data-f="claim" data-i="${ci}">${esc(eff(id,"claim",ci)??c)}</div>`).join("")||'<div style="color:#888;font-style:italic">'+t("noClaims")+'</div>';
  const more=`<h5>${esc(t("goalClaims"))}</h5>${claims}
      <div class="kv"><b>after</b><span class="ev mono" contenteditable data-id="${id}" data-f="after">${esc(afterS)}</span></div>
      <div class="kv"><b>covers</b><span class="ev mono" contenteditable data-id="${id}" data-f="covers">${esc(coversS)}</span></div>`;
  return `<div class="node ${n.kind} c-${esc(status)} ${dirty?"dirty":""} ${selId===id?"sel":""} ${connPick===id?"conn-pick":""} ${open.has(id)?"open":""} ${dim?"dim":""} ${nomatch?"nomatch":""} ${hit?"hit":""}" data-node="${id}">
    <div class="card">
      <div class="bar">
        <div class="ttl" data-id="${id}" data-f="title" title="${esc(n.title)}" ${editT&&titleEditing.has(id)?`contenteditable`:""}>${esc(title)}</div></div>
      ${body}
      <div class="more">${more}</div>
      <div class="foot"><button data-toggle="${id}">${open.has(id)?t("collapse"):t("expand")}</button><span class="pill c-${esc(status)} ${pillEditable?"editable":""}" ${pillEditable?`data-status="${id}"`:""}>${esc(statusLabel(status))}</span></div>
    </div></div>`;
}
function render(){
  const L=layout();curL=L;const vp=document.getElementById("vp");
  if(!L.ids.length){vp.innerHTML='<div class="empty">'+esc(t("emptyCanvas"))+'</div>';renderMinimap(L);return;}
  relatedSel=new Set();
  if(selId)L.edges.forEach(eid=>{const e=edgeById[eid];if(e.from===selId||e.to===selId){relatedSel.add(e.from);relatedSel.add(e.to);}});
  const links=routeEdges(L).map(x=>{const e=edgeById[x.eid];
    const cls=selId?((x.from===selId||x.to===selId)?"lit":"dim"):"";
    const arrow=cls==="lit"?"arrow-lit":(cls==="dim"?"arrow-dim":"arrow"),d=edgePath(x);
    return `<path class="link-hit" data-edge="${x.eid}" d="${d}"></path><path class="link ${e.type} ${cls}" data-edge="${x.eid}" d="${d}" marker-end="url(#${arrow})"></path>`;}).join("");
  const cards=L.ids.map(id=>{const p=L.pos[id];return `<div style="position:absolute;left:${p.x}px;top:${p.y}px">${cardHTML(id)}</div>`;}).join("");
  vp.style.width=L.width+"px";vp.style.height=L.height+"px";
  vp.innerHTML=`<svg class="links" width="${L.width}" height="${L.height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 z" fill="#000"/></marker><marker id="arrow-lit" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 z" fill="#e91d2a"/></marker><marker id="arrow-dim" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,4 L0,8 z" fill="#cfcfcf"/></marker></defs>${links}</svg>${cards}`;
  renderMinimap(L);
}
function xform(){document.getElementById("vp").style.transform=`translate(${panX}px,${panY}px) scale(${scale})`;document.getElementById("zl").textContent=Math.round(scale*100)+"%";mmState?updateMMView():renderMinimap(curL);}
const TINT={"done":"#c0d4a7","in-progress":"#8c9ae0","not-started":"#a5b8c0"};
const MM_PAD=6,MM_DOMAIN_PAD=80;
let mmState=null;
function viewportBounds(){const r=document.getElementById("stage").getBoundingClientRect();return{x:-panX/scale,y:-panY/scale,w:r.width/scale,h:r.height/scale};}
function makeMinimapState(L){const box=document.getElementById("minimap"),pad=MM_PAD,mw=Math.max(1,box.clientWidth-pad*2),mh=Math.max(1,box.clientHeight-pad*2);
  const domain=rectPad(L.content,MM_DOMAIN_PAD),k=Math.min(mw/domain.w,mh/domain.h);
  return{domain,scale:k,ox:(mw-domain.w*k)/2,oy:(mh-domain.h*k)/2,pad};}
function miniRect(r,m){return{x:m.pad+m.ox+(r.x-m.domain.x)*m.scale,y:m.pad+m.oy+(r.y-m.domain.y)*m.scale,w:r.w*m.scale,h:r.h*m.scale};}
function miniToWorld(x,y,m){return{x:(x-m.pad-m.ox)/m.scale+m.domain.x,y:(y-m.pad-m.oy)/m.scale+m.domain.y};}
function renderMinimap(L){const mm=document.getElementById("mm"),v=document.getElementById("mmview");if(!L||!L.ids.length){mm.innerHTML="";v.style.display="none";mmState=null;return;}
  const m=mmState=makeMinimapState(L);
  mm.innerHTML=L.ids.map(id=>{const p=L.pos[id],st=eff(id,"progress")??byId[id].status,r=miniRect(p,m);
    return `<div class="mm-node" style="left:${r.x}px;top:${r.y}px;width:${Math.max(4,r.w)}px;height:${Math.max(3,r.h)}px;background:${TINT[st]||'#a5b8c0'}"></div>`;}).join("");
  updateMMView(m);}
function updateMMView(m=mmState){const v=document.getElementById("mmview"),r=document.getElementById("stage").getBoundingClientRect();
  if(!curL||!m||!r.width){v.style.display="none";return;}const vr=miniRect(viewportBounds(),m);v.style.display="block";
  v.style.left=vr.x+"px";v.style.top=vr.y+"px";v.style.width=vr.w+"px";v.style.height=vr.h+"px";}
function zoom(s,cx,cy){if(zoomLocked)return;const r=document.getElementById("stage").getBoundingClientRect();cx=cx??r.width/2;cy=cy??r.height/2;
  const old=scale,ns=Math.min(2,Math.max(.3,s)),lx=(cx-panX)/old,ly=(cy-panY)/old;scale=ns;panX=cx-lx*ns;panY=cy-ly*ns;xform();}
function fit(){if(zoomLocked)return;const r=document.getElementById("stage").getBoundingClientRect();if(!curL)return;
  const b=curL.content,availW=Math.max(1,r.width-72),availH=Math.max(1,r.height-72);
  scale=Math.min(1,Math.max(.3,Math.min(availW/b.w,availH/b.h)));
  panX=r.width/2-(b.x+b.w/2)*scale;panY=r.height/2-(b.y+b.h/2)*scale;xform();}
const ZOOM_BTNS=["zout","zin","fit"];
function setLock(on){zoomLocked=on;
  const zl=document.getElementById("zl");zl.classList.toggle("locked",on);zl.title=on?t("zoomLocked"):t("zoomLock");
  ZOOM_BTNS.forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=on;});}

/* ── edits → changeset ── */
function origOf(id,f,i){const o=ORIG[id];if(f==="claim")return (o.claims[i]!=null?o.claims[i]:"");
  if(f==="section")return (o.sections&&o.sections[i]!=null?o.sections[i]:"");return o[f]!=null?o[f]:"";}
function recordEdit(id,f,val,i){
  const key=chKey(id,f,(f==="claim"||f==="section")?i:undefined);const from=origOf(id,f,i);
  if(String(val)===String(from)){CH.delete(key);}else{
    CH.set(key,{id,path:byId[id].path,field:f,from,to:val,who:byId[id].title,i:f==="claim"?(+i):undefined,section:f==="section"?i:undefined});}
  renderChanges();
}
function applyStatus(id,nx){const n=byId[id],cur=ORIG[id].status,field="progress";
  const key=chKey(id,field);if(nx===cur)CH.delete(key);else CH.set(key,{id,path:n.path,field,from:cur,to:nx,who:n.title});
  render();renderChanges();}

/* git-style diff for section edits: whole-line add/remove, with word-level marks for a
   line edited in place. One LCS (lcsOps) serves both the line and word levels. */
function lcsOps(A,B){const n=A.length,m=B.length,dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=A[i]===B[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const ops=[];let i=0,j=0;
  while(i<n&&j<m){if(A[i]===B[j]){ops.push(["eq",A[i]]);i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1]){ops.push(["del",A[i]]);i++;}else{ops.push(["add",B[j]]);j++;}}
  while(i<n)ops.push(["del",A[i++]]);while(j<m)ops.push(["add",B[j++]]);
  return ops;}
function lineDiff(a,b){return lcsOps(String(a==null?"":a).split("\n"),String(b==null?"":b).split("\n"));}
function wordDiffHTML(a,b){  // whitespace splits into its own tokens, so spaces stay aligned
  return lcsOps(a.split(/(\s+)/),b.split(/(\s+)/))
    .map(([tp,s])=>tp==="eq"?esc(s):s===""?"":`<span class="w-${tp}">${esc(s)}</span>`).join("");}
function diffHTML(from,to){
  const base=lineDiff(from,to),rows=[];  // fuse an adjacent del-run + add-run into per-line "mod" pairs
  for(let k=0;k<base.length;){
    if(base[k][0]==="del"){let d=k;while(d<base.length&&base[d][0]==="del")d++;
      let a=d;while(a<base.length&&base[a][0]==="add")a++;
      if(a>d){const ds=base.slice(k,d),as=base.slice(d,a),p=Math.min(ds.length,as.length);
        for(let q=0;q<p;q++)rows.push(["mod",wordDiffHTML(ds[q][1],as[q][1])]);
        for(let q=p;q<ds.length;q++)rows.push(ds[q]);
        for(let q=p;q<as.length;q++)rows.push(as[q]);
        k=a;continue;}}
    rows.push(base[k]);k++;
  }
  const keep=rows.map((r,k)=>r[0]!=="eq"||(rows[k-1]&&rows[k-1][0]!=="eq")||(rows[k+1]&&rows[k+1][0]!=="eq"));
  let out="",folded=false;
  rows.forEach((r,k)=>{
    if(keep[k]){const mk=r[0]==="del"?"−":r[0]==="add"?"+":r[0]==="mod"?"~":" ";
      out+=`<div class="dl ${r[0]}"><span class="dm">${mk}</span><span class="dt">${r[0]==="mod"?r[1]:(esc(r[1])||" ")}</span></div>`;folded=false;}
    else if(!folded){out+='<div class="dfold">⋯</div>';folded=true;}});
  return out;
}
function renderChanges(){
  const items=[...CH.values()],box=document.getElementById("changes"),badge=document.getElementById("badge");
  document.getElementById("save").disabled=!items.length;document.getElementById("gen").disabled=!items.length;
  badge.textContent=items.length;badge.classList.toggle("zero",!items.length);
  if(!items.length){box.innerHTML='<div class="disp-empty"><div class="mk">✎</div><p>'+esc(t("emptyChanges"))+'</p></div>';
    out.style.display="none";clearBtn.style.display="none";syncRThumb();return;}
  box.innerHTML=items.map((it,ix)=>{
    const fmt=v=>it.field==="progress"?statusLabel(v):trim(v,34);
    const cell=v=>{const s=esc(fmt(v));return s||`<span class="ph">${esc(t("emptyBody"))}</span>`;};
    const sub=it.field==="section"?esc(it.section):it.field==="claim"?("#"+((+it.i||0)+1)):"";
    const ml=String(it.from==null?"":it.from).includes("\n")||String(it.to==null?"":it.to).includes("\n");
    const desc=ml?`<div class="diff">${diffHTML(it.from,it.to)}</div>`
      :`<span class="from">${cell(it.from)}</span><span class="arr">→</span><span class="to">${cell(it.to)}</span>`;
    return `<div class="chg"><div class="h"><span class="ctag">${esc(fieldLabel(it.field))}</span>`
      +`<span class="who">${esc(trim(it.who,18))}</span>`+(sub?`<span class="sub">${sub}</span>`:"")
      +`<span class="undo" data-undo="${ix}">${esc(t("undo"))}</span></div>`
      +`<div class="desc">${desc}</div></div>`;
  }).join("");
  clearBtn.style.display="inline-block";syncRThumb();
}
function buildPrompt(){
  const items=[...CH.values()];if(!items.length)return"";
  const byFile={};items.forEach(it=>{(byFile[it.path]=byFile[it.path]||[]).push(it);});
  let s=t("promptIntro")+"\n\n";let i=1;
  for(const [f,its] of Object.entries(byFile)){s+="● "+f+"\n";
    for(const it of its){const isStat=it.field==="progress";const line=lang==="zh"
      ?(isStat?`「${it.who}」的${fieldLabel(it.field)}改为 ${statusLabel(it.to)}`:it.field==="section"?`「${it.who}」的小节「${it.section}」改为：${it.to}`:it.field==="claim"?`「${it.who}」的断言 #${(+it.i||0)+1} 从「${trim(it.from,40)}」改为：${it.to}`:`「${it.who}」的 ${fieldLabel(it.field)} 改为：${it.to}`)
      :(isStat?`set "${it.who}" ${fieldLabel(it.field)} to ${statusLabel(it.to)}`:it.field==="section"?`change "${it.who}" section "${it.section}" to: ${it.to}`:it.field==="claim"?`change "${it.who}" claim #${(+it.i||0)+1} from "${trim(it.from,40)}" to: ${it.to}`:`change "${it.who}" ${fieldLabel(it.field)} to: ${it.to}`);
      s+=`  ${i++}. ${line}\n`;}
    s+="\n";}
  return s.trim();
}
function toast(msg){const c=document.getElementById("toasts"),el=document.createElement("div");el.className="toast";el.textContent=msg;
  c.appendChild(el);setTimeout(()=>{el.style.opacity="0";setTimeout(()=>el.remove(),260);},2600);}

/* ── status menu ── */
function openMenu(id,anchor){const n=byId[id],m=document.getElementById("menu"),opts=STATUS_OPTS[n.kind];if(!opts)return;
  const cur=eff(id,"progress")??ORIG[id].status;
  m.innerHTML=opts.map(o=>`<button data-set="${o}" class="${o===cur?"cur":""}">${esc(statusLabel(o))}</button>`).join("");
  const r=anchor.getBoundingClientRect();m.style.display="block";m.style.left=Math.max(8,Math.min(r.left,window.innerWidth-150))+"px";
  const mh=m.offsetHeight,top=(r.bottom+4+mh>window.innerHeight-8)?Math.max(8,r.top-mh-4):r.bottom+4;m.style.top=top+"px";m.dataset.id=id;}
function closeMenu(){const m=document.getElementById("menu");m.style.display="none";m.dataset.id="";}

/* ── wiring ── */
const out=document.getElementById("out"),clearBtn=document.getElementById("clear"),qEl=document.getElementById("q");
document.addEventListener("focusout",e=>{const el=e.target;if(el.dataset&&el.dataset.id&&el.hasAttribute("contenteditable")){
  const val=el.innerText.trim();recordEdit(el.dataset.id,el.dataset.f,val,el.dataset.i);
  if(el.dataset.f==="title")titleEditing.delete(el.dataset.id);
  const sec=el.closest(".ov-sec");if(sec)sec.classList.toggle("dirty",CH.has(chKey(el.dataset.id,"section",el.dataset.i)));
  render();}});
document.addEventListener("keydown",e=>{
  const el=e.target,ce=el.isContentEditable,inp=el.tagName==="INPUT"||el.tagName==="TEXTAREA";
  if(ce){if(e.key==="Escape"){e.preventDefault();const id=el.dataset.id,f=el.dataset.f;el.innerText=origOf(id,f,el.dataset.i);el.blur();}
    else if(e.key==="Enter"&&f_inline(el)&&!e.shiftKey){e.preventDefault();el.blur();}return;}
  if(inp){if(e.key==="Escape"){el.blur();if(el.id==="q"){el.value="";query="";render();}}return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();const last=[...CH.keys()].pop();if(last){CH.delete(last);render();renderChanges();renderOverlay();}return;}
  if(e.key==="Escape"){closeMenu();if(connMode){setConnMode(false);return;}if(selId){selId=null;render();}return;}
  if(e.key==="/"){e.preventDefault();qEl.focus();qEl.select();return;}
  if(e.key==="0"){fit();return;}
  if(e.key==="r"||e.key==="R"){resetDrag();return;}
  if(e.key==="c"||e.key==="C"){setConnMode(!connMode);return;}
  if(e.key==="="||e.key==="+"){zoom(scale*1.15);return;}
  if(e.key==="-"||e.key==="_"){zoom(scale/1.15);return;}
});
function f_inline(t){return t.dataset.f==="content"||t.dataset.f==="claim"||t.dataset.f==="after"||t.dataset.f==="covers"||t.dataset.f==="title";}
document.addEventListener("paste",e=>{const t=e.target;if(t.isContentEditable){e.preventDefault();
  let txt=e.clipboardData.getData("text/plain")||"";
  if(t.dataset&&f_inline(t))txt=txt.replace(/\r?\n/g," ");  // frontmatter fields stay one line; document sections keep newlines
  document.execCommand("insertText",false,txt);}});
document.addEventListener("click",e=>{
  if(!e.target.closest(".menu,[data-status]"))closeMenu();
  const eg=e.target.closest("[data-edge]");if(eg){const eId=eg.dataset.edge,ed=edgeById[eId];
    if(ed){const toId=ed.to,srcStem=stemOf(ed.from),af=curAfter(toId).filter(s=>s!==srcStem);
      recordEdit(toId,"after",af.join(", "));toast(t("disconnected"));render();}return;}
  const tb=e.target.closest("[data-tab]");if(tb){ovTab=tb.dataset.tab;renderOverlay();return;}
  const ms=e.target.closest(".menu [data-set]");if(ms){applyStatus(document.getElementById("menu").dataset.id,ms.dataset.set);closeMenu();return;}
  const tg=e.target.closest("[data-toggle]");if(tg){const k=tg.dataset.toggle;open.has(k)?open.delete(k):open.add(k);delete measured[k];render();requestAnimationFrame(()=>{measure();render();});return;}
  const stp=e.target.closest("[data-status]");if(stp){const m=document.getElementById("menu");if(m.style.display!=="none"&&m.dataset.id===stp.dataset.status){closeMenu();}else{openMenu(stp.dataset.status,stp);}return;}
  const un=e.target.closest("[data-undo]");if(un){const it=[...CH.values()][+un.dataset.undo];if(it){CH.delete(keyOf(it));render();renderChanges();renderOverlay();}return;}
  const tt=e.target.closest(".ttl");if(tt&&tt.dataset.id&&!connMode&&!e.target.isContentEditable){titleEditing.add(tt.dataset.id);render();const el=document.querySelector(`[data-node="${tt.dataset.id}"] .ttl`);if(el){el.focus();const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);}return;}
  const nd=e.target.closest("[data-node]");if(nd&&!e.target.isContentEditable&&!e.target.closest(".pill,button")){
    const id=nd.dataset.node;
    if(connMode){if(!connPick){connPick=id;render();}else if(connPick!==id){toggleConn(connPick,id);connPick=null;}else{connPick=null;render();}return;}
    selId=id;render();return;}
  if(!e.target.closest("button,input,.menu,.toast,.toolbar,.minimap,.rail,[data-node]")){if(selId){selId=null;render();}}});
function keyOf(it){return chKey(it.id,it.field,it.field==="claim"?it.i:it.field==="section"?it.section:undefined);}
document.getElementById("zin").onclick=()=>zoom(scale*1.15);
document.getElementById("zout").onclick=()=>zoom(scale/1.15);
document.getElementById("fit").onclick=fit;
document.getElementById("zl").onclick=()=>setLock(!zoomLocked);
function resetDrag(){for(const id in dragOff)delete dragOff[id];render();}
document.getElementById("reset").onclick=resetDrag;
/* connect mode: click card A then B → toggle the A→B edge (write/remove A in B's after) */
function stemOf(id){return id.replace(/^S:/,"");}
function toggleConn(a,b){const af=curAfter(b).slice(),as=stemOf(a);
  const i=af.indexOf(as);if(i>=0){af.splice(i,1);recordEdit(b,"after",af.join(", "));toast(t("disconnected"));}
  else{af.push(as);recordEdit(b,"after",af.join(", "));toast(t("connected"));}connPick=null;render();}
function setConnMode(on){connMode=on;if(!on)connPick=null;else selId=null;
  document.getElementById("conn").classList.toggle("active",on);
  document.getElementById("stage").classList.toggle("connect",on);
  document.getElementById("conn").title=on?t("connMode"):t("connOff");render();}
document.getElementById("conn").onclick=()=>setConnMode(!connMode);
document.getElementById("gen").onclick=()=>{out.value=buildPrompt();out.style.display="block";
  if(navigator.clipboard)navigator.clipboard.writeText(out.value);toast(t("copied"));};
document.getElementById("save").onclick=async()=>{
  const edits=[...CH.values()].map(it=>({id:it.id,path:it.path,field:it.field,from:it.from,to:it.to,section:it.section,i:it.i}));
  try{const res=await fetch("/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({edits})});
    const j=await res.json();
    if(j.ok){CH.clear();out.style.display="none";out.value="";
      // adopt the written values as the new baseline so re-edits, search, and the
      // minimap diff against what was saved, not the pre-edit snapshot
      edits.forEach(e=>{const o=ORIG[e.id],n=byId[e.id];if(!o)return;
        if(e.field==="progress"){o.status=e.to;if(n)n.status=e.to;}
        else if(e.field==="content"){o.content=e.to;if(n)n.content=e.to;}
        else if(e.field==="title"){o.title=e.to;if(n)n.title=e.to;}
        else if(e.field==="after"||e.field==="covers")o[e.field]=e.to;
        else if(e.field==="claim"&&o.claims)o.claims[e.i]=e.to;
        else if(e.field==="section"&&o.sections)o.sections[e.section]=e.to;});
      render();renderChanges();renderOverlay();toast(t("saved"));}
    else toast(t("saveFail")+(j.results||[]).map(r=>r.msg).filter(Boolean).join("; "));}
  catch(ex){toast(t("saveFail")+ex);}};
clearBtn.onclick=()=>{CH.clear();out.value="";out.style.display="none";render();renderChanges();renderOverlay();};
qEl.addEventListener("input",()=>{query=qEl.value.trim();render();});
document.getElementById("qx").onclick=()=>{qEl.value="";query="";render();qEl.focus();};

/* pan + minimap nav + card drag (runtime displacement, never persisted) */
(function(){const st=document.getElementById("stage");let pan=null;
  let minidrag=false,dragNode=null;
  function navMinimap(e){if(!curL)return;const r=document.getElementById("minimap").getBoundingClientRect(),m=mmState||makeMinimapState(curL);
    const p=miniToWorld(e.clientX-r.left,e.clientY-r.top,m),sr=st.getBoundingClientRect();
    panX=sr.width/2-p.x*scale;panY=sr.height/2-p.y*scale;xform();}
  st.addEventListener("mousedown",e=>{
    if(e.target.closest(".minimap")){navMinimap(e);minidrag=true;e.preventDefault();return;}
    if(e.target.isContentEditable||e.target.closest("button,.pill,.toolbar"))return;
    const nd=e.target.closest("[data-node]");
    if(nd&&e.target.closest(".bar")&&!e.target.closest(".ttl")){const id=nd.dataset.node,od=dragOff[id]||{x:0,y:0};
      dragNode={id,sx:e.clientX,sy:e.clientY,odx:od.x,ody:od.y};e.preventDefault();return;}
    pan={x:e.clientX-panX,y:e.clientY-panY};st.classList.add("grabbing");});
  window.addEventListener("mousemove",e=>{
    if(minidrag){navMinimap(e);return;}
    if(dragNode){const d=dragOff[dragNode.id]||(dragOff[dragNode.id]={x:0,y:0});
      d.x=dragNode.odx+(e.clientX-dragNode.sx)/scale;d.y=dragNode.ody+(e.clientY-dragNode.sy)/scale;render();return;}
    if(pan){panX=e.clientX-pan.x;panY=e.clientY-pan.y;xform();}});
  window.addEventListener("mouseup",()=>{pan=null;minidrag=false;dragNode=null;st.classList.remove("grabbing");});
  st.addEventListener("wheel",e=>{e.preventDefault();const r=st.getBoundingClientRect();
    if(e.ctrlKey||e.metaKey||e.altKey){zoom(scale*(e.deltaY<0?1.1:.9),e.clientX-r.left,e.clientY-r.top);return;}
    if(e.shiftKey){panX-=(e.deltaY||e.deltaX);}else{panX-=e.deltaX;panY-=e.deltaY;}xform();},{passive:false});})();

/* ── documents left rail: northstar / abstract / active stages, view + edit ── */
let ovTab="northstar";
const ovLabel=k=>k==="northstar"?t("docNorthstar"):k==="abstract"?t("docAbstract"):t("docStage");
function secHTML(id,name){const k=chKey(id,"section",name),dirty=CH.has(k),o=ORIG[id];
  const text=dirty?CH.get(k).to:((o&&o.sections&&o.sections[name]!=null)?o.sections[name]:"");
  return `<div class="ov-sec ${dirty?"dirty":""}"><h4>${esc(name)}</h4><div class="docsec" contenteditable data-id="${esc(id)}" data-f="section" data-i="${esc(name)}" data-ph="${esc(t('emptyBody'))}">${esc(text)}</div></div>`;}
function docHTML(d){if(!d)return '<div class="ov-empty">'+esc(t("docMissing"))+'</div>';
  const secs=d.sections.length?d.sections.map(([n])=>secHTML(d.id,n)).join(""):'<div class="ov-empty">'+esc(t("emptyBody"))+'</div>';
  return `<div class="ov-doc"><div class="ov-h1">${esc(d.title)}</div>${secs}</div>`;}
function stagesHTML(list){if(!list||!list.length)return '<div class="ov-empty">'+esc(t("noStages"))+'</div>';
  return list.map(d=>`<div class="ov-doc"><div class="ov-h1">${esc(d.title)}</div>${d.sections.map(([n])=>secHTML(d.id,n)).join("")}</div>`).join("");}
function renderOverlay(){
  document.getElementById("ov-tabs").innerHTML=["northstar","abstract","stage"].map(k=>`<button class="ov-tab ${ovTab===k?"on":""}" data-tab="${k}">${esc(ovLabel(k))}</button>`).join("");
  const b=document.getElementById("ov-body");
  b.innerHTML=ovTab==="northstar"?docHTML(GRAPH.docs.northstar):ovTab==="abstract"?docHTML(GRAPH.docs.abstract):stagesHTML(GRAPH.docs.stages);syncLThumb();}
function applyStatic(){
  document.documentElement.lang=lang==="zh"?"zh-CN":"en";
  document.getElementById("q").placeholder=t("searchPh");
  document.getElementById("qx").title=t("clear");
  document.getElementById("lbl-changes").textContent=t("changes");
  document.getElementById("save").textContent=t("writeBack");
  document.getElementById("gen").textContent=t("copyPrompt");
  document.getElementById("clear").textContent=t("clearBtn");
  document.getElementById("langbtn").textContent=t("langBtn");
  document.getElementById("minimap").title=t("mmTip");
  document.getElementById("zl").title=zoomLocked?t("zoomLocked"):t("zoomLock");
}
function bindRailScroll(body,thumb,rail,side){
  function sync(){const ch=body.clientHeight,sh=body.scrollHeight;
    if(sh<=ch+1){thumb.style.display="none";return;}
    thumb.style.display="block";
    const br=body.getBoundingClientRect(),rr=rail.getBoundingClientRect();
    const th=Math.max(24,Math.round(ch*ch/sh)),maxTop=ch-th;
    const frac=(sh-ch)>0?body.scrollTop/(sh-ch):0;
    thumb.style.left=Math.round((side==="right"?rr.right-1:rr.left+1)-thumb.offsetWidth/2)+"px";
    thumb.style.top=Math.round(br.top+frac*maxTop)+"px";thumb.style.height=th+"px";}
  body.addEventListener("scroll",sync);
  let drag=null;
  thumb.addEventListener("mousedown",e=>{drag={y:e.clientY,top:body.scrollTop};e.preventDefault();e.stopPropagation();});
  window.addEventListener("mousemove",e=>{if(!drag)return;const ch=body.clientHeight,sh=body.scrollHeight,maxTop=ch-thumb.offsetHeight;
    if(maxTop>0)body.scrollTop=drag.top+(e.clientY-drag.y)*(sh-ch)/maxTop;});
  window.addEventListener("mouseup",()=>{drag=null;});
  return sync;}
syncLThumb=bindRailScroll(document.getElementById("ov-body"),document.getElementById("lthumb"),document.querySelector(".rail.left"),"right");
syncRThumb=bindRailScroll(document.getElementById("changes"),document.getElementById("rthumb"),document.querySelector(".rail.right"),"left");
document.getElementById("langbtn").onclick=()=>{lang=lang==="en"?"zh":"en";localStorage.setItem("ddpanel-lang",lang);applyStatic();render();renderChanges();renderOverlay();};
applyStatic();renderChanges();renderOverlay();render();requestAnimationFrame(()=>{measure();render();fit();syncLThumb();syncRThumb();});
window.addEventListener("resize",()=>{if(curL)fit();syncLThumb();syncRThumb();});
</script>
</body>
</html>
"""


if __name__ == "__main__":
    main()
