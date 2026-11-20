#!/usr/bin/env python3
"""Read-only registry/link audit; --sources also compares pinned Git trees.

Requires PyYAML. No fetching, normalization, generated files, or runtime changes.
A listed local diff still needs review against manifest notes.
"""

import argparse
import hashlib
import io
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

sys.dont_write_bytecode = True
_HERE = str(Path(__file__).resolve().parent)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML is required. Run with a Python environment containing PyYAML.")

from skill_validation import load_yaml, valid_skill_name, validate_skill_directory


def git(repo, *args):
    return subprocess.check_output(
        ["git", "--no-optional-locks", "-C", str(repo), *args],
        stderr=subprocess.PIPE, env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
    )


def fingerprint(kind, mode, data):
    return kind, bool(mode & 0o111), hashlib.sha256(data).hexdigest()


def local_paths(directory):
    """Do not follow directory links or include Python runtime caches."""
    for folder, dirs, names in os.walk(directory, followlinks=False):
        dirs[:] = [name for name in dirs if name != "__pycache__"]
        for name in dirs + names:
            path = Path(folder) / name
            if path.is_symlink() or (path.is_file() and path.suffix not in {".pyc", ".pyo"}):
                yield path


def source_tree(repo, commit, path):
    if git(repo, "cat-file", "-t", commit).strip() != b"commit":
        raise ValueError(f"{commit} is not a commit")
    tree = commit if path == "." else f"{commit}:{path}"
    files = {}
    # Inspect the archive in memory: no extraction or writes to sources/.
    with tarfile.open(fileobj=io.BytesIO(git(repo, "archive", tree))) as archive:
        for entry in archive:
            if entry.issym():
                files[entry.name] = fingerprint("link", 0, os.fsencode(entry.linkname))
            elif entry.isfile():
                files[entry.name] = fingerprint("file", entry.mode, archive.extractfile(entry).read())
            elif not entry.isdir():
                raise ValueError(f"Unsupported upstream entry: {entry.name}")
    if "SKILL.md" not in files or files["SKILL.md"][0] != "file":
        raise ValueError(f"No regular SKILL.md at {tree}")
    return files


def audit(root, sources=False, runtimes=()):
    errors, reviews = [], []

    def require(condition, message):
        if not condition:
            errors.append(message)
        return condition

    manifest = load_yaml((root / "manifest.yaml").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("Manifest must be a mapping")
    repos, skills = manifest.get("source_repos"), manifest.get("skills")
    if not isinstance(repos, dict) or not isinstance(skills, list):
        raise ValueError("Manifest needs source_repos mapping and skills list")
    for key, repo in repos.items():
        if not isinstance(key, str) or not re.fullmatch(r"[a-z0-9_][a-z0-9_-]*", key):
            raise ValueError(f"Invalid source repo name: {key!r}")
        if not isinstance(repo, dict):
            raise ValueError(f"{key}: source repo must be a mapping")
        if repo.get("type") == "custom":
            require(repo.get("path") == ".", f"{key}: custom source path must be '.'")
        else:
            if not isinstance(repo.get("url"), str) or not repo["url"].strip():
                raise ValueError(f"{key}: missing URL")

    names, always_on, checked_repos = set(), set(), set()
    for skill in skills:
        if not isinstance(skill, dict):
            raise ValueError("Each skill must be a mapping")
        name = skill.get("name")
        if not valid_skill_name(name):
            raise ValueError(f"Invalid skill name: {name!r}")
        require(name not in names, f"Duplicate skill name: {name}")
        names.add(name)
        require(isinstance(skill.get("pack"), str) and bool(skill["pack"].strip()), f"{name}: missing pack")
        if skill.get("pack") == "always-on":
            always_on.add(name)
        repo_key = skill.get("source_repo")
        if not isinstance(repo_key, str) or repo_key not in repos:
            errors.append(f"{name}: unknown source_repo {repo_key!r}")
            continue
        path = skill.get("source_path")
        if not isinstance(path, str) or not path or PurePosixPath(path).is_absolute() or ".." in PurePosixPath(path).parts or "\\" in path:
            errors.append(f"{name}: source_path must stay inside its source repository")
            continue
        custom = repos[repo_key].get("type") == "custom"
        if custom:
            require(path == f"lib/{name}", f"{name}: custom source_path must be lib/{name}")
            require("source_commit" not in skill, f"{name}: custom skill must not have source_commit")
        else:
            commit = skill.get("source_commit")
            if not require(isinstance(commit, str) and bool(re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", commit)), f"{name}: missing/invalid full source_commit"):
                continue
        directory = root / "lib" / name
        if not require(directory.is_dir() and not directory.is_symlink() and (directory / "SKILL.md").is_file() and not (directory / "SKILL.md").is_symlink(), f"{name}: missing canonical lib/{name}/SKILL.md (materialize source-backed skills first)"):
            continue
        for err in validate_skill_directory(directory):
            errors.append(f"{name}: {err}")
        compare_source = sources and not custom
        local = {}
        for entry in local_paths(directory):
            relative = entry.relative_to(directory).as_posix()
            require(".git" not in PurePosixPath(relative).parts, f"{name}/{relative}: repository internals in skill")
            if entry.is_symlink():
                target = os.readlink(entry)
                require(not os.path.isabs(target) and entry.exists() and entry.resolve().is_relative_to((root / "lib").resolve()), f"{name}/{relative}: broken, absolute, or library-escaping link")
                if compare_source:
                    local[relative] = fingerprint("link", 0, os.fsencode(target))
            elif compare_source:
                local[relative] = fingerprint("file", entry.stat().st_mode, entry.read_bytes())
        if compare_source:
            repo = root / "sources" / repo_key
            try:
                if repo_key not in checked_repos:
                    if Path(os.fsdecode(git(repo, "rev-parse", "--show-toplevel")).strip()).resolve() != repo.resolve():
                        raise ValueError("Not a source repository checkout")
                    checked_repos.add(repo_key)
                upstream = source_tree(repo, skill["source_commit"], path)
                differences = sorted(p for p in upstream.keys() | local.keys() if upstream.get(p) != local.get(p))
                if differences:
                    notes = skill.get("notes")
                    require(isinstance(notes, str) and bool(notes.strip()), f"{name}: local differences have no normalization notes")
                    reviews.append(f"{name}: {', '.join(differences)}")
            except (OSError, ValueError, subprocess.CalledProcessError, tarfile.TarError) as error:
                errors.append(f"{name}: cannot inspect pinned source: {error}")

    for entry in (root / "lib").iterdir():
        require(entry.name in names, f"Unregistered lib entry: {entry.name}")
    links = root / "skills"
    require(links.is_dir() and not links.is_symlink(), "skills/ must be the materialized directory")
    if links.is_dir():
        require({p.name for p in links.iterdir()} == always_on, "skills/ does not match pack: always-on")
    for name in sorted(always_on):
        link = links / name
        require(link.is_symlink() and os.readlink(link) == f"../lib/{name}" and link.is_dir(), f"skills/{name}: expected -> ../lib/{name}")
    fragments = root / "agents-fragments"
    require(fragments.is_dir(), "Missing agents-fragments/")
    if fragments.is_dir():
        for entry in fragments.iterdir():
            require(entry.is_file() and re.fullmatch(r"AGENT-.+\.md", entry.name), f"Unexpected fragment: {entry.name}")
    for runtime in runtimes:
        require(runtime.is_dir(), f"Runtime root missing: {runtime}")
        if runtime.is_symlink():
            require(not os.path.isabs(os.readlink(runtime)) and runtime.resolve() == links.resolve(), f"{runtime}: expected relative directory link to skills/")
        else:
            for name in sorted(always_on):
                link = runtime / name
                require(link.is_symlink() and not os.path.isabs(os.readlink(link)) and link.is_dir() and link.resolve() == (links / name).resolve(), f"{link}: expected relative skill link")
    return errors, reviews, len(skills)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--sources", action="store_true", help="compare source_commit trees in existing clones; no fetch")
    parser.add_argument("--runtime", action="append", type=Path, default=[], help="existing runtime root to check (repeatable)")
    args = parser.parse_args()
    try:
        errors, reviews, count = audit(args.root.expanduser().resolve(), args.sources, [p.expanduser() for p in args.runtime])
    except (OSError, ValueError, TypeError, yaml.YAMLError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    for review in reviews:
        print(f"DIFF (review against notes): {review}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"{'FAIL' if errors else 'PASS'}: {count} skills, {len(errors)} errors; "
          f"{'source comparisons included' if args.sources else 'source cache not checked'}")
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())
