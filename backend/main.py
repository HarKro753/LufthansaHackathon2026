import json
import uuid
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agent import root_agent
from config import settings
from models import ChatRequest

app = FastAPI(title="LH Travel Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

APP_NAME = "lh_travel_agent"
session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
)

# In-memory mapping: cookie session id -> (user_id, adk_session_id)
_session_map: dict[str, tuple[str, str]] = {}


async def _get_or_create_session(
    request: Request, response: Response
) -> tuple[str, str]:
    """Return (user_id, session_id), creating a new ADK session if needed."""
    cookie_id = request.cookies.get("lh_session")

    if cookie_id and cookie_id in _session_map:
        return _session_map[cookie_id]

    cookie_id = cookie_id or str(uuid.uuid4())
    user_id = f"user_{cookie_id[:8]}"

    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
    )

    _session_map[cookie_id] = (user_id, session.id)
    response.set_cookie(
        key="lh_session",
        value=cookie_id,
        max_age=604800,
        httponly=True,
        samesite="none",
        secure=False,
    )
    return user_id, session.id


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _stream_agent_response(
    user_id: str,
    session_id: str,
    user_text: str,
) -> AsyncGenerator[str, None]:
    """Stream ADK runner events as SSE."""
    message = Content(parts=[Part(text=user_text)])

    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=message,
        ):
            # Handle function calls (tool invocations)
            if event.content and event.content.parts:
                for part in event.content.parts:
                    # Tool call start
                    if part.function_call:
                        yield _sse_event(
                            {
                                "type": "tool_call_start",
                                "toolCall": {
                                    "id": part.function_call.id
                                    or event.id
                                    or str(uuid.uuid4()),
                                    "name": part.function_call.name,
                                    "arguments": dict(part.function_call.args)
                                    if part.function_call.args
                                    else {},
                                },
                            }
                        )

                    # Tool call result
                    elif part.function_response:
                        result_data = part.function_response.response
                        result_str = (
                            json.dumps(result_data)
                            if isinstance(result_data, dict)
                            else str(result_data)
                        )
                        yield _sse_event(
                            {
                                "type": "tool_call_complete",
                                "toolCallId": part.function_response.id
                                or part.function_response.name
                                or "",
                                "result": result_str,
                            }
                        )

                    # Text content
                    elif part.text:
                        yield _sse_event(
                            {
                                "type": "content",
                                "content": part.text,
                            }
                        )

    except Exception as exc:
        yield _sse_event({"type": "error", "error": str(exc)})

    yield _sse_event({"type": "done"})


@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest, request: Request, response: Response
) -> StreamingResponse:
    """Accept a chat request and return SSE stream of agent responses."""
    user_id, session_id = await _get_or_create_session(request, response)

    # Use the last user message as the new message to the agent
    last_user_msg = ""
    for msg in reversed(chat_request.messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    if not last_user_msg:
        return StreamingResponse(
            iter(
                [
                    _sse_event({"type": "error", "error": "No user message provided"}),
                    _sse_event({"type": "done"}),
                ]
            ),
            media_type="text/event-stream",
        )

    # Build streaming response — set cookie on it
    streaming_response = StreamingResponse(
        _stream_agent_response(user_id, session_id, last_user_msg),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

    # Ensure session cookie is set
    cookie_id = request.cookies.get("lh_session")
    if not cookie_id:
        # Find the cookie_id we just created
        for cid, (uid, sid) in _session_map.items():
            if uid == user_id and sid == session_id:
                cookie_id = cid
                break

    if cookie_id:
        streaming_response.set_cookie(
            key="lh_session",
            value=cookie_id,
            max_age=604800,
            httponly=True,
            samesite="none",
            secure=False,
        )

    return streaming_response


@app.get("/api/session")
async def get_session(request: Request, response: Response) -> dict:
    """Return current session info."""
    cookie_id = request.cookies.get("lh_session")

    if cookie_id and cookie_id in _session_map:
        _, session_id = _session_map[cookie_id]
        return {"sessionId": session_id, "messages": []}

    # Create a new session
    user_id, session_id = await _get_or_create_session(request, response)
    return {"sessionId": session_id, "messages": []}


@app.delete("/api/session")
async def clear_session(request: Request, response: Response) -> dict:
    """Clear the current session."""
    cookie_id = request.cookies.get("lh_session")

    if cookie_id and cookie_id in _session_map:
        del _session_map[cookie_id]

    response.delete_cookie("lh_session")
    return {"success": True}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
