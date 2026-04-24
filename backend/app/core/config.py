import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Public frontend origin used when minting sign URLs handed back to agents.
# Override in local dev via FRONTEND_BASE_URL=http://localhost:5173.
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://tourskill.paking.xyz")
