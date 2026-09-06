"""Lossless source I/O and the panel's explicitly supported frontmatter format.

Metadata is a top-level mapping of scalars or flat scalar lists (flow or block).
Unsupported YAML is diagnosed, never guessed. Markdown is read in full; writes
address the complete source, not a heading name or a rendered list-item index.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


class FormatError(ValueError):
    pass


def read_source(path: Path) -> str:
    with path.open(encoding="utf-8", newline="") as stream:
        return stream.read()


def revision(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def frontmatter_span(text: str):
    match = re.match(r"\A---[ \t]*\r?\n(.*?)^---[ \t]*(?:\r?\n|\Z)", text, re.S | re.M)
    if not match and re.match(r"\A---[ \t]*\r?\n", text):
        raise FormatError("Unclosed frontmatter delimiter")
    return match


def split_frontmatter_raw(text: str):
    match = frontmatter_span(text)
    return (match[1], text[match.end():]) if match else (None, text)


def _uncomment(value: str) -> str:
    quote = None
    i = 0
    while i < len(value):
        ch = value[i]
        if quote:
            if ch == "\\" and quote == '"':
                i += 2
                continue
            if ch == quote:
                if quote == "'" and i + 1 < len(value) and value[i + 1] == "'":
                    i += 2
                    continue
                quote = None
        elif ch in "\"'" and (i == 0 or value[i - 1] in " [,\t"):
            quote = ch
        elif ch == "#" and (i == 0 or value[i - 1].isspace()):
            return value[:i].rstrip()
        i += 1
    if quote:
        raise FormatError("Unclosed quoted scalar")
    return value.strip()


def scalar(value: str):
    value = _uncomment(value)
    if not value or value in ("null", "Null", "NULL", "~"):
        return None
    if value.startswith('"'):
        try:
            result = json.loads(value)
        except ValueError as exc:
            raise FormatError("Use JSON-compatible double quotes or YAML single quotes") from exc
        if not isinstance(result, str):
            raise FormatError("Expected a scalar string")
        return result
    if value.startswith("'"):
        if not re.fullmatch(r"'(?:[^']|'')*'", value):
            raise FormatError("Invalid single-quoted scalar")
        return value[1:-1].replace("''", "'")
    if value[0] in "[]{}&*!|>@`%," or re.search(r":(?:\s|$)", value):
        raise FormatError("Unsupported YAML: use a quoted scalar or a flat scalar list")
    if value.lower() in ("true", "false"):
        return value.lower() == "true"
    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", value):
        return float(value) if "." in value else int(value)
    return value


def flow_list(value: str) -> list:
    value = _uncomment(value)
    if not value.endswith("]"):
        raise FormatError("Unclosed flow list")
    inner = value[1:-1]
    if not inner.strip():
        return []
    quote = None
    start = i = 0
    pieces = []
    while i < len(inner):
        ch = inner[i]
        if quote:
            if ch == "\\" and quote == '"':
                i += 2
                continue
            if ch == quote:
                if quote == "'" and i + 1 < len(inner) and inner[i + 1] == "'":
                    i += 2
                    continue
                quote = None
        elif ch in "\"'" and not inner[start:i].strip():
            quote = ch
        elif ch == ",":
            pieces.append(inner[start:i].strip())
            start = i + 1
        elif ch in "[]{}":
            raise FormatError("Quote values containing flow punctuation; nested lists are unsupported")
        i += 1
    pieces.append(inner[start:].strip())
    if not pieces[-1]:  # YAML permits a trailing comma.
        pieces.pop()
    if any(not part for part in pieces):
        raise FormatError("Empty flow-list item")
    return [scalar(part) for part in pieces]


def parse_frontmatter(block: str) -> dict:
    data = {}
    lines = block.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.fullmatch(r"([A-Za-z_][\w-]*):[ \t]*(.*)", line)
        if not match:
            raise FormatError("Metadata must use top-level keys and scalar values or flat lists")
        key, value = match.groups()
        if key in data:
            raise FormatError(f"Duplicate metadata key: {key}")
        value = _uncomment(value)
        if value:
            data[key] = flow_list(value) if value.startswith("[") else scalar(value)
            continue
        items = []
        while i < len(lines):
            line = lines[i]
            if not line.strip() or line.lstrip().startswith("#"):
                i += 1
                continue
            item = re.fullmatch(r"[ \t]*-[ \t]+(.*)", line)
            if not item:
                break
            items.append(scalar(item[1]))
            i += 1
        data[key] = items or None
    return data


def split_frontmatter(text: str):
    raw, body = split_frontmatter_raw(text)
    return (parse_frontmatter(raw) if raw is not None else {}), body


def h1(body: str) -> str:
    """Title summary only; never used to locate a write."""
    fence = None
    for line in body.splitlines():
        match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
                fence = None
        elif match:
            fence = match[1]
        else:
            title = re.match(r"^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$", line)
            if title:
                return title[1]
    return ""


def set_after(text: str, items: list[str]) -> str:
    """Replace one validated top-level YAML value; preserve all other bytes."""
    split_frontmatter(text)  # Reject duplicates/unsupported forms before locating.
    match = frontmatter_span(text)
    nl = "\r\n" if "\r\n" in text else "\n"
    line = "after: " + json.dumps(items, ensure_ascii=False) + nl
    if not match:
        return "---" + nl + line + "---" + nl + text
    raw = match[1]
    lines = raw.splitlines(keepends=True)
    start = next((i for i, entry in enumerate(lines) if entry.startswith("after:")), None)
    if start is None:
        new = raw + line
    else:
        end = start + 1
        comments = []
        while end < len(lines):
            stripped = lines[end].lstrip()
            if not stripped.strip() or stripped.startswith("#"):
                comments.append(lines[end])
            elif not stripped.startswith(("- ", "-\t")):
                break
            end += 1
        new = "".join(lines[:start]) + line + "".join(comments) + "".join(lines[end:])
    return text[:match.start(1)] + new + text[match.end(1):]


def document(path: Path, root: Path, source: str | None = None) -> dict:
    source = read_source(path) if source is None else source
    error = None
    try:
        fm, body = split_frontmatter(source)
    except FormatError as exc:
        error = str(exc)
        fm = {}
        try:
            _, body = split_frontmatter_raw(source)
        except FormatError:
            body = source
    relative = path.relative_to(root).as_posix()
    parts = Path(relative).parts
    kind = next((k[:-1] for k in ("specs", "stages", "notes") if k in parts), "overview")
    return {"id": relative, "path": relative, "stem": path.stem, "kind": kind,
            "title": h1(body) or path.stem, "body": body, "source": source,
            "revision": revision(source), "fm": fm, "error": error,
            "private": parts[:2] == ("docdoki", "private"), "archived": "archive" in parts}
