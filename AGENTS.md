# AGENTS.md

See CLAUDE.md for full context, rules, and skills.

Quick reference:
- Backend: Python + Google ADK + FastAPI
- Skills: .claude/skills/ — read before implementing anything API-related
- Never raise in ADK tools — return {"error": "..."} instead
- Commit after every meaningful change, push to main
