# merchant-agent-template

A drop-in template for hotels, restaurants, attractions, and shops to launch
their own **A2A-compliant agent** on the TourSkill network.

> **Status (2026-05):** Phase A — agent-card + skill execution + EIP-191 auth.
> Phase B (x402 payment + BookingEscrow) and Phase C (reputation flow) build
> on this template; you do **not** need to fork to upgrade.

---

## What this is

A small Hono app that exposes:

| Endpoint | Purpose |
|---|---|
| `GET  /health` | Liveness probe |
| `GET  /.well-known/agent-card.json` | A2A agent-card (canonical JSON, SHA-256 hash header) |
| `POST /auth/challenge` | EIP-191 challenge for a wallet address |
| `POST /auth/verify` | Verify signature, mint opaque bearer token |
| `POST /skills/<each>` | One route per skill in `src/routes/skills/` |

Five reference skills ship out of the box (hotel domain, but easy to swap):

- `check_availability` — quote a stay
- `get_rates` — calendar of nightly rates
- `create_booking` — reserve a room (Phase A: `pending` status; Phase B: x402-locked)
- `get_room_types` — list active inventory
- `get_cancellation_policy` — surface refund tiers

Everything is **strict-typed end-to-end**: Zod input/output schemas drive
both runtime validation and the JSON Schema embedded in the agent-card.

## Why you'd use it

Running an agent on TourSkill means:

1. Anyone (other agents, end-user wallets) can discover you via your
   on-chain ERC-8004 record + agent-card.
2. Booking traffic settles to the wallet you control. There is **no
   protocol fee** — TourSkill itself charges only for hosting (free tier
   covers small merchants; see `docs/architecture/09_BUSINESS_MODEL.md`).
3. Reputation is portable — feedback from settled bookings lives on
   `ReputationRegistry`, not in any platform's silo.

## Quick start

```bash
pnpm install
cd apps/agent
cp .env.example .env        # edit AGENT_OWNER, payout wallet, etc.
pnpm setup                  # seeds inventory + 90-day calendar (Wuming Chu demo data)
pnpm dev                    # http://localhost:8787
```

Smoke test:

```bash
curl -s http://localhost:8787/.well-known/agent-card.json | jq .
curl -s -X POST http://localhost:8787/skills/check_availability \
  -H 'Content-Type: application/json' \
  -d '{"check_in":"2026-05-10","check_out":"2026-05-12","room_type":"mountain_view"}' | jq .
```

## Customize for your business

1. **Replace seed data.** Edit `apps/agent/src/scripts/setup.ts`:
   - `settings` block → name, location, payment payout, cancellation policy
   - `roomTypes` → your inventory
   - `calendar` → starting availability
2. **Tweak skills** under `apps/agent/src/routes/skills/`. Each file is
   self-contained: input schema, output schema, handler. Add a new skill
   by dropping a file in that directory and re-exporting it from
   `skill_loader.ts`.
3. **Swap the store.** `MerchantStore` is the seam. Default is SQLite
   (`apps/agent/src/stores/sqlite.ts`). For Postgres, write a
   `PostgresStore` against the same interface; nothing else changes.
4. **Plug in an LLM** (optional). Set `LLM_PROVIDER`, `LLM_API_KEY`,
   `LLM_MODEL` in `.env`. Skills can opt in via `ctx.llm` for
   things like natural-language room-recommendation responses.

## Auth: EIP-191 challenge → bearer token

Skills can stay public, or they can require `Authorization: Bearer <token>`.
Token issuance is one round-trip:

```
POST /auth/challenge   { wallet_address }              → { nonce, message }
# user signs `message` with their wallet, returns 0x… signature
POST /auth/verify      { wallet_address, nonce, signature }
                                                        → { token, expiresAt }
```

Tokens are opaque, in-memory by default, and tied to the wallet that
signed. The wallet is exposed to the skill handler as `ctx.caller`.

## Hosting options

| | Self-hosted | Platform-hosted |
|---|---|---|
| **You manage** | Server, db, secrets, on-chain card sync | None — push to git |
| **Cost** | Your hosting bill | Free tier (≤100 bookings/mo) |
| **Privacy** | Full | Standard SOC2 |
| **Deploy** | Any Node 20+ host (Vercel/Fly/Railway/AWS) | One-click via TourSkill console |

This template is the same code in both modes — only env vars differ.

## File map

```
apps/agent/
├── package.json
├── tsconfig.json            # editor / typecheck (no rootDir, includes tests)
├── tsconfig.build.json      # production build (rootDir=src, excludes tests)
├── vitest.config.ts
├── .env.example
├── src/
│   ├── index.ts             # Hono entry
│   ├── core/
│   │   ├── auth.ts          # EIP-191 challenge + bearer tokens
│   │   ├── card.ts          # agent-card builder + canonical JSON + SHA-256
│   │   ├── config.ts        # dotenv → AgentConfig
│   │   ├── dates.ts
│   │   ├── skill.ts         # defineSkill helper
│   │   └── types.ts         # MerchantStore, SkillDef, SkillContext, SkillError
│   ├── routes/
│   │   ├── skill_loader.ts  # static imports of all skills
│   │   └── skills/          # one file per skill
│   ├── stores/
│   │   ├── schema.ts        # Drizzle schema
│   │   └── sqlite.ts        # default MerchantStore impl
│   └── scripts/
│       ├── setup.ts         # seed inventory + calendar
│       └── sync-card.ts     # push agent-card to ERC-8004 IdentityRegistry
└── tests/
    ├── auth.test.ts
    ├── card.test.ts
    ├── skills.test.ts
    └── store.test.ts
```

## Scripts

```bash
pnpm dev          # tsx watch
pnpm test         # vitest run
pnpm typecheck    # strict tsc, no emit
pnpm build        # emit dist/
pnpm setup        # seed sample inventory
pnpm sync-card    # (Phase A.4) register/update agent-card on-chain
```

## Roadmap

- **Phase A** ✅ template + agent-card + 5 skills + auth
- **Phase A.4** sync-card → ERC-8004 IdentityRegistry on Base Sepolia
- **Phase B** x402 middleware + BookingEscrow integration
- **Phase C** ReputationRegistry: settled bookings auto-authorize feedback
- **Phase D** validator marketplace (ValidationRegistry)

See `docs/architecture/` at the repo root for the full design.

## Deploy

See [DEPLOY.md](./DEPLOY.md).
