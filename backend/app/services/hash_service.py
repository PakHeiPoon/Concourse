import hashlib
import json
from typing import Any, Dict


def compute_profile_hash(profile: Dict[str, Any]) -> str:
    canonical = json.dumps(profile, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return "0x" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()
