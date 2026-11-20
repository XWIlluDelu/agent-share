"""Shared stdlib core for DocDoki validation, lookup, frontmatter I/O, and Panel.

Single source of truth for:
- Document discovery (northstar, overview/spec_abstract, specs, work/stages, notes, private/)
- Lossless YAML frontmatter subset (scalars, block/folded scalars, flow/block lists)
- Wiki-link, Markdown-link, and frontmatter reference extraction
- Path-based privacy boundary verification
- Glob matching (with ** and {a,b} brace expansion) for covers/scope lookup
"""
from __future__ import annotations

import functools
import hashlib
import json
import os
import re
import subprocess
from collections import Counter, deque
from pathlib import Path
from urllib.parse import unquote

SECTION_DIRS = ("specs", "work", "stages", "notes")
TOP_DOCS = ("northstar.md", "overview.md", "spec_abstract.md")
PROGRESS_VALUES = (None, "not-started", "in-progress", "blocked", "done")
STATUS_VALUES = (None, "proposed", "decided")

WIKI_LINK = re.compile(r"\[\[([^\]#|]+)(?:[#|][^\]]*)?\]\]")
MARKDOWN_LINK = re.compile(r"\]\(([^)\s]+)(?:\s+[^)]*)?\)")
RELATIVE_PRIVATE_PATH = re.compile(r"(?<![\w/.-])((?:(?:\.\.?)/)*private/[^\s`'\"\)\]]+)")
INLINE_CODE = re.compile(r"`[^`\n]+`")


class FormatError(ValueError):
    pass


def read_source(path: Path) -> str:
    with path.open(encoding="utf-8", newline="") as stream:
        return stream.read()


def revision(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def strip_code(text: str) -> str:
    """Remove fenced code blocks and inline code spans before scanning prose links."""
    out: list[str] = []
    fence = None
    for line in text.splitlines(keepends=True):
        stripped = line.rstrip("\r\n")
        match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", stripped)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
                fence = None
            out.append("\n")
        elif match:
            fence = match[1]
            out.append("\n")
        else:
            out.append(INLINE_CODE.sub("", line))
    return "".join(out)


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
        raise FormatError("Unsupported YAML: use a quoted scalar, block scalar, or flat list")
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
    if not pieces[-1]:
        pieces.pop()
    if any(not part for part in pieces):
        raise FormatError("Empty flow-list item")
    return [scalar(part) for part in pieces]


def _consume_block_scalar(lines: list[str], start_index: int, header: str) -> tuple[str, int]:
    style = header[0]  # '|' or '>'
    chomp = header[1:]  # '', '-', '+'
    collected: list[str] = []
    indent: int | None = None
    i = start_index
    while i < len(lines):
        raw = lines[i]
        if not raw.strip():
            collected.append("")
            i += 1
            continue
        leading = len(raw) - len(raw.lstrip(" "))
        if leading == 0:
            break
        if indent is None:
            indent = leading
        if leading < indent:
            break
        collected.append(raw[indent:])
        i += 1

    trailing_blanks = 0
    while collected and collected[-1] == "":
        collected.pop()
        trailing_blanks += 1

    if style == "|":
        text = "\n".join(collected)
    else:
        parts: list[str] = []
        idx = 0
        while idx < len(collected):
            line = collected[idx]
            if line == "":
                parts.append("\n")
                idx += 1
            else:
                if parts and not parts[-1].endswith("\n"):
                    parts.append(" ")
                parts.append(line)
                idx += 1
        text = "".join(parts)

    if chomp == "-":
        return text, i
    if chomp == "+":
        return text + ("\n" * (trailing_blanks + (1 if collected else 0))), i
    return (text + "\n") if collected else "", i


def parse_frontmatter(block: str) -> dict:
    data: dict = {}
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
        key, raw_value = match.groups()
        if key in data:
            raise FormatError(f"Duplicate metadata key: {key}")
        value = _uncomment(raw_value)
        if value in ("|", "|-", "|+", ">", ">-", ">+"):
            text, i = _consume_block_scalar(lines, i, value)
            data[key] = text.strip() if value.startswith(">") else text
            continue
        if value:
            data[key] = flow_list(value) if value.startswith("[") else scalar(value)
            continue
        items = []
        while i < len(lines):
            child = lines[i]
            if not child.strip() or child.lstrip().startswith("#"):
                i += 1
                continue
            item = re.fullmatch(r"[ \t]*-[ \t]+(.*)", child)
            if not item:
                break
            items.append(scalar(item[1]))
            i += 1
        data[key] = items or None
    return data


def split_frontmatter(text: str) -> tuple[dict, str]:
    raw, body = split_frontmatter_raw(text)
    return (parse_frontmatter(raw) if raw is not None else {}), body


def title_span(body: str):
    """Locate the first ATX H1 outside fenced code blocks."""
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


def document_title(path: Path) -> str:
    """Fast scan stopping at H1 without reading the rest of large files."""
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


def extract_section(body: str, names: tuple[str, ...]) -> str:
    """Extract text under the first matching H2 heading outside fenced code."""
    wanted = {name.lower() for name in names}
    fence = None
    capturing = False
    lines: list[str] = []
    for raw in body.splitlines():
        match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", raw)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
                fence = None
            if capturing:
                lines.append(raw)
            continue
        if match:
            fence = match[1]
            if capturing:
                lines.append(raw)
            continue
        heading = re.match(r"^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$", raw)
        if heading:
            level = len(heading[1])
            label = heading[2].strip().lower()
            if capturing and level <= 2:
                break
            if level == 2 and label in wanted:
                capturing = True
                continue
        if capturing:
            lines.append(raw)
    return "\n".join(lines).strip()


def extract_tasks(body: str) -> dict[str, int]:
    """Count Markdown task list items outside fenced code blocks."""
    done = total = 0
    for line in strip_code(body).splitlines():
        match = re.match(r"^[ \t]*[-+*][ \t]+\[([ xX])\][ \t]+", line)
        if match:
            total += 1
            if match[1].lower() == "x":
                done += 1
    return {"done": done, "total": total}


def extract_bullets(section_text: str) -> list[str]:
    """Extract top-level bullet items or non-empty paragraphs from a section."""
    items: list[str] = []
    for line in section_text.splitlines():
        bullet = re.match(r"^[ \t]*[-+*][ \t]+(?:\[[ xX]\][ \t]+)?(.+)$", line)
        if bullet:
            items.append(bullet[1].strip())
        elif line.strip() and not items:
            items.append(line.strip())
    return items


def _find_key_block_end(lines: list[str], start: int) -> int:
    end = start + 1
    while end < len(lines):
        raw = lines[end]
        if not raw.strip():
            end += 1
            continue
        if raw[0] in (" ", "\t"):
            end += 1
            continue
        break
    return end


def set_card_field(text: str, field: str, value) -> str:
    """Losslessly update one top-level card field (title/purpose/progress/status/area)."""
    fm, body = split_frontmatter(text)
    nl = "\r\n" if "\r\n" in text else "\n"
    if field == "title":
        if not isinstance(value, str) or not value.strip() or any(c in value for c in "\r\n\0"):
            raise FormatError("A title must be non-empty, single-line text")
        value = value.strip()
        span = title_span(body)
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
    elif field == "area":
        if value is not None and (not isinstance(value, str) or any(c in value for c in "\r\n\0")):
            raise FormatError("Area must be single-line text or empty")
        if isinstance(value, str):
            value = value.strip() or None
    elif field == "progress":
        if value not in PROGRESS_VALUES:
            raise FormatError("Unknown progress value")
    elif field == "status":
        if value not in STATUS_VALUES:
            raise FormatError("Unknown status value")
    else:
        raise FormatError("Only title, purpose, progress, status, and area are card fields")

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
        uncommented = _uncomment(previous)
        suffix = previous[len(uncommented):]
        block_end = _find_key_block_end(lines, i) if uncommented in ("|", "|-", "|+", ">", ">-", ">+") else i + 1
        if value is None:
            replacement = [suffix.lstrip() + ending] if suffix.lstrip().startswith("#") else []
        else:
            if suffix.startswith("#"):
                suffix = " " + suffix
            replacement = [prefix + encoded + suffix + ending]
        lines[i:block_end] = replacement
        break
    else:
        if value is not None:
            lines.append(field + ": " + encoded + nl)
    return text[:match.start(1)] + "".join(lines) + text[match.end(1):]


def set_after(text: str, items: list[str]) -> str:
    """Losslessly update frontmatter `after` list while preserving comments."""
    fm, _ = split_frontmatter(text)
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
            kept.extend(
                indent + "- " + json.dumps(name, ensure_ascii=False) + ending
                for name in items if name not in present
            )
            header_text = lines[start]
            if not items:
                header_text = prefix + "[]" + (" " if suffix.startswith("#") else "") + suffix + ending
            new = "".join(lines[:start]) + header_text + "".join(kept) + "".join(lines[end:])
    return text[:match.start(1)] + new + text[match.end(1):]


def library_paths(dd: Path) -> list[Path]:
    paths: list[Path] = [dd / name for name in TOP_DOCS]
    for base in (dd, dd / "private"):
        for section in SECTION_DIRS:
            folder = base / section
            if folder.is_dir():
                paths.extend(folder.rglob("*.md"))
    return sorted({p for p in paths if p.is_file()})


def is_symlink_within(path: Path, root: Path) -> bool:
    for parent in (path, *path.parents):
        if parent == root.parent:
            break
        if parent.is_symlink():
            return True
    return False


def allowed_path(root: Path, raw: str, *, must_exist: bool = True) -> Path:
    if not isinstance(raw, str) or not raw or Path(raw).is_absolute():
        raise ValueError("bad path")
    parts = Path(raw).parts
    if ".." in parts or not raw.endswith(".md"):
        raise ValueError("bad path")
    path = root / raw
    if is_symlink_within(path, root):
        raise ValueError("symlink document paths are not supported")
    tail = parts[1:] if parts and parts[0] == "docdoki" else ()
    top = len(tail) == 1 and tail[0] in TOP_DOCS
    if tail[:1] == ("private",):
        tail = tail[1:]
    section = len(tail) >= 2 and tail[0] in SECTION_DIRS
    if not (top or section):
        raise ValueError("unsupported document path: " + raw)
    if must_exist and not path.is_file():
        raise ValueError("missing or unsupported document path: " + raw)
    return path


def catalog_entry(path: Path, root: Path) -> dict:
    relative = path.relative_to(root).as_posix()
    parts = Path(relative).parts
    if "specs" in parts:
        kind = "spec"
    elif "work" in parts or "stages" in parts:
        kind = "work"
    elif "notes" in parts:
        kind = "note"
    else:
        kind = "overview"
    return {
        "path": relative,
        "stem": path.stem,
        "title": path.stem,
        "kind": kind,
        "private": parts[:2] == ("docdoki", "private"),
        "archived": "archive" in parts,
    }


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
    return {
        **catalog_entry(path, root),
        "title": h1(body) or path.stem,
        "source": source,
        "revision": revision(source),
        "fm": fm,
        "error": error,
    }


def _expand_braces(pattern: str) -> list[str]:
    match = re.search(r"\{([^{}]+)\}", pattern)
    if not match:
        return [pattern]
    prefix, suffix = pattern[:match.start()], pattern[match.end():]
    expanded: list[str] = []
    for option in match.group(1).split(","):
        expanded.extend(_expand_braces(prefix + option + suffix))
    return expanded


def _norm_rel(path: str) -> str:
    s = path.replace("\\", "/")
    while s.startswith("./"):
        s = s[2:]
    return s.lstrip("/")


@functools.lru_cache(maxsize=512)
def _glob_to_regex(pattern: str) -> re.Pattern[str]:
    pattern = _norm_rel(pattern)
    i = 0
    out = ["^"]
    n = len(pattern)
    while i < n:
        ch = pattern[i]
        if ch == "*":
            if i + 1 < n and pattern[i + 1] == "*":
                if i + 2 < n and pattern[i + 2] == "/":
                    out.append("(?:.*/)?")
                    i += 3
                else:
                    out.append(".*")
                    i += 2
            else:
                out.append("[^/]*")
                i += 1
        elif ch == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(ch))
            i += 1
    out.append("$")
    return re.compile("".join(out))


def glob_match(rel_path: str, pattern: str) -> bool:
    rel_path = _norm_rel(rel_path)
    if not pattern:
        return False
    return any(_glob_to_regex(expanded).match(rel_path) for expanded in _expand_braces(pattern))


def extract_wiki_stems(text: str) -> list[str]:
    """Return referenced stems from [[stem]], ignoring fenced and inline code."""
    cleaned = strip_code(text)
    stems: list[str] = []
    for raw in WIKI_LINK.findall(cleaned):
        normalized = raw.replace("\\", "/").strip()
        if normalized:
            stems.append(normalized)
    return stems


def visibility_error(root: Path, path: Path, source: str, private_stems: set[str] | None = None) -> str | None:
    private_root = (root / "docdoki/private").resolve()
    try:
        path.resolve().relative_to(private_root)
        return None
    except ValueError:
        pass

    if private_stems is None:
        dd = root / "docdoki"
        private_stems = {
            p.stem for p in library_paths(dd)
            if p.resolve().is_relative_to(private_root)
        }

    try:
        fm, _ = split_frontmatter(source)
    except FormatError:
        fm = {}

    fm_targets: list[str] = []
    for key in ("after", "specs", "relates"):
        value = fm.get(key)
        if isinstance(value, list):
            fm_targets.extend(str(item) for item in value if isinstance(item, str))

    targets = fm_targets + [t.strip() for t in WIKI_LINK.findall(source)]
    for target in targets:
        normalized = target.replace("\\", "/").strip()
        stem = normalized.removesuffix(".md").rsplit("/", 1)[-1]
        if stem in private_stems or normalized.startswith(("private/", "docdoki/private/")):
            return f"Shared document cannot reference a private document: {target}"

    hrefs = list(MARKDOWN_LINK.findall(source))
    hrefs.extend(RELATIVE_PRIVATE_PATH.findall(source))
    for href in hrefs:
        if "://" in href or href.startswith(("#", "mailto:")):
            continue
        target = (path.parent / unquote(href.split("#", 1)[0])).resolve()
        if target.is_relative_to(private_root):
            return "Shared document cannot contain a private path"

    if "docdoki/private/" in source:
        return "Shared document cannot contain a private path"
    return None


def analyze_spec_graph(nodes: list[dict]) -> list[dict]:
    """Validate spec `after` edges and compute topological columns."""
    diagnostics: list[dict] = []

    def report(code: str, node: dict, message: str):
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
        seen: set[str] = set()
        valid: list[str] = []
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


def extract_unit_links(dd: Path) -> list[dict]:
    """Discover parent and child DocDoki units linked from northstar.md."""
    ns = dd / "northstar.md"
    if not ns.is_file():
        return []
    try:
        text = read_source(ns)
        fm, body = split_frontmatter(text)
    except (OSError, UnicodeError, FormatError):
        return []

    units: list[dict] = []
    seen: set[Path] = {dd.resolve()}

    parent_href = fm.get("parent")
    if isinstance(parent_href, str) and parent_href.strip():
        target = (ns.parent / parent_href.strip()).resolve()
        parent_dd = target.parent if target.name == "northstar.md" else target
        if parent_dd.is_dir() and (parent_dd / "northstar.md").is_file() and parent_dd not in seen:
            seen.add(parent_dd)
            units.append({
                "relation": "parent",
                "title": parent_dd.parent.name,
                "root": str(parent_dd.parent),
                "href": parent_href.strip(),
            })

    for match in re.finditer(r"\[([^\]]+)\]\(([^)\s]+)\)", strip_code(body)):
        label, href = match.group(1).strip(), match.group(2).strip()
        if "://" in href or href.startswith(("#", "mailto:")):
            continue
        clean = unquote(href.split("#", 1)[0])
        if not clean.endswith("docdoki/northstar.md"):
            continue
        target = (ns.parent / clean).resolve()
        child_dd = target.parent
        if child_dd.is_dir() and target.is_file() and child_dd not in seen:
            seen.add(child_dd)
            units.append({
                "relation": "child",
                "title": label or child_dd.parent.name,
                "root": str(child_dd.parent),
                "href": clean,
            })
    return units


def _git(unit: Path, *args: str, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(unit), *args],
        text=True,
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def _list_unit_files(unit: Path) -> list[str]:
    """List unit-relative non-ignored code/data files for covers/scope validation."""
    top = _git(unit, "rev-parse", "--show-toplevel")
    if top.returncode == 0:
        listed = _git(unit, "ls-files", "-co", "--exclude-standard", "--", ".")
        if listed.returncode == 0:
            return [
                rel for rel in listed.stdout.splitlines()
                if rel and not rel.startswith("docdoki/")
            ]
    skip = {".git", "docdoki", "node_modules", ".venv", "__pycache__", ".pytest_cache"}
    files: list[str] = []
    for root_dir, dirs, filenames in os.walk(unit):
        dirs[:] = [d for d in dirs if d not in skip]
        base = Path(root_dir)
        for name in filenames:
            files.append((base / name).relative_to(unit).as_posix())
    return files


def validate_library(unit: Path, *, privacy_only: bool = False) -> tuple[list[str], list[str]]:
    """Validate DocDoki library boundaries and mechanical integrity.

    Returns (errors, warnings).
    """
    unit = unit.resolve()
    dd = unit / "docdoki"
    if not dd.is_dir():
        return [f"missing DocDoki library: {dd}"], []

    errors: list[str] = []
    warnings: list[str] = []
    private_root = (dd / "private").resolve()

    all_paths = library_paths(dd)
    private_paths = [p for p in all_paths if p.resolve().is_relative_to(private_root)]
    public_paths = [p for p in all_paths if not p.resolve().is_relative_to(private_root)]
    private_stems = {p.stem for p in private_paths}

    by_stem: dict[str, Path] = {}
    for path in all_paths:
        prior = by_stem.get(path.stem)
        if prior is not None:
            errors.append(
                f"duplicate document stem {path.stem!r}: "
                f"{prior.relative_to(unit)} and {path.relative_to(unit)}"
            )
        else:
            by_stem[path.stem] = path

    docs_by_path: dict[str, dict] = {}
    for path in all_paths:
        doc = document(path, unit)
        docs_by_path[doc["path"]] = doc

    for path in public_paths:
        doc = docs_by_path[path.relative_to(unit).as_posix()]
        err = visibility_error(unit, path, doc["source"], private_stems=private_stems)
        if err:
            errors.append(f"{err}: {doc['path']}")

    # Git private-boundary checks
    top = _git(unit, "rev-parse", "--show-toplevel")
    if top.returncode:
        errors.append("unit is not inside a Git repository")
    else:
        git_root = Path(top.stdout.strip()).resolve()
        try:
            private_rel = (dd / "private").relative_to(git_root)
        except ValueError:
            errors.append("docdoki/private is outside the Git worktree")
        else:
            tracked = _git(git_root, "ls-files", "--", private_rel.as_posix())
            if tracked.returncode:
                errors.append(f"cannot inspect tracked private files: {tracked.stderr.strip()}")
            elif tracked.stdout.strip():
                for rel in tracked.stdout.splitlines():
                    errors.append(f"private document is tracked by public Git history: {rel}")

            raw_private_files = sorted(
                p for p in (dd / "private").rglob("*")
                if p.is_file() or p.is_symlink()
            ) if (dd / "private").is_dir() else []
            probes = [dd / "private" / ".docdoki-private-probe", *raw_private_files]
            rels = [p.relative_to(git_root).as_posix() for p in probes]
            ignored = _git(
                git_root,
                "check-ignore", "--no-index", "-z", "--stdin",
                input_text="\0".join(rels) + "\0",
            )
            ignored_rels = {rel for rel in ignored.stdout.split("\0") if rel}
            for rel in rels:
                if rel not in ignored_rels:
                    errors.append(f"private path is not ignored by Git: {rel}")

    if privacy_only:
        return errors, warnings

    # Full mechanical integrity checks
    known_stems = set(by_stem.keys())
    spec_nodes: list[dict] = []
    spec_stems: set[str] = set()
    unit_files: list[str] | None = None

    for doc in docs_by_path.values():
        rel = doc["path"]
        if doc["error"]:
            errors.append(f"frontmatter error in {rel}: {doc['error']}")
            continue

        fm = doc["fm"]
        _, body = split_frontmatter_raw(doc["source"])

        # Wiki-links check for active documents only (archives are historical snapshots)
        if not doc["archived"]:
            for target in extract_wiki_stems(body):
                stem = target.removesuffix(".md").rsplit("/", 1)[-1]
                if stem not in known_stems:
                    errors.append(f"broken wiki-link [[{target}]] in {rel}")

        if doc["kind"] == "spec" and not doc["archived"]:
            spec_stems.add(doc["stem"])
            purpose = fm.get("purpose", "")
            progress = fm.get("progress")
            status = fm.get("status")
            area = fm.get("area")
            covers = fm.get("covers") or []
            if not isinstance(purpose, str):
                errors.append(f"invalid purpose in {rel}: must be text")
            if progress not in PROGRESS_VALUES:
                errors.append(f"invalid progress {progress!r} in {rel}")
            if status not in STATUS_VALUES:
                errors.append(f"invalid status {status!r} in {rel}")
            if area is not None and not isinstance(area, str):
                errors.append(f"invalid area in {rel}: must be text")
            if not isinstance(covers, list) or any(not isinstance(v, str) for v in covers):
                errors.append(f"invalid covers in {rel}: must be a list of globs")
            elif progress == "done" and covers:
                if unit_files is None:
                    unit_files = _list_unit_files(unit)
                if not any(glob_match(f, pat) for f in unit_files for pat in covers):
                    warnings.append(f"done spec has covers globs matching no files: {rel} ({covers})")

            spec_nodes.append({
                "path": rel,
                "stem": doc["stem"],
                "after": fm.get("after"),
                "private": doc["private"],
            })

    for diag in analyze_spec_graph(spec_nodes):
        errors.append(f"{diag['path']}: {diag['message']}")

    for doc in docs_by_path.values():
        if doc["error"] or doc["archived"]:
            continue
        fm = doc["fm"]
        rel = doc["path"]
        for field in ("specs", "relates"):
            refs = fm.get(field)
            if refs is None:
                continue
            if not isinstance(refs, list) or any(not isinstance(v, str) or not v for v in refs):
                errors.append(f"invalid {field} in {rel}: must be a list of stems")
                continue
            for stem in refs:
                if field == "specs" and stem not in spec_stems:
                    errors.append(f"broken specs reference {stem!r} in {rel}")
                elif field == "relates" and stem not in known_stems:
                    errors.append(f"broken relates reference {stem!r} in {rel}")

    return errors, warnings


def find_for_path(unit: Path, target: str) -> dict[str, list[dict]]:
    """Find specs, active work items, and notes relevant to a unit-relative path."""
    unit = unit.resolve()
    dd = unit / "docdoki"
    if not dd.is_dir():
        raise ValueError(f"missing DocDoki library: {dd}")

    rel_target = _norm_rel(target)
    try:
        candidate = Path(target)
        if candidate.is_absolute():
            rel_target = candidate.resolve().relative_to(unit).as_posix()
    except ValueError:
        pass

    docs = [document(p, unit) for p in library_paths(dd)]
    matched_specs: list[dict] = []
    matched_spec_stems: set[str] = set()

    for doc in docs:
        if doc["kind"] != "spec" or doc["archived"] or doc["error"]:
            continue
        covers = doc["fm"].get("covers") or []
        if isinstance(covers, list) and any(isinstance(g, str) and glob_match(rel_target, g) for g in covers):
            matched_specs.append({
                "path": doc["path"],
                "stem": doc["stem"],
                "title": doc["title"],
                "progress": doc["fm"].get("progress"),
                "status": doc["fm"].get("status") or "decided",
            })
            matched_spec_stems.add(doc["stem"])

    matched_work: list[dict] = []
    for doc in docs:
        if doc["kind"] != "work" or doc["archived"] or doc["error"]:
            continue
        scope = doc["fm"].get("scope") or []
        linked_specs = doc["fm"].get("specs") or []
        by_scope = isinstance(scope, list) and any(isinstance(g, str) and glob_match(rel_target, g) for g in scope)
        by_spec = isinstance(linked_specs, list) and any(s in matched_spec_stems for s in linked_specs)
        if by_scope or by_spec:
            matched_work.append({
                "path": doc["path"],
                "stem": doc["stem"],
                "title": doc["title"],
                "status": doc["fm"].get("status"),
            })

    matched_notes: list[dict] = []
    for doc in docs:
        if doc["kind"] != "note" or doc["archived"] or doc["error"]:
            continue
        covers = doc["fm"].get("covers") or []
        relates = doc["fm"].get("relates") or []
        by_cover = isinstance(covers, list) and any(isinstance(g, str) and glob_match(rel_target, g) for g in covers)
        by_relate = isinstance(relates, list) and any(s in matched_spec_stems for s in relates)
        if by_cover or by_relate:
            matched_notes.append({
                "path": doc["path"],
                "stem": doc["stem"],
                "title": doc["title"],
                "purpose": doc["fm"].get("purpose", ""),
            })

    return {"target": rel_target, "specs": matched_specs, "work": matched_work, "notes": matched_notes}


def render_spec_index(unit: Path) -> str:
    """Render a concise Markdown table of public specs from frontmatter."""
    unit = unit.resolve()
    dd = unit / "docdoki"
    if not dd.is_dir():
        raise ValueError(f"missing DocDoki library: {dd}")
    rows: list[tuple[str, str, str, str]] = []
    for path in library_paths(dd):
        doc = document(path, unit)
        if doc["kind"] != "spec" or doc["archived"] or doc["private"] or doc["error"]:
            continue
        fm = doc["fm"]
        area = str(fm.get("area") or "—")
        status_bits = []
        if fm.get("status") == "proposed":
            status_bits.append("proposed")
        if fm.get("progress"):
            status_bits.append(str(fm["progress"]))
        state = " / ".join(status_bits) if status_bits else "—"
        purpose = str(fm.get("purpose") or "").replace("\n", " ").replace("|", "\\|")
        rows.append((area, f"[[{doc['stem']}]]", state, purpose))
    rows.sort(key=lambda r: (r[0] == "—", r[0].lower(), r[1].lower()))
    lines = ["| Area | Spec | State | Purpose |", "| :--- | :--- | :--- | :--- |"]
    for area, link, state, purpose in rows:
        lines.append(f"| {area} | {link} | {state} | {purpose} |")
    return "\n".join(lines) + "\n"
