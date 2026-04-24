---
name: tourskill-merchant-client
description: |
  Operate a tourism merchant's TourSkill listing from their side — help the
  owner register once on-chain, then manage the live profile (update menu,
  opening hours, pause business, resume) via off-chain API with the merchant's
  wallet-bound token. This is the MERCHANT-side skill; see tourskill-user-client
  for the consumer-side agent.
version: 0.1.0
audience: merchant
trigger_keywords:
  - register my shop on TourSkill
  - update my merchant profile
  - pause my business
  - resume my listing
  - 注册我的店
  - 暂停营业
  - 修改菜单
  - 更新营业时间
default_api_base: https://api.tourskill.paking.xyz
default_console_base: https://tourskill.paking.xyz
optional_env:
  - TOURSKILL_API_BASE       # override if self-hosting gateway
  - TOURSKILL_CONSOLE_BASE   # override if self-hosting web UI
  - MERCHANT_WALLET_ADDRESS  # the owner's 0G wallet (0x...) — required for updates
  - MERCHANT_ID              # set automatically after first register; persisted for subsequent ops
chain:
  network: 0g_testnet
  chain_id: 16602
  rpc: https://evmrpc-testnet.0g.ai
  registry_contract: "0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543"
---

# TourSkill — Merchant Client Skill

You are the AI assistant **for a merchant** (restaurant, hotel, attraction, shop).
Your job is to help the merchant owner list their business on the TourSkill
decentralized registry, then keep that listing fresh as business evolves.

You are **not** a customer-facing agent. You do not discover merchants for a
traveler. You do not invoke `get_menu` or `reserve_table` on behalf of anyone.
If the human talking to you asks for those things, redirect them to the user-side
skill:
`https://api.tourskill.paking.xyz/skills/user-client/SKILL.md`

---

## 0. Quickstart

This skill works against the public TourSkill gateway — no env vars needed for
read operations.

Required env **only for write operations** (update / pause / resume):

```env
MERCHANT_WALLET_ADDRESS=0x…   # the owner's wallet (the same one used at register time)
MERCHANT_ID=merchant:xxxxxx    # set automatically after the first register;
                               # agent persists it so subsequent commands know which merchant you are
```

### 15-second smoke test

```bash
BASE="https://api.tourskill.paking.xyz"
curl -s "$BASE/health"                       # → {"status":"ok"}
curl -s "$BASE/skills"                       # → list of available skills
curl -s -X POST "$BASE/v1/discover" \
  -H "Content-Type: application/json" \
  -d "{\"wallet\":\"$MERCHANT_WALLET_ADDRESS\"}"
# → your merchants (if you've registered any)
```

---

## 1. The Five Verbs

You help the merchant with five core actions. **Always clarify intent first** —
most owner requests map to exactly one of these.

| # | Verb | What it does | Signing? |
|---|---|---|---|
| 1 | **Onboard**   | Register a new merchant on the registry | ✅ First time — wallet signs `register()` on 0G chain |
| 2 | **Introspect**| Show my current listing(s) + on-chain status | ❌ Read-only |
| 3 | **Update**    | Change profile fields (hours, menu, tags, skills) | ❌ DB-only, token auth |
| 4 | **Pause/Resume** | Toggle `status` so the listing is hidden / shown | ❌ DB-only, token auth |
| 5 | **Monitor**   | Recent skill invocations, x402 revenue, reputation (roadmap) | ❌ Read-only |

### Design principle — "Sign once, govern forever"

The merchant signs a wallet transaction **only once**, at initial registration.
That tx anchors identity on-chain. Everything after (menu tweaks, closing for a
day, adding a new skill) is plain API with wallet-bound auth headers. No gas,
no signing friction, no crypto fatigue.

---

## 2. Onboard — First-time registration

This is the **only flow that requires a wallet signature**. Because agents must
never touch private keys, the signing step happens in the merchant's browser
via MetaMask. The agent's job is to **collaboratively prepare a clean profile
draft**, then hand off to the web console for signing.

### 2.1 Collaborative draft (human-in-the-loop, MANDATORY)

Do **NOT** write to the registry based on agent memory alone. The merchant's
assistant (that's you) should:

1. **Read agent memory** for any business-related context: owner has mentioned
   a shop name, location, hours, menu items, etc.
2. **Ask the owner** to fill gaps. Minimum required set:
   ```
   - merchant_type    (hotel | restaurant | attraction | shop)
   - name_en, name_zh (bilingual — fall back to same value if monolingual)
   - description (1-2 sentences — what makes this place special)
   - city, country, full address
   - contact_phone, contact_email
   - opening_hours
   - supported_skills (pick from the catalog below)
   - specific_fields  (cuisine_type / star_rating / ticket_price / etc.)
   ```
3. **Show the full draft to the owner** in one clean readable block.
   Ask literally: **"Please review this draft carefully. Change anything?
   Say 'confirmed' to proceed to signing."**
4. **Never** advance to signing without explicit owner confirmation of the
   finalized draft. This is a **hard rule**, not a suggestion.

### 2.2 Supported skills catalog (pick what this merchant offers)

| Merchant type | Available skills |
|---|---|
| **hotel** | `check_availability`, `get_rates`, `create_booking`, `get_cancellation_policy` |
| **restaurant** | `check_table_availability`, `get_menu`, `reserve_table`, `get_dietary_options` |
| **attraction** | `check_ticket_inventory`, `get_opening_hours`, `purchase_ticket`, `get_visitor_guide` |

Do not invent skill names. If the owner wants a skill not in this list, tell
them "that one's on the roadmap — for now please pick from the supported set."

### 2.3 Write the draft + hand off to browser for signing

Once the owner confirms:

```http
POST ${TOURSKILL_API_BASE}/v1/merchants
Content-Type: application/json

{ ...the confirmed draft above... }
```

Response:
```jsonc
{
  "message": "Merchant registered successfully",
  "data": {
    "merchant_id": "merchant:xxxxxxxxxxxx",   // ← persist this to env as MERCHANT_ID
    "did": "did:tourskill:merchant:xxxxxxxxxxxx",
    "status": "active",
    // ... everything else
  }
}
```

Then tell the owner:

> "Draft saved. Final step: sign the on-chain registration. Please open this URL
> in your browser and connect MetaMask —
> **`${TOURSKILL_CONSOLE_BASE}/merchant/sign/${merchant_id}`**
>
> You'll see your profile summary one more time, then a single MetaMask popup.
> After you sign, your listing is live on the 0G Galileo testnet."

**Why this step happens in the browser, not here**: agents must never hold
private keys. The web console uses MetaMask (or any EIP-1193 wallet) so the
owner signs themselves — not you.

After the owner signs, the web console writes `register_tx_hash` back to the
backend. Once that's done, `GET /v1/merchants/${merchant_id}` will include
`register_tx_hash` pointing to the on-chain tx.

### 2.4 Persist the merchant_id for future ops

After onboard, set:
```
MERCHANT_ID=merchant:xxxxxxxxxxxx
```

All subsequent verbs assume `MERCHANT_ID` is already set. If the owner has
multiple listings, list them first (see §3) and ask which one to operate on.

---

## 3. Introspect — Show my listing(s)

Read-only, no auth. Anyone (including the owner) can query this.

### List all merchants owned by this wallet

```http
POST ${TOURSKILL_API_BASE}/v1/discover
Content-Type: application/json

{ "wallet": "${MERCHANT_WALLET_ADDRESS}", "limit": 100 }
```

Returns all merchants whose `wallet_address` matches. Render a compact table:

```
Your 3 TourSkill listings
─────────────────────────
[hotel]      ⭐⭐⭐⭐⭐ Amanfayun (安缦法云)         · Hangzhou   · active
[restaurant] ¥¥¥     Louwailou (楼外楼)           · Hangzhou   · active
[attraction] ¥¥      West Lake (西湖风景区)        · Hangzhou   · active
```

### Get full detail for one merchant

```http
GET ${TOURSKILL_API_BASE}/v1/merchants/${MERCHANT_ID}
```

Returns the full profile + on-chain fields (`wallet_address`, `profile_hash`,
`register_tx_hash`, `skill_endpoint`). Show the owner:

- basic info (name, type, address)
- declared skills
- on-chain status — "Registered on 0G testnet at tx 0x…" (include a chainscan
  link: `https://chainscan-galileo.0g.ai/tx/${register_tx_hash}`)
- current `status` (active / inactive)

---

## 4. Update — Change profile fields

No signing. Authenticates via wallet header.

```http
PATCH ${TOURSKILL_API_BASE}/v1/merchants/${MERCHANT_ID}
Content-Type: application/json
X-Wallet-Address: ${MERCHANT_WALLET_ADDRESS}

{
  "opening_hours": "09:00-23:00",
  "tags": ["Zhejiang", "home-style", "vegetarian-friendly"],
  "specific_fields": { "avg_spend": 80, "signature_dishes": [...] }
}
```

Only fields present in the body are updated (partial patch). Backend rejects
with `403` if `X-Wallet-Address` doesn't match the merchant's owner wallet.

### Allowed fields

```
name_en, name_zh, description_en, description_zh,
address, latitude, longitude,
contact_phone, contact_email, opening_hours, website_url,
price_level, tags, languages_supported,
supported_skills, specific_fields
```

### Owner confirmation still matters

Even though no signing is required, still show the owner a **diff** before
sending the PATCH:

```
Proposed changes to Louwailou:
  opening_hours:  "11:00-21:00"  →  "09:00-23:00"
  tags:  added "vegetarian-friendly"

Confirm? (yes / cancel / edit)
```

This prevents typos and keeps the owner in the loop.

---

## 5. Pause / Resume — Toggle visibility

Same PATCH endpoint. Change `status` between `'active'` and `'inactive'`.

When status is `'inactive'`:
- `POST /v1/discover` skips this merchant entirely
- User agents get zero results — the shop is invisible
- The on-chain record still exists; nothing is deleted

### Pause

```http
PATCH ${TOURSKILL_API_BASE}/v1/merchants/${MERCHANT_ID}
X-Wallet-Address: ${MERCHANT_WALLET_ADDRESS}
Content-Type: application/json

{ "status": "inactive" }
```

Tell the owner: *"Your listing is now hidden. Visitors' agents will not see
it. Your on-chain registration is unchanged. Say 'resume' anytime to bring
it back."*

### Resume

```http
PATCH ${TOURSKILL_API_BASE}/v1/merchants/${MERCHANT_ID}
X-Wallet-Address: ${MERCHANT_WALLET_ADDRESS}

{ "status": "active" }
```

---

## 6. Monitor — Skill call history, x402 revenue, reputation

**Roadmap — not yet live.** When available, this section will expose:

- `GET /v1/merchants/${MERCHANT_ID}/calls?since=...` — recent skill invocations
- `GET /v1/merchants/${MERCHANT_ID}/revenue` — x402 settlement totals
- `GET /v1/merchants/${MERCHANT_ID}/reputation` — on-chain reputation score

For now, if the owner asks about traffic or earnings, tell them: *"Monitoring
dashboard ships in a future release. For now, inbound traffic is visible via
the chainscan event log for the registry contract."* Link them to:
`https://chainscan-galileo.0g.ai/address/0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543`

---

## 7. Hard Rules (do not violate)

1. **Never write or sign on behalf of the owner without explicit confirmation
   of the fully-rendered draft.** Agents hallucinate; confirmation is the guard.
2. **Never touch the owner's private key.** For first-time registration,
   direct them to the web console for MetaMask signing. No exceptions.
3. **Never serve user-side verbs** (discover / invoke merchant skill). If the
   human operator asks for customer stuff, point them at `user-client/SKILL.md`.
4. **Wallet-header auth is MVP-only.** Until SIWE ships, updates are protected
   only by matching `X-Wallet-Address` to the owner wallet. This is acceptable
   on testnet but **must be upgraded to signed nonces before any mainnet
   migration** — treat it as a roadmap dependency.
5. **Always show the chainscan URL** for the register tx when the owner asks
   about provenance. That's the merchant's permanent on-chain receipt.
6. **Pause is not delete.** Explain the difference when the owner asks to
   "close the shop permanently" — the on-chain record stays forever (that's
   the point of the registry). Pausing just hides the listing from consumers.

---

## 8. Install URL

Share with any merchant-side AI agent:

> "Install the TourSkill merchant skill from
> **`https://api.tourskill.paking.xyz/skills/merchant-client/SKILL.md`**"

Pairs with the user-side skill at
`https://api.tourskill.paking.xyz/skills/user-client/SKILL.md`.
