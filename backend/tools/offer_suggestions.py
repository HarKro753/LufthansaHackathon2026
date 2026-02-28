from typing import List
import json
from pydantic import BaseModel


class Suggestion(BaseModel):
    short_text: str
    prompt_text: str


def offer_suggestions(suggestions: List[Suggestion]):
    """
    Use this tool to offer suggestions to the user for the next steps.
    This should be called at the end of a response to guide the user.

    Args:
        suggestions: A list of suggestions, each with a short text for the button and a longer prompt text for the chat.
    """
    return json.dumps({"suggestions": suggestions})
