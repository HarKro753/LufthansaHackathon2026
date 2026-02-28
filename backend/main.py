import json
import uuid
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from config import settings  # must be first — loads .env into os.environ for ADK
from agent import root_agent
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
    """Return (user_id, session_id), creating a new ADK session if needed.

    If a cookie exists but the in-memory map was lost (e.g. server restart),
    we re-create the ADK session and restore the mapping so the session
    cookie remains valid and the persisted trip/chat data is accessible.
    """
    from services import session_store

    cookie_id = request.cookies.get("lh_session")

    if cookie_id and cookie_id in _session_map:
        return _session_map[cookie_id]

    # Cookie exists but not in memory — restore from persisted session file
    if cookie_id and session_store.get_session(cookie_id) is not None:
        user_id = f"user_{cookie_id[:8]}"
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            state={"session_id": cookie_id},
        )
        _session_map[cookie_id] = (user_id, session.id)
        # Re-set cookie to refresh its max_age
        response.set_cookie(
            key="lh_session",
            value=cookie_id,
            max_age=604800,
            httponly=True,
            samesite="none",
            secure=True,
        )
        return user_id, session.id

    # No cookie at all — create a brand new session
    cookie_id = cookie_id or str(uuid.uuid4())
    user_id = f"user_{cookie_id[:8]}"

    # Pass session_id into ADK state so tools can access it for persistence
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        state={"session_id": cookie_id},
    )

    _session_map[cookie_id] = (user_id, session.id)
    response.set_cookie(
        key="lh_session",
        value=cookie_id,
        max_age=604800,
        httponly=True,
        samesite="none",
        secure=True,
    )
    return user_id, session.id


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _stream_agent_response(
    user_id: str,
    session_id: str,
    cookie_id: str,
    user_text: str,
) -> AsyncGenerator[str, None]:
    """Stream ADK runner events as SSE and persist messages."""
    from services import session_store

    # Persist the user message
    session_store.append_chat_message(cookie_id, "user", user_text)

    # Trip-mutating tools whose results contain an itemId to track
    TRIP_MUTATING_TOOLS = {"add_to_trip", "update_trip"}

    message = Content(parts=[Part(text=user_text)])
    tool_call_ids: dict[str, str] = {}  # tool_name -> tool_id
    tool_id_to_name: dict[str, str] = {}  # tool_id -> tool_name
    assistant_text_parts: list[str] = []
    timeline_item_ids: list[str] = []  # trip item IDs added during this response

    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=message,
        ):
            if not event.content or not event.content.parts:
                continue

            for part in event.content.parts:
                # -- Tool call start --
                if part.function_call:
                    call = part.function_call
                    tool_id = call.id or f"{call.name}-{uuid.uuid4().hex[:8]}"
                    if call.name:
                        tool_call_ids[call.name] = tool_id
                        tool_id_to_name[tool_id] = call.name
                    yield _sse_event(
                        {
                            "type": "tool_call_start",
                            "toolCall": {
                                "id": tool_id,
                                "name": call.name,
                                "arguments": dict(call.args) if call.args else {},
                            },
                        }
                    )

                # -- Tool call result --
                elif part.function_response:
                    resp = part.function_response
                    resp_name = resp.name or ""
                    tool_id = resp.id or tool_call_ids.get(resp_name) or resp_name
                    result_data = resp.response
                    result_str = (
                        json.dumps(result_data)
                        if isinstance(result_data, (dict, list))
                        else str(result_data)
                    )

                    # Track trip item IDs from mutating tool results
                    resolved_name = tool_id_to_name.get(tool_id, resp_name)
                    if resolved_name in TRIP_MUTATING_TOOLS:
                        try:
                            # ADK wraps string tool returns as {"result": "<json>"}
                            # so we need to unwrap before looking for itemId
                            parsed = (
                                result_data
                                if isinstance(result_data, dict)
                                else json.loads(result_str)
                            )
                            # Direct itemId at top level
                            item_id = None
                            if isinstance(parsed, dict):
                                item_id = parsed.get("itemId")
                                # Or nested inside a "result" string wrapper
                                if not item_id and isinstance(
                                    parsed.get("result"), str
                                ):
                                    try:
                                        inner = json.loads(parsed["result"])
                                        if isinstance(inner, dict):
                                            item_id = inner.get("itemId")
                                    except (json.JSONDecodeError, TypeError):
                                        pass
                            if item_id:
                                timeline_item_ids.append(item_id)
                        except (json.JSONDecodeError, TypeError):
                            pass

                    yield _sse_event(
                        {
                            "type": "tool_call_complete",
                            "toolCallId": tool_id,
                            "result": result_str,
                        }
                    )

                # -- Thought / thinking --
                elif part.thought and part.text:
                    yield _sse_event(
                        {
                            "type": "thinking",
                            "content": part.text,
                        }
                    )

                # -- Text content --
                elif part.text:
                    assistant_text_parts.append(part.text)
                    yield _sse_event(
                        {
                            "type": "content",
                            "content": part.text,
                        }
                    )

    except Exception as exc:
        yield _sse_event({"type": "error", "error": str(exc)})

    # Persist the full assistant response with timeline item IDs
    full_text = "".join(assistant_text_parts)
    if full_text.strip() or timeline_item_ids:
        session_store.append_chat_message(
            cookie_id, "assistant", full_text, timeline_item_ids=timeline_item_ids
        )

    yield _sse_event({"type": "done"})


@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest, request: Request, response: Response
) -> StreamingResponse:
    """Accept a chat request and return SSE stream of agent responses."""
    user_id, session_id = await _get_or_create_session(request, response)

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

    # Resolve cookie_id for persistence
    cookie_id = request.cookies.get("lh_session")
    if not cookie_id:
        for cid, (uid, sid) in _session_map.items():
            if uid == user_id and sid == session_id:
                cookie_id = cid
                break
    cookie_id = cookie_id or ""

    streaming_response = StreamingResponse(
        _stream_agent_response(user_id, session_id, cookie_id, last_user_msg),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

    if cookie_id:
        streaming_response.set_cookie(
            key="lh_session",
            value=cookie_id,
            max_age=604800,
            httponly=True,
            samesite="none",
            secure=True,
        )

    return streaming_response


@app.get("/api/session")
async def get_session_endpoint(request: Request, response: Response) -> dict:
    """Return current session info."""
    cookie_id = request.cookies.get("lh_session")

    if cookie_id and cookie_id in _session_map:
        _, session_id = _session_map[cookie_id]
        return {"sessionId": session_id, "messages": []}

    user_id, session_id = await _get_or_create_session(request, response)
    return {"sessionId": session_id, "messages": []}


@app.get("/api/session/history")
async def get_session_history(request: Request) -> dict:
    """Return persisted chat history with timeline item IDs and trip state.

    The frontend uses timeline_item_ids to reconstruct timeline cards
    from the trip state when restoring chat history on page reload.
    """
    cookie_id = request.cookies.get("lh_session")
    if not cookie_id:
        return {"messages": [], "trip": None}

    from services import session_store

    records = session_store.get_chat_history(cookie_id)
    trip = session_store.get_trip(cookie_id)

    return {
        "messages": [
            {
                "role": r.role,
                "content": r.content,
                "timestamp": r.timestamp,
                "timeline_item_ids": r.timeline_item_ids,
            }
            for r in records
        ],
        "trip": json.loads(trip.model_dump_json()) if trip else None,
    }


@app.delete("/api/session")
async def clear_session(request: Request, response: Response) -> dict:
    """Clear the current session."""
    cookie_id = request.cookies.get("lh_session")

    if cookie_id and cookie_id in _session_map:
        del _session_map[cookie_id]

    # Clear persisted chat history too
    if cookie_id:
        from services import session_store

        session_store.clear_chat_history(cookie_id)
        session_store.clear_trip(cookie_id)

    response.delete_cookie("lh_session", samesite="none", secure=True)
    return {"success": True}


@app.get("/api/trip")
async def get_trip_endpoint(request: Request, response: Response) -> dict:
    """Return the current trip state for the session."""
    cookie_id = request.cookies.get("lh_session")

    if not cookie_id:
        return {"trip": None}

    from services import session_store

    trip = session_store.get_trip(cookie_id)
    if not trip:
        return {"trip": None}
    return {"trip": json.loads(trip.model_dump_json())}


@app.get("/api/trip/export")
async def export_trip_ics(request: Request) -> Response:
    """Export the current trip as an .ics calendar file."""
    cookie_id = request.cookies.get("lh_session")

    if not cookie_id:
        return Response(content="No active session", status_code=404)

    from services import session_store
    from services.ics_export import generate_ics

    trip = session_store.get_trip(cookie_id)
    if not trip:
        return Response(content="No trip found", status_code=404)

    ics_content = generate_ics(trip)
    safe_name = "".join(c if c.isalnum() else "_" for c in trip.name)

    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.ics"',
        },
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
