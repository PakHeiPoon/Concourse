from fastapi import HTTPException
from supabase import Client, create_client

from app.core.config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    if SUPABASE_SERVICE_ROLE_KEY.startswith("sb_publishable_"):
        raise HTTPException(
            status_code=500,
            detail=(
                "SUPABASE_SERVICE_ROLE_KEY is invalid. "
                "You are using a publishable key. Please use the service_role secret key from Supabase project settings."
            ),
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
