from google.adk.agents import Agent
from google.adk.tools import google_search

root_agent = Agent(
    name="travel_agent",
    model="gemini-2.5-flash",
    description="AI travel agent for Lufthansa hackathon.",
    instruction="""You are a smart travel assistant helping users plan trips.
You have access to real-time web search. Use it to find current flight info, travel advisories, weather, and local tips.
Focus on Lufthansa and Star Alliance flights when discussing flight options.
Be concise and always cite sources when using search results.""",
    tools=[google_search],
)
