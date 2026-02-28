"""Tool registry — single source of truth for all agent tools.

To add a new tool:
  1. Create a new file in tools/ (e.g. search_flights.py)
  2. Write an async function that returns str
  3. Import it here and add it to ALL_TOOLS
"""

from tools.create_trip import create_trip
from tools.get_trip import get_trip
from tools.add_to_trip import add_to_trip
from tools.get_routes import get_routes
from tools.search_flights import search_flights
from tools.search_hostels import search_hostels

# from tools.search_places import search_places
from tools.update_trip import update_trip
from tools.remove_from_trip import remove_from_trip
from tools.edit_context import edit_context
from tools.read_context import read_context

ALL_TOOLS = [
    create_trip,
    get_trip,
    add_to_trip,
    get_routes,
    search_flights,
    search_hostels,
    # search_places,
    update_trip,
    remove_from_trip,
    edit_context,
    read_context,
]
