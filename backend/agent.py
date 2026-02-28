"""Single ADK agent with tools served via MCP server.

Architecture:
  root_agent (gemini-2.5-flash)
    └── tools via MCP stdio server (tools/mcp_server.py)
        ├── search_places  (Google Places)
        └── ... (add more in tools/registry.py)
"""

import os
import sys

from google.adk.agents import Agent
from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp.client.stdio import StdioServerParameters

MODEL = "gemini-2.5-flash"

_backend_dir = os.path.dirname(os.path.abspath(__file__))
_python = sys.executable

toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=_python,
            args=["-m", "tools.mcp_server"],
            cwd=_backend_dir,
        ),
    ),
)

root_agent = Agent(
    name="travel_agent",
    model=MODEL,
    description="AI travel agent for the Lufthansa Hackathon 2026.",
    instruction="""You are a smart travel assistant powered by Lufthansa and Google.

You have tools available via MCP:
- search_places: find hotels, restaurants, attractions, airports, or any place. Use when the user asks about places to stay, eat, visit, or travel to.

Guidelines:
- For places, include ratings, price level, address, and website when available.
- Be concise and actionable — users want to make decisions, not read essays.
- If asked about flights, use your knowledge of Lufthansa and Star Alliance routes.
- If asked about multiple things (e.g. flights + hotels), address each clearly.""",
    tools=[toolset],
)
