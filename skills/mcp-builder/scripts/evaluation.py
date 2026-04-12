"""MCP Server Evaluation Harness

This script evaluates MCP servers by running test questions against them using
tool-calling models from Anthropic, OpenAI-compatible APIs, or Gemini.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Optional

from connections import create_connection

ANTHROPIC_DEFAULT_MODEL = "claude-3-7-sonnet-20250219"
OPENAI_DEFAULT_MODEL = "gpt-5.4"
GEMINI_DEFAULT_MODEL = "gemini-2.5-pro"

EVALUATION_PROMPT = """You are an AI assistant with access to tools.

When given a task, you MUST:
1. Use the available tools to complete the task
2. Provide summary of each step in your approach, wrapped in <summary> tags
3. Provide feedback on the tools provided, wrapped in <feedback> tags
4. Provide your final response, wrapped in <response> tags

Summary Requirements:
- In your <summary> tags, you must explain:
  - The steps you took to complete the task
  - Which tools you used, in what order, and why
  - The inputs you provided to each tool
  - The outputs you received from each tool
  - A summary for how you arrived at the response

Feedback Requirements:
- In your <feedback> tags, provide constructive feedback on the tools:
  - Comment on tool names: Are they clear and descriptive?
  - Comment on input parameters: Are they well-documented? Are required vs optional parameters clear?
  - Comment on descriptions: Do they accurately describe what the tool does?
  - Comment on any errors encountered during tool usage: Did the tool fail to execute? Did the tool return too many tokens?
  - Identify specific areas for improvement and explain WHY they would help
  - Be specific and actionable in your suggestions

Response Requirements:
- Your response should be concise and directly address what was asked
- Always wrap your final response in <response> tags
- If you cannot solve the task return <response>NOT_FOUND</response>
- For numeric responses, provide just the number
- For IDs, provide just the ID
- For names or text, provide the exact text requested
- Your response should go last"""


def http_post_json(url: str, headers: dict[str, str], payload: dict[str, Any], timeout: int = 180) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(str(exc)) from exc


def ensure_object_schema(schema: Optional[dict[str, Any]]) -> dict[str, Any]:
    if not isinstance(schema, dict):
        return {"type": "object", "properties": {}}
    if "type" not in schema:
        return {"type": "object", **schema}
    return schema


def parse_evaluation_file(file_path: Path) -> list[dict[str, Any]]:
    """Parse XML evaluation file with qa_pair elements."""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        evaluations = []

        for qa_pair in root.findall(".//qa_pair"):
            question_elem = qa_pair.find("question")
            answer_elem = qa_pair.find("answer")

            if question_elem is not None and answer_elem is not None:
                evaluations.append(
                    {
                        "question": (question_elem.text or "").strip(),
                        "answer": (answer_elem.text or "").strip(),
                    }
                )

        return evaluations
    except Exception as exc:
        print(f"Error parsing evaluation file {file_path}: {exc}")
        return []


def extract_xml_content(text: Optional[str], tag: str) -> Optional[str]:
    """Extract content from XML tags."""
    if not text:
        return None
    pattern = rf"<{tag}>(.*?)</{tag}>"
    matches = re.findall(pattern, text, re.DOTALL)
    return matches[-1].strip() if matches else None


def parse_json_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


class BaseProvider:
    name = "base"
    default_model = ""

    def __init__(self, model: Optional[str] = None):
        self.model = model or self.default_model

    def generate(self, history: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
        raise NotImplementedError


class AnthropicProvider(BaseProvider):
    name = "anthropic"
    default_model = ANTHROPIC_DEFAULT_MODEL

    def __init__(self, model: Optional[str] = None):
        super().__init__(model)
        self.api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        self.base_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1").rstrip("/")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for provider=anthropic")

    def _convert_tools(self, tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "name": tool["name"],
                "description": tool.get("description") or "",
                "input_schema": ensure_object_schema(tool.get("input_schema")),
            }
            for tool in tools
        ]

    def _convert_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        for item in history:
            role = item["role"]
            if role == "user":
                messages.append({"role": "user", "content": item["content"]})
            elif role == "assistant":
                content_blocks = []
                if item.get("content"):
                    content_blocks.append({"type": "text", "text": item["content"]})
                for call in item.get("tool_calls", []):
                    content_blocks.append(
                        {
                            "type": "tool_use",
                            "id": call["id"],
                            "name": call["name"],
                            "input": call["input"],
                        }
                    )
                messages.append({"role": "assistant", "content": content_blocks})
            elif role == "tool_results":
                result_blocks = []
                for result in item["results"]:
                    result_blocks.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": result["tool_call_id"],
                            "content": result["content"],
                        }
                    )
                messages.append({"role": "user", "content": result_blocks})
        return messages

    def generate(self, history: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "system": EVALUATION_PROMPT,
            "messages": self._convert_history(history),
            "tools": self._convert_tools(tools),
        }
        data = http_post_json(
            f"{self.base_url}/messages",
            {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            },
            payload,
        )
        content = data.get("content", [])
        text = "\n".join(block.get("text", "") for block in content if block.get("type") == "text").strip()
        tool_calls = [
            {"id": block["id"], "name": block["name"], "input": block.get("input", {})}
            for block in content
            if block.get("type") == "tool_use"
        ]
        return {"content": text, "tool_calls": tool_calls}


class OpenAIProvider(BaseProvider):
    name = "openai"
    default_model = OPENAI_DEFAULT_MODEL

    def __init__(self, model: Optional[str] = None):
        super().__init__(model)
        self.api_key = os.environ.get("OPENAI_API_KEY", "")
        self.base_url = (
            os.environ.get("OPENAI_BASE_URL")
            or os.environ.get("OPENAI_API_BASE")
            or "https://api.openai.com/v1"
        ).rstrip("/")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required for provider=openai")

    def _convert_tools(self, tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description") or "",
                    "parameters": ensure_object_schema(tool.get("input_schema")),
                },
            }
            for tool in tools
        ]

    def _convert_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [{"role": "system", "content": EVALUATION_PROMPT}]
        for item in history:
            role = item["role"]
            if role == "user":
                messages.append({"role": "user", "content": item["content"]})
            elif role == "assistant":
                message = {"role": "assistant", "content": item.get("content", "") or ""}
                if item.get("tool_calls"):
                    message["tool_calls"] = [
                        {
                            "id": call["id"],
                            "type": "function",
                            "function": {
                                "name": call["name"],
                                "arguments": json.dumps(call["input"], ensure_ascii=False),
                            },
                        }
                        for call in item["tool_calls"]
                    ]
                messages.append(message)
            elif role == "tool_results":
                for result in item["results"]:
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": result["tool_call_id"],
                            "content": result["content"],
                        }
                    )
        return messages

    def generate(self, history: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "messages": self._convert_history(history),
            "tools": self._convert_tools(tools),
            "tool_choice": "auto",
        }
        data = http_post_json(
            f"{self.base_url}/chat/completions",
            {"Authorization": f"Bearer {self.api_key}"},
            payload,
        )
        message = data["choices"][0]["message"]
        tool_calls = [
            {
                "id": call["id"],
                "name": call["function"]["name"],
                "input": parse_json_args(call["function"].get("arguments")),
            }
            for call in message.get("tool_calls", []) or []
        ]
        return {"content": message.get("content") or "", "tool_calls": tool_calls}


class GeminiProvider(BaseProvider):
    name = "gemini"
    default_model = GEMINI_DEFAULT_MODEL

    def __init__(self, model: Optional[str] = None):
        super().__init__(model)
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
        self.base_url = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is required for provider=gemini")

    def _convert_tools(self, tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "functionDeclarations": [
                    {
                        "name": tool["name"],
                        "description": tool.get("description") or "",
                        "parameters": ensure_object_schema(tool.get("input_schema")),
                    }
                ]
            }
            for tool in tools
        ]

    def _convert_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        contents: list[dict[str, Any]] = []
        for item in history:
            role = item["role"]
            if role == "user":
                contents.append({"role": "user", "parts": [{"text": item["content"]}]})
            elif role == "assistant":
                parts = []
                if item.get("content"):
                    parts.append({"text": item["content"]})
                for call in item.get("tool_calls", []):
                    parts.append({"functionCall": {"name": call["name"], "args": call["input"]}})
                contents.append({"role": "model", "parts": parts})
            elif role == "tool_results":
                parts = []
                for result in item["results"]:
                    parts.append(
                        {
                            "functionResponse": {
                                "name": result["name"],
                                "response": {"content": result["content"]},
                            }
                        }
                    )
                contents.append({"role": "user", "parts": parts})
        return contents

    def generate(self, history: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
        encoded_model = urllib.parse.quote(self.model, safe="-_.")
        payload = {
            "systemInstruction": {"parts": [{"text": EVALUATION_PROMPT}]},
            "contents": self._convert_history(history),
            "tools": self._convert_tools(tools),
        }
        data = http_post_json(
            f"{self.base_url}/models/{encoded_model}:generateContent?key={urllib.parse.quote(self.api_key, safe='')}",
            {},
            payload,
        )
        parts = data["candidates"][0]["content"].get("parts", [])
        text = "\n".join(part.get("text", "") for part in parts if "text" in part).strip()
        tool_calls = [
            {
                "id": f"gemini-call-{idx}",
                "name": part["functionCall"]["name"],
                "input": part["functionCall"].get("args", {}) or {},
            }
            for idx, part in enumerate(parts)
            if "functionCall" in part
        ]
        return {"content": text, "tool_calls": tool_calls}


def make_provider(provider_name: str, model: Optional[str]) -> BaseProvider:
    if provider_name == "anthropic":
        return AnthropicProvider(model)
    if provider_name == "openai":
        return OpenAIProvider(model)
    if provider_name == "gemini":
        return GeminiProvider(model)
    raise ValueError(f"Unsupported provider: {provider_name}")


def detect_provider(requested: str, model: Optional[str]) -> BaseProvider:
    if requested != "auto":
        return make_provider(requested, model)

    last_error = None
    for candidate in ("anthropic", "openai", "gemini"):
        try:
            return make_provider(candidate, model)
        except ValueError as exc:
            last_error = exc
    raise ValueError(
        "Could not auto-detect a provider. Set provider-specific credentials for "
        "Anthropic, OpenAI, or Gemini."
    ) from last_error


async def agent_loop(
    provider: BaseProvider,
    question: str,
    tools: list[dict[str, Any]],
    connection: Any,
    max_rounds: int = 12,
) -> tuple[str, dict[str, Any]]:
    """Run a tool-calling agent loop with the selected provider."""
    history: list[dict[str, Any]] = [{"role": "user", "content": question}]
    tool_metrics: dict[str, dict[str, Any]] = {}

    for _ in range(max_rounds):
        # Keep provider calls synchronous here. The harness is intentionally
        # sequential, and some runtimes have shown unstable behavior with
        # asyncio.to_thread() for short-lived provider calls.
        response = provider.generate(history, tools)
        history.append(
            {
                "role": "assistant",
                "content": response.get("content", ""),
                "tool_calls": response.get("tool_calls", []),
            }
        )

        tool_calls = response.get("tool_calls", [])
        if not tool_calls:
            return response.get("content", ""), tool_metrics

        results = []
        for call in tool_calls:
            tool_name = call["name"]
            tool_input = call.get("input", {}) or {}
            tool_start_ts = time.time()
            try:
                tool_result = await connection.call_tool(tool_name, tool_input)
                tool_response = (
                    json.dumps(tool_result, ensure_ascii=False)
                    if isinstance(tool_result, (dict, list))
                    else str(tool_result)
                )
            except Exception as exc:
                tool_response = f"Error executing tool {tool_name}: {exc}\n{traceback.format_exc()}"
            tool_duration = time.time() - tool_start_ts

            if tool_name not in tool_metrics:
                tool_metrics[tool_name] = {"count": 0, "durations": []}
            tool_metrics[tool_name]["count"] += 1
            tool_metrics[tool_name]["durations"].append(tool_duration)

            results.append(
                {
                    "tool_call_id": call["id"],
                    "name": tool_name,
                    "content": tool_response,
                }
            )

        history.append({"role": "tool_results", "results": results})

    raise RuntimeError("Evaluation loop exceeded maximum tool-calling rounds")


async def evaluate_single_task(
    provider: BaseProvider,
    qa_pair: dict[str, Any],
    tools: list[dict[str, Any]],
    connection: Any,
    task_index: int,
) -> dict[str, Any]:
    """Evaluate a single QA pair with the given tools."""
    start_time = time.time()

    print(f"Task {task_index + 1}: Running task with question: {qa_pair['question']}")
    response, tool_metrics = await agent_loop(provider, qa_pair["question"], tools, connection)

    response_value = extract_xml_content(response, "response")
    summary = extract_xml_content(response, "summary")
    feedback = extract_xml_content(response, "feedback")
    duration_seconds = time.time() - start_time

    return {
        "question": qa_pair["question"],
        "expected": qa_pair["answer"],
        "actual": response_value,
        "score": int(response_value == qa_pair["answer"]) if response_value else 0,
        "total_duration": duration_seconds,
        "tool_calls": tool_metrics,
        "num_tool_calls": sum(len(metrics["durations"]) for metrics in tool_metrics.values()),
        "summary": summary,
        "feedback": feedback,
    }


REPORT_HEADER = """
# Evaluation Report

## Summary

- **Provider**: {provider}
- **Model**: {model}
- **Accuracy**: {correct}/{total} ({accuracy:.1f}%)
- **Average Task Duration**: {average_duration_s:.2f}s
- **Average Tool Calls per Task**: {average_tool_calls:.2f}
- **Total Tool Calls**: {total_tool_calls}

---
"""

TASK_TEMPLATE = """
### Task {task_num}

**Question**: {question}
**Ground Truth Answer**: `{expected_answer}`
**Actual Answer**: `{actual_answer}`
**Correct**: {correct_indicator}
**Duration**: {total_duration:.2f}s
**Tool Calls**: {tool_calls}

**Summary**
{summary}

**Feedback**
{feedback}

---
"""


async def run_evaluation(
    eval_path: Path,
    connection: Any,
    provider: BaseProvider,
) -> str:
    """Run evaluation with MCP server tools."""
    print("🚀 Starting Evaluation")
    tools = await connection.list_tools()
    print(f"📋 Loaded {len(tools)} tools from MCP server")

    qa_pairs = parse_evaluation_file(eval_path)
    print(f"📋 Loaded {len(qa_pairs)} evaluation tasks")

    results = []
    for i, qa_pair in enumerate(qa_pairs):
        print(f"Processing task {i + 1}/{len(qa_pairs)}")
        result = await evaluate_single_task(provider, qa_pair, tools, connection, i)
        results.append(result)

    correct = sum(r["score"] for r in results)
    accuracy = (correct / len(results)) * 100 if results else 0
    average_duration_s = sum(r["total_duration"] for r in results) / len(results) if results else 0
    average_tool_calls = sum(r["num_tool_calls"] for r in results) / len(results) if results else 0
    total_tool_calls = sum(r["num_tool_calls"] for r in results)

    report = REPORT_HEADER.format(
        provider=provider.name,
        model=provider.model,
        correct=correct,
        total=len(results),
        accuracy=accuracy,
        average_duration_s=average_duration_s,
        average_tool_calls=average_tool_calls,
        total_tool_calls=total_tool_calls,
    )

    report += "".join(
        [
            TASK_TEMPLATE.format(
                task_num=i + 1,
                question=qa_pair["question"],
                expected_answer=qa_pair["answer"],
                actual_answer=result["actual"] or "N/A",
                correct_indicator="✅" if result["score"] else "❌",
                total_duration=result["total_duration"],
                tool_calls=json.dumps(result["tool_calls"], indent=2),
                summary=result["summary"] or "N/A",
                feedback=result["feedback"] or "N/A",
            )
            for i, (qa_pair, result) in enumerate(zip(qa_pairs, results))
        ]
    )

    return report


def parse_headers(header_list: list[str]) -> dict[str, str]:
    headers = {}
    if not header_list:
        return headers
    for header in header_list:
        if ":" in header:
            key, value = header.split(":", 1)
            headers[key.strip()] = value.strip()
        else:
            print(f"Warning: Ignoring malformed header: {header}")
    return headers


def parse_env_vars(env_list: list[str]) -> dict[str, str]:
    env = {}
    if not env_list:
        return env
    for env_var in env_list:
        if "=" in env_var:
            key, value = env_var.split("=", 1)
            env[key.strip()] = value.strip()
        else:
            print(f"Warning: Ignoring malformed environment variable: {env_var}")
    return env


async def main():
    parser = argparse.ArgumentParser(
        description="Evaluate MCP servers using test questions",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Evaluate a local stdio MCP server with auto-detected provider
  python evaluation.py -t stdio -c python -a -u my_server.py eval.xml

  # Evaluate with Anthropic explicitly
  python evaluation.py --provider anthropic -m claude-3-7-sonnet-20250219 -t stdio -c python -a -u my_server.py eval.xml

  # Evaluate with OpenAI explicitly
  python evaluation.py --provider openai -m gpt-5.4 -t http -u https://example.com/mcp eval.xml

  # Evaluate with Gemini explicitly
  python evaluation.py --provider gemini -m gemini-2.5-pro -t sse -u https://example.com/mcp eval.xml
        """,
    )

    parser.add_argument("eval_file", type=Path, help="Path to evaluation XML file")
    parser.add_argument("-t", "--transport", choices=["stdio", "sse", "http"], default="stdio", help="Transport type (default: stdio)")
    parser.add_argument("--provider", choices=["auto", "anthropic", "openai", "gemini"], default="auto", help="Model provider to use for the evaluation harness (default: auto)")
    parser.add_argument("-m", "--model", default=None, help="Model name. Defaults to a provider-specific model when omitted.")

    stdio_group = parser.add_argument_group("stdio options")
    stdio_group.add_argument("-c", "--command", help="Command to run MCP server (stdio only)")
    stdio_group.add_argument("-a", "--args", nargs="+", help="Arguments for the command (stdio only)")
    stdio_group.add_argument("-e", "--env", nargs="+", help="Environment variables in KEY=VALUE format (stdio only)")

    remote_group = parser.add_argument_group("sse/http options")
    remote_group.add_argument("-u", "--url", help="MCP server URL (sse/http only)")
    remote_group.add_argument("-H", "--header", nargs="+", dest="headers", help="HTTP headers in 'Key: Value' format (sse/http only)")

    parser.add_argument("-o", "--output", type=Path, help="Output file for evaluation report (default: stdout)")

    args = parser.parse_args()

    if not args.eval_file.exists():
        print(f"Error: Evaluation file not found: {args.eval_file}")
        sys.exit(1)

    headers = parse_headers(args.headers) if args.headers else None
    env_vars = parse_env_vars(args.env) if args.env else None

    try:
        provider = detect_provider(args.provider, args.model)
    except ValueError as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    try:
        connection = create_connection(
            transport=args.transport,
            command=args.command,
            args=args.args,
            env=env_vars,
            url=args.url,
            headers=headers,
        )
    except ValueError as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    print(f"🧠 Using provider {provider.name} with model {provider.model}")
    print(f"🔗 Connecting to MCP server via {args.transport}...")

    async with connection:
        print("✅ Connected successfully")
        report = await run_evaluation(args.eval_file, connection, provider)

        if args.output:
            args.output.write_text(report)
            print(f"\n✅ Report saved to {args.output}")
        else:
            print("\n" + report)


if __name__ == "__main__":
    asyncio.run(main())
