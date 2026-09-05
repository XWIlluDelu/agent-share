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
    match = re.match(r"\A\ufeff?---[ \t]*\r?\n(.*?)^---[ \t]*(?:\r?\n|\Z)", text, re.S | re.M)
    if not match and re.match(r"\A\ufeff?---[ \t]*\r?\n", text):
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


def title_span(body: str):
    """Locate the first ATX H1 outside fenced/indented code, not by its name."""
    fence = None
    offset = 0
    for entry in body.splitlines(keepends=True):
        line = entry.rstrip("\r\n")
        match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
                fence = None
        elif match:
            fence = match[1]
        else:
            title = re.match(r"^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$", line)
            if title:
                return offset + title.start(1), offset + title.end(1)
        offset += len(entry)
    return None


def h1(body: str) -> str:
    span = title_span(body)
    return body[slice(*span)] if span else ""


def set_card_field(text: str, field: str, value) -> str:
    """Transform one small field in a complete source; do not write to disk."""
    fm, body = split_frontmatter(text)
    nl = "\r\n" if "\r\n" in text else "\n"
    if field == "title":
        if not isinstance(value, str) or not value.strip() or any(c in value for c in "\r\n\0"):
            raise FormatError("A title must be non-empty, single-line text")
        value = value.strip()
        span = title_span(body)
        # Avoid silently interpreting title text as a closing ATX marker.
        if h1("# " + value) != value:
            raise FormatError("Use document source for this heading syntax")
        if span:
            if re.search(r"(?m)^ {0,3}<[A-Za-z/!?]", body[:span[0]]):
                raise FormatError("Use document source for titles following HTML blocks")
            start, end = len(text) - len(body) + span[0], len(text) - len(body) + span[1]
            return text[:start] + value + text[end:]
        return text[:len(text) - len(body)] + "# " + value + nl + nl + body
    if field == "purpose":
        if not isinstance(value, str) or "\0" in value:
            raise FormatError("Purpose must be text")
    elif field == "progress":
        if value not in (None, "not-started", "in-progress", "done"):
            raise FormatError("Unknown progress value")
    else:
        raise FormatError("Only title, purpose and progress are card fields")
    if field in fm and isinstance(fm[field], (list, dict)):
        raise FormatError("Use document source to replace a structured field")
    if fm.get(field) == value:
        return text
    match = frontmatter_span(text)
    encoded = json.dumps(value, ensure_ascii=False)
    if not match:
        return ("---" + nl + field + ": " + encoded + nl + "---" + nl + text) if value is not None else text
    lines = match[1].splitlines(keepends=True)
    for i, entry in enumerate(lines):
        found = re.match(rf"({field}:[ \t]*)(.*?)(\r?\n)$", entry)
        if not found:
            continue
        prefix, previous, ending = found.groups()
        # Keep inline comments and trailing whitespace outside the changed value.
        suffix = previous[len(_uncomment(previous)):]
        if value is None:
            lines[i] = suffix.lstrip() + ending if suffix.lstrip().startswith("#") else ""
        else:
            if suffix.startswith("#"):
                suffix = " " + suffix
            lines[i] = prefix + encoded + suffix + ending
        break
    else:
        if value is not None:
            lines.append(field + ": " + encoded + nl)
    return text[:match.start(1)] + "".join(lines) + text[match.end(1):]


def set_after(text: str, items: list[str]) -> str:
    """Preserve field comments and the spelling/comments of retained block items."""
    fm, _ = split_frontmatter(text)  # Reject unsupported forms before locating.
    if (fm.get("after") or []) == items:
        return text
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
        header = re.fullmatch(r"(after:[ \t]*)(.*?)(\r?\n)", lines[start])
        if not header:
            raise FormatError("Use document source for this dependency format")
        prefix, value, ending = header.groups()
        uncommented = _uncomment(value)
        suffix = value[len(uncommented):]
        if uncommented:
            # Flow lists have no item-level line comments in the supported grammar.
            # Keep the field's rationale and exact surrounding lines.
            lines[start] = prefix + json.dumps(items, ensure_ascii=False) + suffix + ending
            new = "".join(lines)
        else:
            end = start + 1
            kept, present, indent = [], [], "  "
            while end < len(lines):
                entry = lines[end]
                item = re.fullmatch(r"([ \t]*)-[ \t]+(.*?)(\r?\n)", entry)
                if item:
                    indent = item[1]
                    name = scalar(item[2])
                    if name in items:
                        kept.append(entry)
                        present.append(name)
                elif not entry.strip() or entry.lstrip().startswith("#"):
                    kept.append(entry)
                else:
                    break
                end += 1
            kept.extend(indent + "- " + json.dumps(name, ensure_ascii=False) + ending
                        for name in items if name not in present)
            header_text = lines[start]
            if not items:
                header_text = prefix + "[]" + (" " if suffix.startswith("#") else "") + suffix + ending
            new = "".join(lines[:start]) + header_text + "".join(kept) + "".join(lines[end:])
    return text[:match.start(1)] + new + text[match.end(1):]


def document_title(path: Path) -> str:
    """Catalog-only reads stop at H1 instead of reading/parsing historical bodies."""
    fence = None
    metadata = False
    fallback = ""
    with path.open(encoding="utf-8", newline="") as stream:
        for number, entry in enumerate(stream):
            line = entry.rstrip("\r\n")
            if number == 0 and re.fullmatch(r"\ufeff?---[ \t]*", line):
                metadata = True
                continue
            if metadata and re.fullmatch(r"---[ \t]*", line):
                metadata = False
                fallback = ""
                fence = None
                continue
            match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
            if fence:
                if match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
                    fence = None
            elif match:
                fence = match[1]
            else:
                title = h1(entry)
                if title:
                    if not metadata:
                        return title
                    if not fallback:
                        fallback = title
    return fallback or path.stem


def catalog_entry(path: Path, root: Path) -> dict:
    relative = path.relative_to(root).as_posix()
    parts = Path(relative).parts
    kind = next((k[:-1] for k in ("specs", "stages", "notes") if k in parts), "overview")
    return {"path": relative, "stem": path.stem, "title": path.stem, "kind": kind,
            "private": parts[:2] == ("docdoki", "private"), "archived": "archive" in parts}


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
    return {**catalog_entry(path, root), "title": h1(body) or path.stem,
            "source": source, "revision": revision(source), "fm": fm, "error": error}
