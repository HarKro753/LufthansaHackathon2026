"""Tool registry — registers all tool functions onto the MCP server.

To add a new tool:
  1. Create a new file in tools/ (e.g. search_flights.py)
  2. Write an async function that returns str
  3. Import it here and call mcp.tool()(your_function)
"""

from mcp.server import FastMCP

from tools.search_places import search_places

mcp = FastMCP("travel-tools")

# ─── Register tools ──────────────────────────────────────────────────────────
# Each call wraps the function as an MCP tool with auto-generated schema.
# Add new tools here as you create them.

mcp.tool()(search_places)
