#!/usr/bin/env python3
"""Atomically allocate a new challenge report filename.

Usage:
    allocate_challenge_report.py [--dir docs/challenge] [--date YYMMDD]

Output:
    Prints the absolute or relative path to a fresh, unused filename of the form
    docs/challenge/<YYMMDD>_<NN>_<rand>.md to stdout.

Behavior:
    - Computes today's YYMMDD (UTC) unless --date is given.
    - Scans the target directory for existing files matching the day's prefix.
    - Picks NN = max(existing_NN)+1, or 01 if none.
    - Generates a 4-char base32 random suffix.
    - Creates the empty file with O_EXCL semantics so concurrent invocations
      cannot collide.

Concurrency model:
    The rand suffix defeats races even between two processes that both observed
    NN=05 at the same moment: they'll mint different rand values and the
    O_EXCL open of the second one will succeed (different filename) without
    collision.
"""

import argparse
import datetime as dt
import os
import re
import secrets
import sys
from pathlib import Path

BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"
RAND_LENGTH = 4
FILENAME_PATTERN = re.compile(r"^(\d{6})_(\d{2})_([a-z2-7]{4})\.md$")


def today_yymmdd() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%y%m%d")


def mint_rand() -> str:
    raw = int.from_bytes(secrets.token_bytes(4), "big")
    chars = []
    for _ in range(RAND_LENGTH):
        chars.append(BASE32_ALPHABET[raw & 0x1F])
        raw >>= 5
    return "".join(chars)


def next_nn_for_date(directory: Path, date_prefix: str) -> int:
    if not directory.exists():
        return 1
    highest = 0
    for entry in directory.iterdir():
        m = FILENAME_PATTERN.match(entry.name)
        if not m:
            continue
        if m.group(1) != date_prefix:
            continue
        nn = int(m.group(2))
        if nn > highest:
            highest = nn
    return highest + 1


def allocate(directory: Path, date_prefix: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    # Loop just in case rand collides with an existing file at the same NN
    # (probability ~2^-20 per attempt; loop terminates trivially).
    while True:
        nn = next_nn_for_date(directory, date_prefix)
        rand = mint_rand()
        candidate = directory / f"{date_prefix}_{nn:02d}_{rand}.md"
        try:
            # O_EXCL guarantees we don't clobber a concurrent allocator.
            fd = os.open(candidate, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
            os.close(fd)
            return candidate
        except FileExistsError:
            continue


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dir", type=Path, default=Path("docs/challenge"))
    parser.add_argument("--date", type=str, default=None,
                        help="YYMMDD; default = today UTC")
    args = parser.parse_args()

    date_prefix = args.date or today_yymmdd()
    if not re.fullmatch(r"\d{6}", date_prefix):
        print(f"error: --date must be six digits YYMMDD, got {date_prefix!r}",
              file=sys.stderr)
        return 2

    path = allocate(args.dir, date_prefix)
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
