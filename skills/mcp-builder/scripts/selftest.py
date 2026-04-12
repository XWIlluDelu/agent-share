"""Offline smoke test for the MCP evaluation harness.

This validates the harness core loop without any external model API keys:
- uses a deterministic mock provider
- uses an in-memory MCP connection stub
- exercises evaluation parsing, tool-calling flow, scoring, and reporting
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Any

from evaluation import BaseProvider, run_evaluation


class SmokeProvider(BaseProvider):
    name = "mock"
    default_model = "offline-smoke"

    def generate(
        self, history: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> dict[str, Any]:
        if len(history) == 1:
            if not tools:
                raise RuntimeError("No MCP tools available for smoke test")
            tool_name = tools[0]["name"]
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "smoke-call-1",
                        "name": tool_name,
                        "input": {"a": 2, "b": 3},
                    }
                ],
            }

        tool_result = history[-1]["results"][0]["content"]
        match = re.search(r"\b(-?\d+)\b", tool_result)
        answer = match.group(1) if match else "NOT_FOUND"
        return {
            "content": (
                "<summary>Called the addition tool with a=2 and b=3, then read the "
                "returned value.</summary>"
                "<feedback>The tool name and arguments are clear enough for reliable "
                "tool use.</feedback>"
                f"<response>{answer}</response>"
            ),
            "tool_calls": [],
        }


class FakeConnection:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def __aenter__(self) -> "FakeConnection":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        return None

    async def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "add_numbers",
                "description": "Add two integers and return their sum.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "a": {"type": "integer"},
                        "b": {"type": "integer"},
                    },
                    "required": ["a", "b"],
                },
            }
        ]

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        self.calls.append((tool_name, arguments))
        if tool_name != "add_numbers":
            raise ValueError(f"Unexpected tool name: {tool_name}")
        return arguments["a"] + arguments["b"]


async def main() -> None:
    scripts_dir = Path(__file__).resolve().parent
    eval_file = scripts_dir / "smoke_evaluation.xml"
    provider = SmokeProvider()
    connection = FakeConnection()

    async with connection:
        report = await run_evaluation(eval_file, connection, provider)

    if "- **Accuracy**: 1/1 (100.0%)" not in report:
        raise SystemExit("Smoke test failed:\n\n" + report)
    if connection.calls != [("add_numbers", {"a": 2, "b": 3})]:
        raise SystemExit(f"Unexpected tool activity: {connection.calls}")

    print(report)


if __name__ == "__main__":
    asyncio.run(main())
