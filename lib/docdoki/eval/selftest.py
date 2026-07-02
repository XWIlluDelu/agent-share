#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL = ROOT / "eval"
CASES = EVAL / "cases.json"
EXPECTED_PROTOCOLS = {"init", "adopt", "ask", "follow", "challenge", "groom", "handoff"}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def ok(name: str) -> None:
    print(name)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001 - eval failure should print the bad file.
        fail(f"{path.relative_to(ROOT)} is not valid JSON: {exc}")


def assert_list(value: object, path: str) -> list:
    if not isinstance(value, list) or not value:
        fail(f"{path} must be a non-empty list")
    return value


def assert_file(path: Path, label: str) -> None:
    if not path.is_file():
        fail(f"missing {label}: {path.relative_to(ROOT)}")


def read_covers(spec: Path) -> list[str]:
    text = spec.read_text(encoding="utf-8")
    match = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not match:
        fail(f"{spec.relative_to(ROOT)} has no frontmatter")
    covers: list[str] = []
    in_covers = False
    for raw in match.group(1).splitlines():
        line = raw.rstrip()
        if line.startswith("covers:"):
            in_covers = True
            continue
        if in_covers:
            item = re.match(r"\s*-\s+(.+?)\s*$", line)
            if item:
                covers.append(item.group(1))
                continue
            if line and not line.startswith(" "):
                break
    if not covers:
        fail(f"{spec.relative_to(ROOT)} has no covers globs")
    return covers


def test_manifest_shape() -> None:
    data = load_json(CASES)
    if data.get("version") != 1:
        fail("cases.json version must be 1")
    positives = assert_list(data.get("positive_cases"), "positive_cases")
    negatives = assert_list(data.get("negative_cases"), "negative_cases")

    protocols = {case.get("protocol") for case in positives}
    missing = EXPECTED_PROTOCOLS - protocols
    extra = protocols - EXPECTED_PROTOCOLS
    if missing or extra:
        fail(f"protocol coverage mismatch: missing={sorted(missing)} extra={sorted(extra)}")

    ids: set[str] = set()
    for group, cases in (("positive", positives), ("negative", negatives)):
        for case in cases:
            case_id = case.get("id")
            if not isinstance(case_id, str) or not case_id:
                fail(f"{group} case missing id")
            if case_id in ids:
                fail(f"duplicate case id: {case_id}")
            ids.add(case_id)
            if not isinstance(case.get("prompt"), str) or not case["prompt"].strip():
                fail(f"{case_id} has no prompt")
            if group == "positive":
                if case.get("mode") not in {"read", "review", "write"}:
                    fail(f"{case_id} has invalid mode")
                checks = assert_list(case.get("checks"), f"{case_id}.checks")
                if any(not isinstance(check, str) or not check.strip() for check in checks):
                    fail(f"{case_id} has an empty check")
                for rel in assert_list(case.get("must_read"), f"{case_id}.must_read"):
                    assert_file(ROOT / rel, f"must_read for {case_id}")
            else:
                if case.get("should_use_skill") is not False:
                    fail(f"{case_id} must be a negative routing case")
                if not isinstance(case.get("reason"), str) or not case["reason"].strip():
                    fail(f"{case_id} missing reason")
    ok("manifest shape")


def test_fixture_links() -> None:
    data = load_json(CASES)
    for case in data["positive_cases"]:
        fixture = case.get("fixture")
        golden = case.get("golden")
        if bool(fixture) != bool(golden):
            fail(f"{case['id']} must define fixture and golden together")
        if fixture:
            fixture_path = EVAL / fixture
            golden_path = EVAL / golden
            if not fixture_path.is_dir():
                fail(f"missing fixture for {case['id']}: {fixture}")
            assert_file(golden_path, f"golden for {case['id']}")
    ok("fixture links")


def test_challenge_auth_expiry_fixture() -> None:
    project = EVAL / "fixtures/challenge-auth-expiry/project"
    spec = project / "docdoki/specs/auth.md"
    code = project / "src/auth.py"
    golden = load_json(EVAL / "golden/challenge-auth-expiry.json")

    assert_file(spec, "auth spec fixture")
    assert_file(code, "auth code fixture")
    spec_text = spec.read_text(encoding="utf-8")
    code_text = code.read_text(encoding="utf-8")

    for pattern in read_covers(spec):
        matches = list(project.glob(pattern))
        if not matches:
            fail(f"covers glob has no matches: {pattern}")

    finding = golden["expected_findings"][0]
    if finding["claim"] not in spec_text:
        fail("golden claim is not present in auth spec")
    if finding["evidence"] not in code_text:
        fail("golden evidence is not present in auth code")
    if "15 minutes" not in spec_text or "TOKEN_TTL_MINUTES = 30" not in code_text:
        fail("auth fixture no longer encodes the intended expiry drift")
    ok("challenge fixture encodes drift")


def test_challenge_rides_along_golden() -> None:
    golden = load_json(EVAL / "golden/challenge-rides-along.json")
    finding = golden["expected_findings"][0]
    spec_text = (EVAL / "fixtures/challenge-auth-expiry/project/docdoki/specs/auth.md").read_text(encoding="utf-8")
    code_text = (EVAL / "fixtures/challenge-auth-expiry/project/src/auth.py").read_text(encoding="utf-8")
    if finding["claim_before"] not in spec_text:
        fail("rides-along golden claim_before not present in auth spec fixture")
    if "TOKEN_TTL_MINUTES = 30" not in code_text:
        fail("auth fixture must start at 30 minutes for the rides-along edit to make sense")
    if finding["code_after"] != "TOKEN_TTL_MINUTES = 60":
        fail("rides-along golden must expect the 60-minute edit")
    ok("rides-along golden links to fixture")


def test_groom_stage_noise_fixture() -> None:
    project = EVAL / "fixtures/groom-stage-noise/project"
    stage = project / "docdoki/stages/handoff-panel-polish-2026-06-27.md"
    note = project / "docdoki/notes/panel.md"
    golden = load_json(EVAL / "golden/groom-stage-noise.json")

    assert_file(stage, "groom stage fixture")
    assert_file(note, "groom note fixture")
    stage_text = stage.read_text(encoding="utf-8")
    note_text = note.read_text(encoding="utf-8")

    required_stage_fragments = [
        "09:12 tried a blue footer tint",
        "user wondered about purple",
        "❌ Persist drag positions in spec frontmatter",
        "panel-owned project facts",
    ]
    for fragment in required_stage_fragments:
        if fragment not in stage_text:
            fail(f"groom fixture missing stage fragment: {fragment}")
    if "presentational" not in note_text:
        fail("groom fixture note no longer carries the panel-state lesson")

    decisions = golden.get("expected_decisions")
    if not isinstance(decisions, list) or len(decisions) != 3:
        fail("groom golden must describe the three intended grooming decisions")
    for decision in decisions:
        if decision.get("evidence") not in stage_text:
            fail(f"groom golden evidence not present in stage: {decision.get('id')}")
    ok("groom fixture encodes noise boundary")


def test_skill_routing_boundaries() -> None:
    routing_text = (
        (ROOT / "SKILL.md").read_text(encoding="utf-8")
        + "\n"
        + (ROOT / "references/operations.md").read_text(encoding="utf-8")
    )
    required = [
        "one-off writing outside this library",
        "ordinary docs/ folder",
        "Pure code questions that do not touch the documentation library",
        "compact",
        "wrap up",
        "handoff",
    ]
    for text in required:
        if text not in routing_text:
            fail(f"skill routing docs missing boundary text: {text}")
    ok("routing boundaries")


def main() -> None:
    test_manifest_shape()
    test_fixture_links()
    test_challenge_auth_expiry_fixture()
    test_challenge_rides_along_golden()
    test_groom_stage_noise_fixture()
    test_skill_routing_boundaries()
    print("\n6 passed, 0 failed")


if __name__ == "__main__":
    main()
