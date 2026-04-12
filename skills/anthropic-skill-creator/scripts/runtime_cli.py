#!/usr/bin/env python3
"""Helpers for calling different agent CLIs in non-interactive mode."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


SUPPORTED_RUNTIMES = ("claude", "codex", "gemini")


def detect_runtime(runtime: str) -> str:
    if runtime != "auto":
        return runtime
    for candidate in SUPPORTED_RUNTIMES:
        if shutil.which(candidate):
            return candidate
    raise RuntimeError("No supported agent CLI found. Expected one of: claude, codex, gemini.")


def sanitize_env() -> dict[str, str]:
    env = dict(os.environ)
    env.pop("CLAUDECODE", None)
    return env


def run_text_prompt(
    prompt: str,
    runtime: str = "auto",
    model: str | None = None,
    cwd: str | Path | None = None,
    timeout: int = 300,
) -> str:
    runtime = detect_runtime(runtime)
    workdir = Path(cwd or os.getcwd())
    env = sanitize_env()

    if runtime == "claude":
        cmd = ["claude", "-p", "--output-format", "text"]
        if model:
            cmd.extend(["--model", model])
        result = subprocess.run(
            cmd,
            input=prompt,
            capture_output=True,
            text=True,
            env=env,
            cwd=workdir,
            timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(f"claude -p exited {result.returncode}\nstderr: {result.stderr}")
        return result.stdout

    if runtime == "codex":
        with tempfile.NamedTemporaryFile("r+", suffix=".txt", delete=False) as handle:
            output_path = Path(handle.name)
        try:
            cmd = [
                "codex",
                "exec",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "-C",
                str(workdir),
                "-o",
                str(output_path),
                prompt,
            ]
            if model:
                cmd[2:2] = ["--model", model]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                cwd=workdir,
                timeout=timeout,
            )
            if result.returncode != 0:
                raise RuntimeError(f"codex exec exited {result.returncode}\nstderr: {result.stderr}")
            return output_path.read_text()
        finally:
            output_path.unlink(missing_ok=True)

    if runtime == "gemini":
        cmd = [
            "gemini",
            "-p",
            prompt,
            "--output-format",
            "json",
            "--sandbox",
            "--approval-mode",
            "yolo",
        ]
        if model:
            cmd.extend(["--model", model])
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
            cwd=workdir,
            timeout=timeout,
        )
        if result.returncode != 0:
            raise RuntimeError(f"gemini -p exited {result.returncode}\nstderr: {result.stderr}")
        data = json.loads(result.stdout)
        return data.get("response", "")

    raise RuntimeError(f"Unsupported runtime: {runtime}")
