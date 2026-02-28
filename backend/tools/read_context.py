"""Read context tool — retrieves traveler profile and trip memory."""

import json

from services import user_context


async def read_context(
    file: str,
) -> str:
    """Read traveler context files to understand user preferences. Use TRAVELER.md to see the traveler's profile, preferences, and travel style. Use TRIP_MEMORY.md to see past trips and learned patterns.

    Args:
        file: The context file to read: 'TRAVELER.md' or 'TRIP_MEMORY.md'.

    Returns the file content wrapped in XML-like tags.
    """
    if file not in ("TRAVELER.md", "TRIP_MEMORY.md"):
        return json.dumps(
            {"error": 'Invalid file name. Must be "TRAVELER.md" or "TRIP_MEMORY.md".'}
        )

    content = user_context.read(file)  # type: ignore[arg-type]
    return f'<file name="{file}">\n{content}\n</file>'
