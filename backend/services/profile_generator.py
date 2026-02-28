"""Profile Generator Service
=========================
Generates TRAVELER.md and TRIP_MEMORY.md content using an LLM based on
the analyzed timeline data.
"""

import os
import json
from pathlib import Path
from google.genai import Client
from google.genai.types import GenerateContentConfig

# Use a fast model for generation
MODEL = "gemini-2.0-flash"

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _read_template(filename: str) -> str:
    path = TEMPLATES_DIR / filename
    if path.exists():
        return path.read_text()
    return ""


def generate_profile_files(profile_data: dict) -> dict[str, str]:
    """
    Generate the content for TRAVELER.md and TRIP_MEMORY.md based on profile data.
    Returns a dict with keys "traveler" and "trip_memory".
    """
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        # Fallback if no API key (shouldn't happen in this env)
        return {
            "traveler": _read_template("TRAVELER.md"),
            "trip_memory": _read_template("TRIP_MEMORY.md"),
        }

    client = Client(api_key=api_key)

    traveler_template = _read_template("TRAVELER.md")
    trip_memory_template = _read_template("TRIP_MEMORY.md")

    # Filter profile data to reduce token count if needed, but the analysis is small enough
    # We want the LLM to see the derived insights

    prompt = f"""
You are an expert travel profiler. Your task is to fill out two markdown templates based on the user's travel history analysis.

Input Data (JSON):
{json.dumps(profile_data, indent=2)}

Template 1: TRAVELER.md
{traveler_template}

Template 2: TRIP_MEMORY.md
{trip_memory_template}

Instructions:
1. Analyze the input data carefully. It contains derived insights like "traveler_type", "preferences", "top_destinations", etc.
2. Fill out the TRAVELER.md template completely.
   - For "Home Base", use "home_city".
   - For "Budget Level", infer from "traveler_type" or "accommodation_preferences" if available, otherwise "Moderate to High" based on travel frequency.
   - For "Travel Pace", infer from "daily_rhythm" and "avg_trip_duration".
   - Fill all other fields logically based on the data.
   - Under "Agent Notes", add a brief summary of their travel style.
3. Fill out the TRIP_MEMORY.md template.
   - "Past Trips": List the top 5 destinations from "top_destinations" with their visit counts.
   - "Learned Preferences": Summarize the "preferences" list and any other insights.
   - "Important Notes": Mention things like "Weekend Explorer" status, specific airline affinities if obvious (though not in this data), etc.

Output Format:
Return ONLY a valid JSON object with two keys: "traveler" and "trip_memory", where the values are the filled markdown strings.
Do not include any markdown formatting (like ```json) in the response, just the raw JSON string.
"""

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=GenerateContentConfig(response_mime_type="application/json"),
        )

        if not response.text:
            raise ValueError("Empty response from LLM")

        result = json.loads(response.text)
        return {
            "traveler": result.get("traveler", ""),
            "trip_memory": result.get("trip_memory", ""),
        }
    except Exception as e:
        print(f"Error generating profile: {e}")
        # Fallback to templates if generation fails
        return {"traveler": traveler_template, "trip_memory": trip_memory_template}
