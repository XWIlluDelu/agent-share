"""Minimal MCP server used by the local evaluation harness self-test."""

from mcp.server.fastmcp import FastMCP


mcp = FastMCP("smoke-test-server")


@mcp.tool(description="Add two integers and return their sum.")
def add_numbers(a: int, b: int) -> int:
    return a + b


if __name__ == "__main__":
    mcp.run("stdio")
