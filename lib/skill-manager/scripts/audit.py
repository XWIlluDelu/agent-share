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
try:
    import yaml
except ImportError:
    raise SystemExit("PyYAML is required. Run with a Python environment containing PyYAML.")


# Extend the basic checker in its own process; keep the bundled files intact.
# Pi and Claude Code both honor this explicit-invocation control.
VALIDATOR_ADAPTER = """\
import sys
sys.path.insert(0, sys.argv[1])
import quick_validate
quick_validate.ALLOWED_PROPERTIES.add("disable-model-invocation")
valid, message = quick_validate.validate_skill(sys.argv[2])
print(message)
sys.exit(not valid)
"""


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently losing registry entries."""

    def construct_mapping(self, node, deep=False):
        keys = [self.construct_object(key, deep=deep) for key, _ in node.value]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate YAML mapping key")
        return super().construct_mapping(node, deep=deep)


def load_yaml(text):
    return yaml.load(text, Loader=UniqueLoader)


def git(repo, *args):
    return subprocess.check_output(
        ["git", "--no-optional-locks", "-C", str(repo), *args],
        stderr=subprocess.PIPE, env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
    )


def fingerprint(kind, mode, data):
    return kind, bool(mode & 0o111), hashlib.sha256(data).hexdigest()


def local_tree(directory):
    """Do not follow directory links or include Python runtime caches."""
    files = {}
    for folder, dirs, names in os.walk(directory, followlinks=False):
        dirs[:] = [name for name in dirs if name != "__pycache__"]
        for name in dirs + names:
            path = Path(folder) / name
            relative = path.relative_to(directory).as_posix()
            if path.is_symlink():
                files[relative] = fingerprint("link", 0, os.fsencode(os.readlink(path)))
            elif path.is_file() and path.suffix not in {".pyc", ".pyo"}:
                files[relative] = fingerprint("file", path.stat().st_mode, path.read_bytes())
    return files


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
    validator = root / "lib/openai-skill-creator/scripts/quick_validate.py"
    require(validator.is_file(), "Missing bundled quick_validate.py")
    for skill in skills:
        if not isinstance(skill, dict):
            raise ValueError("Each skill must be a mapping")
        name = skill.get("name")
        if not isinstance(name, str) or len(name) > 64 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
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
        text = (directory / "SKILL.md").read_text(encoding="utf-8")
        match = re.match(r"\A---\n(.*?)\n---(?:\n|$)", text, re.DOTALL)
        metadata = load_yaml(match[1]) if match else None
        if isinstance(metadata, dict):
            require(metadata.get("name") == name, f"{name}: frontmatter name mismatch")
            description = metadata.get("description")
            require(isinstance(description, str) and bool(description.strip()), f"{name}: empty/non-string description")
            if "disable-model-invocation" in metadata:
                require(type(metadata["disable-model-invocation"]) is bool, f"{name}: disable-model-invocation must be a boolean")
        else:
            errors.append(f"{name}: invalid frontmatter")
        if validator.is_file():
            result = subprocess.run(
                [sys.executable, "-B", "-c", VALIDATOR_ADAPTER, str(validator.parent), str(directory)],
                capture_output=True, text=True,
            )
            require(result.returncode == 0, f"{name}: {(result.stdout + result.stderr).strip()}")
        local = local_tree(directory)
        for relative, info in local.items():
            require(".git" not in PurePosixPath(relative).parts, f"{name}/{relative}: repository internals in skill")
            if info[0] == "link":
                link = directory / relative
                require(not os.path.isabs(os.readlink(link)) and link.exists() and link.resolve().is_relative_to((root / "lib").resolve()), f"{name}/{relative}: broken, absolute, or library-escaping link")
        if sources and not custom:
            repo = root / "sources" / repo_key
            try:
                if repo_key not in checked_repos:
                    if Path(os.fsdecode(git(repo, "rev-parse", "--show-toplevel")).strip()).resolve() != repo.resolve():
                        raise ValueError("Not a source repository checkout")
                    require(not git(repo, "status", "--porcelain").strip(), f"{repo_key}: source checkout is dirty")
                    remote = os.fsdecode(git(repo, "remote", "get-url", "origin")).strip().rstrip("/").removesuffix(".git")
                    expected = repos[repo_key].get("url", "").rstrip("/").removesuffix(".git")
                    require(remote == expected, f"{repo_key}: origin differs from manifest URL")
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
