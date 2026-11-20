#!/usr/bin/env python3
"""Report English body length separately from references; check Markdown footnotes.

Counts are approximate: hyphenated words count once, numbers and mathematical
identifiers count as tokens. An over-budget result is informational, not approval
to expand the guide. Exit 1 indicates structural errors, not scientific quality.
"""

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys


REFERENCE_HEADINGS = {
    "references", "selected references", "bibliography", "selected reading",
    "further reading",
}
WORDS = re.compile(r"[A-Za-z0-9]+(?:[’'–-][A-Za-z0-9]+)*")


def scan_markdown(lines):
    """Return (prose_lines, syntax_lines) with line positions preserved.

    HTML comments outside code are removed from both views; fenced and inline
    code are blanked in syntax_lines so code examples cannot mimic headings or
    footnotes.
    """
    prose_lines, syntax_lines = [], []
    fence = None
    in_comment = False
    for line in lines:
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence:
            if (marker and marker[1][0] == fence[0]
                    and len(marker[1]) >= len(fence) and not marker[2].strip()):
                fence = None
            prose_lines.append(line)
            syntax_lines.append("")
            continue
        if not in_comment and marker:
            fence = marker[1]
            prose_lines.append(line)
            syntax_lines.append("")
            continue
        prose, syntax = [], []
        pos = 0
        while pos < len(line):
            if in_comment:
                end = line.find("-->", pos)
                if end < 0:
                    break
                in_comment = False
                pos = end + 3
                continue
            code = re.search(r"(`+).*?\1", line[pos:])
            comment = line.find("<!--", pos)
            if code and (comment < 0 or pos + code.start() < comment):
                prose.append(line[pos:pos + code.end()])
                syntax.append(line[pos:pos + code.start()])
                pos += code.end()
            elif comment >= 0:
                chunk = line[pos:comment]
                prose.append(chunk)
                syntax.append(chunk)
                in_comment = True
                pos = comment + 4
            else:
                chunk = line[pos:]
                prose.append(chunk)
                syntax.append(chunk)
                break
        prose_lines.append("".join(prose))
        syntax_lines.append("".join(syntax))
    return prose_lines, syntax_lines


def count_words(text):
    text = re.sub(r"\[\^[^\]]+\]", "", text)
    text = re.sub(r"https?://\S+", "", text)
    return len(WORDS.findall(text))


def parse_footnote_definitions(lines, masked):
    """Return (all_keys, non_empty_count, empty_keys) for Markdown footnotes.

    A definition has content if non-whitespace text appears on its opening line
    (after HTML comments are stripped) or on subsequent indented continuation
    lines before the next footnote definition, heading, or unindented text.
    """
    all_keys = []
    empty_keys = []
    non_empty_count = 0
    for i, line in enumerate(masked):
        match = re.match(r"^ {0,3}\[\^([^\]]+)\]:(.*)$", line)
        if not match:
            continue
        key = match[1]
        all_keys.append(key)
        prose_match = re.match(r"^ {0,3}\[\^([^\]]+)\]:(.*)$", lines[i])
        has_content = bool(prose_match and prose_match[2].strip())
        if not has_content:
            j = i + 1
            while j < len(lines):
                if not lines[j].strip() and not masked[j].strip():
                    j += 1
                    continue
                if re.match(r"^ {0,3}\[\^([^\]]+)\]:", masked[j]):
                    break
                if re.match(r"^ {0,3}#{1,6}\s+", masked[j]):
                    break
                if re.match(r"^(?:\t| {2,})\S", lines[j]):
                    has_content = True
                break
        if has_content:
            non_empty_count += 1
        else:
            empty_keys.append(key)
    return all_keys, non_empty_count, empty_keys


def check_text(text, budget=4000, references_heading=None):
    text = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\A---\s*\n.*?\n---(?:\s*\n|\s*\Z)", "", text, count=1, flags=re.S)
    lines, masked = scan_markdown(text.splitlines())
    wanted = {references_heading.casefold()} if references_heading else REFERENCE_HEADINGS
    boundaries = []
    for i, line in enumerate(masked):
        match = re.match(r"^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$", line)
        if match:
            title = re.sub(r"^\d+[.)]\s+", "", match[1]).strip()
            if title.casefold() in wanted:
                boundaries.append((i, title))

    errors = []
    if not boundaries:
        errors.append("No bibliography heading found; use --references-heading for a custom title.")
    elif len(boundaries) > 1:
        errors.append("Multiple bibliography headings found; body boundary is ambiguous.")
    boundary, title = boundaries[0] if boundaries else (len(lines), None)
    syntax = "\n".join(masked)
    definitions, non_empty_count, empty_defs = parse_footnote_definitions(lines, masked)
    citations = re.findall(r"\[\^([^\]]+)\](?!:)", syntax)
    duplicate = sorted(k for k, n in Counter(definitions).items() if n > 1)
    missing = sorted(set(citations) - set(definitions))
    unused = sorted(set(definitions) - set(citations))
    empty = sorted(set(empty_defs))
    for label, keys in [("Duplicate definitions", duplicate), ("Undefined citations", missing),
                        ("Unreferenced definitions", unused), ("Empty definitions", empty)]:
        if keys:
            errors.append(f"{label}: {', '.join(keys)}")
    if any(re.match(r"^ {0,3}\[\^[^\]]+\]:", line) for line in masked[:boundary]):
        errors.append("Footnote definitions occur in the body; move references to the bibliography.")

    body_words = count_words("\n".join(lines[:boundary]))
    return {
        "body_words": body_words,
        "bibliography_words": count_words("\n".join(lines[boundary + 1:])),
        "reference_entries": non_empty_count,
        "reference_heading": title,
        "budget": budget,
        "words_over_budget": max(0, body_words - budget),
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("guide", help="Markdown file path, or - to read standard input")
    parser.add_argument("--budget", type=int, default=4000)
    parser.add_argument("--references-heading", help="Bibliography title without Markdown/number prefix")
    args = parser.parse_args()
    if args.budget <= 0:
        parser.error("--budget must be positive")
    try:
        text = sys.stdin.read() if args.guide == "-" else Path(args.guide).read_text(encoding="utf-8")
        result = check_text(text, args.budget, args.references_heading)
    except (OSError, UnicodeError) as exc:
        parser.exit(1, f"Cannot read guide: {exc}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
