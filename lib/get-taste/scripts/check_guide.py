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


def mask_code(lines):
    """Preserve line positions while hiding fenced/inline code from syntax checks."""
    masked = []
    fence = None
    for line in lines:
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence:
            if (marker and marker[1][0] == fence[0]
                    and len(marker[1]) >= len(fence) and not marker[2].strip()):
                fence = None
            masked.append("")
        elif marker:
            fence = marker[1]
            masked.append("")
        else:
            masked.append(re.sub(r"(`+).*?\1", "", line))
    return masked


def count_words(text):
    text = re.sub(r"\[\^[^\]]+\]", "", text)
    text = re.sub(r"https?://\S+", "", text)
    return len(WORDS.findall(text))


def check_text(text, budget=4000, references_heading=None):
    text = text.lstrip("\ufeff")
    text = re.sub(r"\A---\s*\n.*?\n---\s*\n", "", text, count=1, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    lines = text.splitlines()
    masked = mask_code(lines)
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
    definitions = re.findall(r"^ {0,3}\[\^([^\]]+)\]:", syntax, re.M)
    citations = re.findall(r"\[\^([^\]]+)\](?!:)", syntax)
    duplicate = sorted(k for k, n in Counter(definitions).items() if n > 1)
    missing = sorted(set(citations) - set(definitions))
    unused = sorted(set(definitions) - set(citations))
    for label, keys in [("Duplicate definitions", duplicate), ("Undefined citations", missing),
                        ("Unreferenced definitions", unused)]:
        if keys:
            errors.append(f"{label}: {', '.join(keys)}")
    if any(re.match(r"^ {0,3}\[\^[^\]]+\]:", line) for line in masked[:boundary]):
        errors.append("Footnote definitions occur in the body; move references to the bibliography.")

    body_words = count_words("\n".join(lines[:boundary]))
    return {
        "body_words": body_words,
        "bibliography_words": count_words("\n".join(lines[boundary + 1:])),
        "reference_entries": len(definitions),
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
