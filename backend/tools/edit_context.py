"""Edit context tool — saves learned traveler preferences to context files."""

import json

from services import user_context


async def edit_context(
    file: str,
    old_string: str,
    new_string: str,
    replace_all: str = "false",
) -> str:
    """Edit traveler context files to save learned preferences. Use this tool to update TRAVELER.md when you learn about the user's travel preferences, or TRIP_MEMORY.md to log completed trips and important observations. Performs exact string replacement.

    Args:
        file: The context file to edit: 'TRAVELER.md' or 'TRIP_MEMORY.md'.
        old_string: The exact text to replace. Must match exactly including whitespace. Use an empty string to append to the file.
        new_string: The text to replace old_string with.
        replace_all: Set to 'true' to replace all occurrences. Default is 'false'.

    Returns success or error message.
    """
    if file not in ("TRAVELER.md", "TRIP_MEMORY.md"):
        return json.dumps(
            {"error": 'Invalid file name. Must be "TRAVELER.md" or "TRIP_MEMORY.md".'}
        )

    do_replace_all = replace_all.lower() == "true"

    # Empty old_string = append mode
    if old_string == "" and new_string:
        current = user_context.read(file)  # type: ignore[arg-type]
        user_context.write(file, current + new_string)  # type: ignore[arg-type]
        return json.dumps({"success": True, "message": f"Appended content to {file}."})

    result = user_context.edit(file, old_string, new_string, do_replace_all)  # type: ignore[arg-type]

    if not result["success"]:
        return json.dumps(
            {"error": f"Error editing {file}: {result.get('error', 'unknown')}"}
        )

    return json.dumps({"success": True, "message": f"Successfully edited {file}."})
