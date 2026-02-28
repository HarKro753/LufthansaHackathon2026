"""User context service — persistent traveler profile and trip memory.

Manages TRAVELER.md and TRIP_MEMORY.md files for cross-session memory.
Files are stored in .travelagent/context/ and initialized from templates.
"""

import os
from pathlib import Path
from typing import Literal

ContextFileName = Literal["TRAVELER.md", "TRIP_MEMORY.md"]

CONTEXT_DIR = Path(os.getcwd()) / ".travelagent" / "context"
TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _ensure_context_dir() -> None:
    CONTEXT_DIR.mkdir(parents=True, exist_ok=True)


def _get_file_path(file_name: ContextFileName) -> Path:
    return CONTEXT_DIR / file_name


def _get_template(file_name: ContextFileName) -> str:
    template_path = TEMPLATES_DIR / file_name
    if template_path.exists():
        return template_path.read_text()
    return ""


def _ensure_context_files() -> None:
    _ensure_context_dir()
    for file_name in ("TRAVELER.md", "TRIP_MEMORY.md"):
        file_path = _get_file_path(file_name)  # type: ignore[arg-type]
        if not file_path.exists():
            file_path.write_text(_get_template(file_name))  # type: ignore[arg-type]


# Initialize on import
_ensure_context_files()


def read(file_name: ContextFileName) -> str:
    """Read a context file. Returns the file content."""
    file_path = _get_file_path(file_name)
    return file_path.read_text()


def write(file_name: ContextFileName, content: str) -> None:
    """Overwrite a context file with new content."""
    _ensure_context_dir()
    file_path = _get_file_path(file_name)
    file_path.write_text(content)


def edit(
    file_name: ContextFileName,
    old_string: str,
    new_string: str,
    replace_all: bool = False,
) -> dict:
    """Perform exact string replacement in a context file.

    Returns dict with 'success' and optional 'error'.
    """
    content = read(file_name)

    if old_string == new_string:
        return {
            "success": False,
            "error": "old_string and new_string must be different",
        }

    if old_string not in content:
        return {"success": False, "error": "old_string not found in file"}

    occurrences = content.count(old_string)
    if occurrences > 1 and not replace_all:
        return {
            "success": False,
            "error": (
                f"Found {occurrences} occurrences of old_string. "
                "Use replace_all=true to replace all, or provide more context."
            ),
        }

    if replace_all:
        new_content = content.replace(old_string, new_string)
    else:
        new_content = content.replace(old_string, new_string, 1)

    write(file_name, new_content)
    return {"success": True}


def get_all_context() -> dict[str, str]:
    """Return both context files as a dict."""
    return {
        "traveler": read("TRAVELER.md"),
        "trip_memory": read("TRIP_MEMORY.md"),
    }
