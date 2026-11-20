#!/usr/bin/env python3
"""Validate a DocDoki library or query relevant specs, work, and notes for a code path."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from docdoki_lib import find_for_path, render_spec_index, validate_library


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", help="unit root containing docdoki/")
    parser.add_argument("--privacy", action="store_true", help="check only privacy boundary and stem uniqueness")
    parser.add_argument("--for", dest="target_path", help="list specs, active work, and notes matching a unit-relative path")
    parser.add_argument("--index", action="store_true", help="print a Markdown table of public specs from frontmatter")
    parser.add_argument("--json", action="store_true", help="emit JSON output for --for or validation")
    args = parser.parse_args(argv)

    unit = Path(args.root)
    try:
        if args.target_path:
            matches = find_for_path(unit, args.target_path)
            if args.json:
                print(json.dumps(matches, ensure_ascii=False, indent=2))
            else:
                print(f"Matches for {matches['target']}:")
                for kind, label in (("specs", "Specs"), ("work", "Active work"), ("notes", "Notes")):
                    items = matches[kind]
                    if not items:
                        continue
                    print(f"\n{label}:")
                    for item in items:
                        extra = []
                        if item.get("status") and item["status"] != "decided":
                            extra.append(item["status"])
                        if item.get("progress"):
                            extra.append(item["progress"])
                        if item.get("purpose"):
                            extra.append(item["purpose"])
                        suffix = f" ({', '.join(extra)})" if extra else ""
                        print(f"  - {item['path']} — {item['title']}{suffix}")
                if not any(matches[k] for k in ("specs", "work", "notes")):
                    print("  (none)")
            return 0

        if args.index:
            sys.stdout.write(render_spec_index(unit))
            return 0

        errors, warnings = validate_library(unit, privacy_only=args.privacy)
        if args.json:
            print(json.dumps({"ok": not errors, "errors": errors, "warnings": warnings}, ensure_ascii=False, indent=2))
        else:
            for warning in warnings:
                print(f"WARN: {warning}")
            if errors:
                for error in errors:
                    print(f"FAIL: {error}")
            else:
                label = "DocDoki private boundary: OK" if args.privacy else "DocDoki library: OK"
                print(label)
        return 1 if errors else 0
    except ValueError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
