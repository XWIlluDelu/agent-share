#!/usr/bin/env python3
"""Orchestrator for research-refine-pipeline.

This script does not try to impersonate the sibling skills. Instead it:
- inspects refine-logs/
- decides which stage is missing or stale
- writes PIPELINE_GATE.md
- writes/regenerates PIPELINE_SUMMARY.md from current artifacts
"""

from __future__ import annotations

import argparse
import re
from datetime import date
from pathlib import Path


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def extract_single_line(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.MULTILINE)
        if match:
            return match.group(1).strip()
    return "UNKNOWN"


def extract_bullets_after_heading(text: str, heading: str, limit: int = 3) -> list[str]:
    lines = text.splitlines()
    found = False
    bullets: list[str] = []
    for line in lines:
        if not found:
            if line.strip().lower() == heading.strip().lower():
                found = True
            continue

        if line.startswith("## ") and bullets:
            break
        stripped = line.strip()
        if stripped.startswith(("- ", "* ")):
            bullets.append(stripped[2:].strip())
            if len(bullets) >= limit:
                break
    return bullets


def extract_claims(plan_text: str, proposal_text: str) -> list[str]:
    claims = extract_bullets_after_heading(plan_text, "## Validation Targets", limit=3)
    if claims:
        return claims

    matches = re.findall(r"^- Claim \d+:\s*(.+)$", plan_text, re.MULTILINE)
    if matches:
        return [m.strip() for m in matches[:3]]

    claims = extract_bullets_after_heading(proposal_text, "## Experiment Handoff Inputs", limit=3)
    return claims or ["UNKNOWN"]


def extract_first_runs(plan_text: str) -> list[str]:
    runs = []
    for match in re.finditer(r"^### Run \d+:\s*(.+)$", plan_text, re.MULTILINE):
        runs.append(match.group(1).strip())
        if len(runs) >= 3:
            return runs

    capture = False
    for line in plan_text.splitlines():
        if not capture:
            if line.strip().lower() == "## run order":
                capture = True
            continue
        if line.startswith("## ") and runs:
            break
        if line.strip().startswith("|") and not line.strip().startswith("| Run |"):
            parts = [part.strip() for part in line.strip().strip("|").split("|")]
            if len(parts) >= 2 and parts[0].isdigit():
                runs.append(parts[1])
                if len(runs) >= 3:
                    break
    return runs or ["UNKNOWN"]


def extract_risks(plan_text: str, review_text: str) -> list[str]:
    risks = []
    capture = False
    for line in plan_text.splitlines():
        if not capture:
            if line.strip().lower() == "## risk register":
                capture = True
            continue
        if line.startswith("## ") and risks:
            break
        if line.strip().startswith("|") and not line.strip().startswith("| Risk |"):
            parts = [part.strip() for part in line.strip().strip("|").split("|")]
            if len(parts) >= 1 and parts[0] and not set(parts[0]) <= {"-"}:
                risks.append(parts[0])
                if len(risks) >= 3:
                    break
    if risks:
        return risks

    summary_risks = extract_bullets_after_heading(review_text, "## Remaining Risks", limit=3)
    return summary_risks or ["UNKNOWN"]


def write_gate(
    workspace: Path,
    have_proposal: bool,
    have_experiment_plan: bool,
    problem: str,
    thesis: str,
    contribution: str,
) -> str:
    if not have_proposal:
        next_stage = "RUN_RESEARCH_REFINE"
        reason = "FINAL_PROPOSAL.md is missing, so the method thesis is not yet stabilized."
    elif not have_experiment_plan:
        next_stage = "RUN_EXPERIMENT_PLAN"
        reason = "Method artifacts exist, but EXPERIMENT_PLAN.md is missing."
    else:
        next_stage = "PIPELINE_READY"
        reason = "Both method and experiment artifacts exist."

    content = f"""# Pipeline Gate

**Date**: {date.today().isoformat()}
**Problem**: {problem}
**Method Thesis**: {thesis}
**Dominant Contribution**: {contribution}

## Stage Check
- Has final proposal: {"yes" if have_proposal else "no"}
- Has experiment plan: {"yes" if have_experiment_plan else "no"}

## Decision
- Next stage: {next_stage}
- Reason: {reason}
"""
    (workspace / "PIPELINE_GATE.md").write_text(content, encoding="utf-8")
    return next_stage


def write_summary(
    workspace: Path,
    problem: str,
    thesis: str,
    verdict: str,
    contribution: str,
    supporting: str,
    rejected_complexity: str,
    claims: list[str],
    first_runs: list[str],
    risks: list[str],
) -> None:
    content = f"""# Pipeline Summary

**Problem**: {problem}
**Final Method Thesis**: {thesis}
**Final Verdict**: {verdict}
**Date**: {date.today().isoformat()}

## Final Deliverables
- Proposal: `refine-logs/FINAL_PROPOSAL.md`
- Review summary: `refine-logs/REVIEW_SUMMARY.md`
- Experiment plan: `refine-logs/EXPERIMENT_PLAN.md`
- Experiment tracker: `refine-logs/EXPERIMENT_TRACKER.md`

## Contribution Snapshot
- Dominant contribution: {contribution}
- Optional supporting contribution: {supporting}
- Explicitly rejected complexity: {rejected_complexity}

## Must-Prove Claims
- {claims[0] if len(claims) > 0 else "UNKNOWN"}
- {claims[1] if len(claims) > 1 else "UNKNOWN"}

## First Runs to Launch
1. {first_runs[0] if len(first_runs) > 0 else "UNKNOWN"}
2. {first_runs[1] if len(first_runs) > 1 else "UNKNOWN"}
3. {first_runs[2] if len(first_runs) > 2 else "UNKNOWN"}

## Main Risks
- {risks[0] if len(risks) > 0 else "UNKNOWN"}
- {risks[1] if len(risks) > 1 else "UNKNOWN"}

## Next Action
- Proceed to `/run-experiment`
"""
    (workspace / "PIPELINE_SUMMARY.md").write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect refine-logs and regenerate pipeline gate/summary")
    parser.add_argument("--workspace", default="refine-logs", help="Pipeline workspace directory")
    parser.add_argument("--problem", default=None, help="Optional explicit problem override")
    args = parser.parse_args()

    workspace = Path(args.workspace).resolve()
    workspace.mkdir(parents=True, exist_ok=True)

    proposal_path = workspace / "FINAL_PROPOSAL.md"
    review_path = workspace / "REVIEW_SUMMARY.md"
    report_path = workspace / "REFINEMENT_REPORT.md"
    plan_path = workspace / "EXPERIMENT_PLAN.md"

    proposal_text = read_text(proposal_path)
    review_text = read_text(review_path)
    report_text = read_text(report_path)
    plan_text = read_text(plan_path)

    problem = args.problem or extract_single_line(
        review_text,
        [r"^\*\*Problem\*\*:\s*(.+)$", r"^- Bottom-line problem:\s*(.+)$"],
    )
    thesis = extract_single_line(
        proposal_text,
        [r"^- One-sentence thesis:\s*(.+)$", r"^\*\*Method Thesis\*\*:\s*(.+)$"],
    )
    contribution = extract_single_line(
        proposal_text,
        [r"^- Dominant contribution:\s*(.+)$"],
    )
    supporting = extract_single_line(
        proposal_text,
        [r"^- Optional supporting contribution:\s*(.+)$", r"^- Supporting contribution:\s*(.+)$"],
    )
    rejected_complexity = extract_single_line(
        proposal_text,
        [r"^- Explicit non-contributions:\s*(.+)$", r"^- Tempting additions intentionally not used:\s*(.+)$"],
    )
    verdict = extract_single_line(review_text or report_text, [r"^\*\*Final Verdict\*\*:\s*(.+)$"])

    claims = extract_claims(plan_text, proposal_text)
    first_runs = extract_first_runs(plan_text)
    risks = extract_risks(plan_text, review_text)

    write_gate(
        workspace=workspace,
        have_proposal=proposal_path.exists(),
        have_experiment_plan=plan_path.exists(),
        problem=problem,
        thesis=thesis,
        contribution=contribution,
    )
    write_summary(
        workspace=workspace,
        problem=problem,
        thesis=thesis,
        verdict=verdict,
        contribution=contribution,
        supporting=supporting,
        rejected_complexity=rejected_complexity,
        claims=claims,
        first_runs=first_runs,
        risks=risks,
    )


if __name__ == "__main__":
    main()
