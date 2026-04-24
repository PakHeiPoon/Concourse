"""End-to-end smoke test for the /v1/drafts + PATCH pipeline.

What this proves:
  1. Agent can POST a draft and gets back a sign_url.
  2. GET returns pending state + the stored payload.
  3. Browser-side POST /complete flips status → signed and attaches
     merchant_id / wallet / tx_hash. The merchant row gets
     register_tx_hash written into specific_fields.
  4. Second GET reflects the signed state (durability).
  5. Subsequent PATCH with X-Wallet-Address works (auth contract holds).
  6. PATCH with a wrong wallet is rejected with 403 (auth is enforced).
  7. Unknown draft id → 404.
  8. Cleanup: the newly created merchant is set back to active.

What this does NOT prove (by design — no browser, no MetaMask):
  - The real on-chain MerchantRegistry.register() call. That step is
    exercised manually via the /merchant/sign/:draftId page.

Run:
  python -m scripts.e2e_draft_flow                         # hits localhost:8000
  BASE=https://api.tourskill.paking.xyz python -m scripts.e2e_draft_flow
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any, Dict

import requests

BASE = os.getenv("BASE", "http://127.0.0.1:8000").rstrip("/")
TIMEOUT = 15


def _step(msg: str) -> None:
    print(f"\n\x1b[36m→ {msg}\x1b[0m")


def _ok(msg: str) -> None:
    print(f"  \x1b[32m✓\x1b[0m {msg}")


def _fail(msg: str) -> None:
    print(f"  \x1b[31m✗ {msg}\x1b[0m")
    sys.exit(1)


def _expect(cond: bool, msg: str) -> None:
    if cond:
        _ok(msg)
    else:
        _fail(msg)


def _req(method: str, path: str, **kw: Any) -> requests.Response:
    url = f"{BASE}{path}"
    r = requests.request(method, url, timeout=TIMEOUT, **kw)
    return r


def main() -> None:
    print(f"\x1b[1mE2E smoke — target: {BASE}\x1b[0m")

    # Sanity: health ------------------------------------------------------
    _step("Health check")
    r = _req("GET", "/health")
    _expect(r.status_code == 200, f"GET /health → {r.status_code}")

    # 1. Create a draft ---------------------------------------------------
    _step("POST /v1/drafts — agent creates onboard draft")
    draft_body: Dict[str, Any] = {
        "merchant_type": "restaurant",
        "name": "E2E Smoke Cafe",
        "description": "Automated end-to-end smoke test. Safe to delete.",
        "city": "hangzhou",
        "country": "CN",
        "address": "1 Smoke Test Lane",
        "contact_phone": "+86 000 0000 0000",
        "contact_email": "smoke@example.com",
        "opening_hours": "00:00-24:00",
        "supported_skills": ["BookingBySkill"],
        "tags": ["e2e", "smoke"],
    }
    r = _req("POST", "/v1/drafts", json=draft_body)
    _expect(r.status_code == 200, f"draft create status = {r.status_code}")
    draft = r.json()
    draft_id: str = draft["draft_id"]
    _expect(bool(draft_id), f"draft_id returned: {draft_id}")
    _expect(
        draft["sign_url"].endswith(f"/merchant/sign/{draft_id}"),
        f"sign_url shape: {draft['sign_url']}",
    )
    _expect(draft["status"] == "pending", "status = pending")
    _expect(draft["merchant_id"] is None, "merchant_id is null before signing")

    # 2. Read it back -----------------------------------------------------
    _step("GET /v1/drafts/{id} — still pending")
    r = _req("GET", f"/v1/drafts/{draft_id}")
    _expect(r.status_code == 200, f"draft read status = {r.status_code}")
    d2 = r.json()
    _expect(d2["status"] == "pending", "status still pending")
    _expect(d2["payload"]["name"] == draft_body["name"], "payload round-trips")

    # 3. Simulate the browser: off-chain create + mock tx + complete ------
    _step("POST /v1/merchants — simulate the browser's off-chain save")
    test_wallet = "0x000000000000000000000000000000000000E2E5"
    other_wallet = "0xDead000000000000000000000000000000000001"
    merchant_payload = {
        **draft_body,
        "wallet_address": test_wallet,
    }
    r = _req("POST", "/v1/merchants", json=merchant_payload)
    _expect(r.status_code == 200, f"merchant create status = {r.status_code}")
    merchant_id: str = r.json()["data"]["merchant_id"]
    _ok(f"created merchant_id = {merchant_id}")

    # Mock tx hash (real one would come from MerchantRegistry.register)
    mock_tx = "0x" + "ab" * 32

    _step("POST /v1/drafts/{id}/complete — browser reports back")
    r = _req(
        "POST",
        f"/v1/drafts/{draft_id}/complete",
        json={
            "merchant_id": merchant_id,
            "wallet_address": test_wallet,
            "tx_hash": mock_tx,
        },
    )
    _expect(r.status_code == 200, f"complete status = {r.status_code}")
    d3 = r.json()
    _expect(d3["status"] == "signed", "status flipped → signed")
    _expect(d3["merchant_id"] == merchant_id, "merchant_id echoed")
    _expect(d3["wallet_address"].lower() == test_wallet.lower(), "wallet echoed")
    _expect(d3["tx_hash"] == mock_tx, "tx_hash echoed")

    # 4. Agent polls — durable signed state -------------------------------
    _step("GET /v1/drafts/{id} — agent picks up result")
    time.sleep(0.2)
    r = _req("GET", f"/v1/drafts/{draft_id}")
    _expect(r.status_code == 200, f"re-read status = {r.status_code}")
    d4 = r.json()
    _expect(d4["status"] == "signed", "still signed")
    _expect(d4["merchant_id"] == merchant_id, "merchant_id durable")

    # 5. Merchant row absorbed the tx_hash --------------------------------
    _step("GET /v1/merchants/{id} — tx_hash written to specific_fields")
    r = _req("GET", f"/v1/merchants/{merchant_id}")
    _expect(r.status_code == 200, f"merchant read status = {r.status_code}")
    m = r.json()
    _expect(m.get("register_tx_hash") == mock_tx, "register_tx_hash persisted")

    # 6. Auth contract: PATCH with correct wallet succeeds ----------------
    _step("PATCH /v1/merchants/{id} — pause with owner wallet")
    r = _req(
        "PATCH",
        f"/v1/merchants/{merchant_id}",
        json={"status": "inactive"},
        headers={"X-Wallet-Address": test_wallet},
    )
    _expect(r.status_code == 200, f"pause status = {r.status_code}")
    _expect(r.json()["data"]["status"] == "inactive", "status = inactive")

    # 7. Auth contract: wrong wallet rejected ------------------------------
    _step("PATCH /v1/merchants/{id} — wrong wallet must be rejected")
    r = _req(
        "PATCH",
        f"/v1/merchants/{merchant_id}",
        json={"status": "active"},
        headers={"X-Wallet-Address": other_wallet},
    )
    _expect(r.status_code == 403, f"wrong-wallet patch status = {r.status_code}")

    # 8. 404 for unknown draft --------------------------------------------
    _step("GET /v1/drafts/does-not-exist — 404")
    r = _req("GET", "/v1/drafts/does-not-exist-xyz")
    _expect(r.status_code == 404, f"unknown draft status = {r.status_code}")

    # Cleanup: leave the smoke merchant PAUSED so it stays out of the
    # public Explorer feed. The row is kept (not deleted) so re-runs can
    # refer back and so the tx_hash/auth trace stays auditable.
    _step("Cleanup — leave smoke merchant paused (hidden from discover)")
    r = _req(
        "PATCH",
        f"/v1/merchants/{merchant_id}",
        json={"status": "inactive"},
        headers={"X-Wallet-Address": test_wallet},
    )
    _expect(r.status_code == 200, f"pause status = {r.status_code}")

    print("\n\x1b[1;32m✓ E2E smoke passed — full draft/sign pipeline is healthy.\x1b[0m")
    print(f"  smoke merchant: {merchant_id} (paused, hidden from discover)")


if __name__ == "__main__":
    main()
