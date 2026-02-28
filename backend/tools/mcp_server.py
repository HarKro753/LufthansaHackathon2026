"""MCP server entry point — run via stdio for ADK agent connection.

Usage:
  python -m tools.mcp_server

ADK connects to this automatically via StdioConnectionParams in agent.py.
"""

from dotenv import load_dotenv

load_dotenv()  # Load .env so API keys are available in the subprocess

from tools.registry import mcp  # noqa: E402 — must be after load_dotenv

if __name__ == "__main__":
    mcp.run(transport="stdio")
