"""Draft endpoints for the "Sign Once" merchant onboarding ceremony.

Flow:
  1. Merchant agent POST /v1/drafts (payload) → { draft_id, sign_url }
  2. Agent shows sign_url to the owner ("open this to approve")
  3. Owner opens URL in browser → frontend renders preview + wallet button
  4. Browser connects MetaMask → creates merchant row + calls registry.register
  5. Browser POST /v1/drafts/{id}/complete with { merchant_id, wallet_address, tx_hash }
  6. Agent (polling) GET /v1/drafts/{id} → now has wallet_address to use as auth
"""

from fastapi import APIRouter

from app.schemas.draft import DraftCompleteRequest, DraftCreateRequest
from app.services.draft_service import complete_draft, create_draft, get_draft
from app.services.merchant_service import attach_register_tx_hash

router = APIRouter()


@router.post("/drafts")
def post_draft(req: DraftCreateRequest):
    return create_draft(req)


@router.get("/drafts/{draft_id}")
def retrieve_draft(draft_id: str):
    return get_draft(draft_id)


@router.post("/drafts/{draft_id}/complete")
def post_complete(draft_id: str, req: DraftCompleteRequest):
    result = complete_draft(draft_id, req)
    # Persist tx_hash back to the merchant record so Explorer + MerchantDetail
    # surface the on-chain anchor. Guarded by both fields being present so
    # off-chain-only saves (MetaMask rejected) still succeed.
    if req.tx_hash and req.merchant_id:
        attach_register_tx_hash(req.merchant_id, req.tx_hash)
    return result
