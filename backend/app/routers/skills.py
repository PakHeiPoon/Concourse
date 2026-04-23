"""Serves SKILL.md files from backend/skills/ so agents can install them via
a stable public URL (no private GitHub, no PAT). The gateway hosts both the
API and the client-side contract that describes how to call it."""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

router = APIRouter()

# backend/app/routers/skills.py → backend/skills/
SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / "skills"
SKILL_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


@router.get(
    "/{skill_name}/SKILL.md",
    response_class=PlainTextResponse,
    responses={404: {"description": "Skill not found"}},
)
def serve_skill(skill_name: str) -> PlainTextResponse:
    """Return the raw SKILL.md for the named skill (e.g. 'user-client')."""
    if not SKILL_NAME_RE.match(skill_name):
        raise HTTPException(status_code=400, detail="invalid skill name")

    path = SKILLS_DIR / skill_name / "SKILL.md"
    try:
        # resolve() normalizes the path; then check it's still under SKILLS_DIR
        resolved = path.resolve()
        resolved.relative_to(SKILLS_DIR.resolve())
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=400, detail="invalid path") from exc

    if not resolved.is_file():
        raise HTTPException(status_code=404, detail=f"skill '{skill_name}' not found")

    return PlainTextResponse(
        content=resolved.read_text(encoding="utf-8"),
        media_type="text/markdown; charset=utf-8",
    )


@router.get("")
def list_skills() -> dict:
    """List all available skills for discovery."""
    if not SKILLS_DIR.is_dir():
        return {"skills": []}
    names = sorted(
        p.name for p in SKILLS_DIR.iterdir()
        if p.is_dir() and (p / "SKILL.md").is_file()
    )
    return {
        "skills": [
            {"name": n, "url": f"/skills/{n}/SKILL.md"} for n in names
        ]
    }
