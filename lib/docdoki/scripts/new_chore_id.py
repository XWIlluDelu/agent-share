#!/usr/bin/env python3
"""Generate a cryptographically random 6-char base32 chore ID.

Usage:
    new_chore_id.py [--count N] [--exclude FILE]

Options:
    --count N           Emit N IDs (default 1, one per line).
    --exclude FILE      Path to chores.md; mint IDs that don't collide with
                        any existing [chore-XXXXXX] in the file.

Why not let the LLM generate this:
    LLMs pattern-lock under repetition. Empirical collision rate for
    LLM-emitted "random" base32 is far higher than 32^6's theoretical 10^-9.
    secrets.token_hex with base32 encoding is uniformly random.
"""

import argparse
import re
import secrets
import sys
from pathlib import Path

BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"  # RFC 4648 lowercase
ID_LENGTH = 6
ID_PATTERN = re.compile(r"\[chore-([a-z2-7]{6})\]")


def mint_id() -> str:
    """Return a single uniformly-random 6-char base32 ID."""
    raw = secrets.token_bytes(8)  # 64 bits; ample for 30 base32 chars
    # Convert each byte to a base32 char by taking 5 low bits.
    chars = []
    bits = int.from_bytes(raw, "big")
    for _ in range(ID_LENGTH):
        chars.append(BASE32_ALPHABET[bits & 0x1F])
        bits >>= 5
    return "".join(chars)


def collect_existing(path: Path) -> set[str]:
    if not path.exists():
        return set()
    text = path.read_text(encoding="utf-8")
    return set(ID_PATTERN.findall(text))


def mint_unique_ids(count: int, existing: set[str]) -> list[str]:
    """Mint `count` IDs that don't collide with `existing` or each other.

    Retries internally; given 10^9 space the loop terminates trivially.
    """
    out: list[str] = []
    seen = set(existing)
    while len(out) < count:
        candidate = mint_id()
        if candidate in seen:
            continue
        seen.add(candidate)
        out.append(candidate)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--exclude", type=Path, default=None)
    args = parser.parse_args()

    existing = collect_existing(args.exclude) if args.exclude else set()
    for chore_id in mint_unique_ids(args.count, existing):
        print(f"chore-{chore_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
