---
name: adk-google-search-grounding
description: Add real-time Google Search grounding to agents built with Google's Agent Development Kit (ADK). Use when building agents that need live web data, current events, weather, prices, or any information beyond the model's training cutoff. Supports Python and TypeScript.
---

# ADK Google Search Grounding

Connect ADK agents to live Google Search results. The model automatically decides when to search, retrieves web results, injects them into context, and returns grounded responses with source citations.

Docs: https://google.github.io/adk-docs/grounding/google_search_grounding/
ADK: https://google.github.io/adk-docs/

## When to Use

- Queries about current events, news, weather, prices, sports results
- Any fact that may have changed since the model's training cutoff
- When the agent needs to cite authoritative sources
- Real-time data: flights, stocks, exchange rates, schedules

## Setup

### Python

```bash
pip install google-adk
```

```python
# agent.py
from google.adk.agents import Agent
from google.adk.tools import google_search

root_agent = Agent(
    name="search_agent",
    model="gemini-2.5-flash",
    instruction="Answer questions using Google Search when needed. Always cite sources.",
    description="Agent with real-time web access",
    tools=[google_search]
)
```

```env
# .env — Google AI Studio
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_API_KEY=your_api_key_here

# .env — Vertex AI
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
```

### TypeScript

```bash
npm install @google/adk
```

```typescript
// agent.ts
import { LlmAgent, GOOGLE_SEARCH } from '@google/adk';

const rootAgent = new LlmAgent({
  name: "search_agent",
  model: "gemini-2.5-flash",
  instruction: "Answer questions using Google Search when needed. Always cite sources.",
  description: "Agent with real-time web access",
  tools: [GOOGLE_SEARCH],
});
```

## Run

```bash
# Dev UI (browser at localhost:8000)
adk web

# Terminal
adk run google_search_agent
```

## How Grounding Works

1. User sends query
2. ADK passes to LLM (Gemini)
3. LLM decides if external info is needed → calls `google_search` tool
4. Grounding service queries Google Search Index
5. Results injected into model context BEFORE final generation
6. LLM generates response grounded in live web data
7. Response returned with `groundingMetadata` containing source URLs

## Response Structure

```json
{
  "text": "The final answer text...",
  "groundingMetadata": {
    "groundingChunks": [
      { "web": { "title": "Source Title", "uri": "https://..." } }
    ],
    "groundingSupports": [
      {
        "groundingChunkIndices": [0, 1],
        "segment": {
          "startIndex": 0,
          "endIndex": 85,
          "text": "The specific sentence supported by these sources."
        }
      }
    ],
    "searchEntryPoint": { ... }
  }
}
```

## Parse Grounded Response (TypeScript)

```typescript
interface GroundingChunk {
  web: { title: string; uri: string };
}

interface GroundingSupport {
  groundingChunkIndices: number[];
  segment: { startIndex: number; endIndex: number; text: string };
}

function extractSources(groundingMetadata: any): string[] {
  return groundingMetadata.groundingChunks
    .map((chunk: GroundingChunk) => chunk.web.uri)
    .filter(Boolean);
}

function buildCitedResponse(text: string, metadata: any): string {
  const sources = metadata.groundingChunks
    .map((c: GroundingChunk, i: number) => `[${i + 1}] ${c.web.title}: ${c.web.uri}`)
    .join('\n');
  return `${text}\n\nSources:\n${sources}`;
}
```

## Parse Grounded Response (Python)

```python
def extract_sources(grounding_metadata: dict) -> list[str]:
    return [
        chunk["web"]["uri"]
        for chunk in grounding_metadata.get("groundingChunks", [])
        if "web" in chunk
    ]

def build_cited_response(text: str, metadata: dict) -> str:
    sources = "\n".join(
        f"[{i+1}] {c['web']['title']}: {c['web']['uri']}"
        for i, c in enumerate(metadata.get("groundingChunks", []))
    )
    return f"{text}\n\nSources:\n{sources}"
```

## Display Rules (Google Policy)

You MUST follow these when displaying grounded responses:
1. Show the `searchEntryPoint` widget (Google's inline search suggestions HTML) — required by ToS
2. Display source links alongside the answer — users must be able to verify
3. Do NOT strip or hide `groundingMetadata` from final UI
4. Render `searchEntryPoint.renderedContent` as raw HTML (it's a styled widget)

## Combine with Other Tools

```python
from google.adk.agents import Agent
from google.adk.tools import google_search

# Add alongside custom tools
agent = Agent(
    name="travel_agent",
    model="gemini-2.5-flash",
    instruction="Help users plan trips. Use Google Search for current flight prices, weather, and travel advisories.",
    tools=[google_search, check_flights, get_hotels]  # mix with custom tools
)
```

## Notes

- Only works with Gemini models (gemini-2.5-flash, gemini-2.0-flash, etc.)
- The model decides autonomously when to invoke search — you can't force it
- Grounding adds latency (~1-3s for search + context injection)
- For TravelAgent: combine with HasData Flights API for structured flight data, ADK search for general travel info
- Vertex AI gives more control over grounding behavior (dynamic retrieval threshold)
