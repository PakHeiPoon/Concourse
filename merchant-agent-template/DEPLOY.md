# Deploy guide

The template is a plain Node 20+ Hono app. It runs on anything that runs
Node, plus the SQLite file (or any Postgres URL via a custom store).

This guide covers three paths:

1. [Local prod-like](#1-local-prod-like) — `pnpm build` + `pnpm start`
2. [Self-hosted on a VPS](#2-self-hosted-vps-fly-railway-aws-) — long-lived process behind TLS
3. [Vercel](#3-vercel) — for merchants with low write volume; switch to Postgres before deploy

After deploying, finish with [Post-deploy: register on-chain](#4-post-deploy-register-on-chain).

---

## 1. Local prod-like

```bash
cd apps/agent
cp .env.example .env       # set PUBLIC_URL, payout wallet, etc.
pnpm install
pnpm setup                 # one-time: seed inventory + calendar
pnpm build
pnpm start                 # node dist/index.js
```

Now `http://localhost:8787/.well-known/agent-card.json` returns your card.

For external testing, expose with `cloudflared tunnel --url http://localhost:8787`
or `ngrok http 8787` and set `PUBLIC_URL` to the tunnel URL before
re-starting (the URL is embedded in the card hash, so it must match what
clients see).

## 2. Self-hosted (VPS / Fly / Railway / AWS …)

Recommended for any merchant with > ~50 bookings/day or PII concerns.
SQLite + a single VM is fine up to a few thousand bookings/day.

**Required env vars** (see `apps/agent/.env.example` for the full list with
how-to-get notes):

```
NODE_ENV=production
PORT=8787
PUBLIC_URL=https://agent.your-domain.com
AGENT_OWNER=0xYourWallet
PAYOUT_ADDRESS=0xYourPayoutWallet
CHAIN_ID=84532                    # 84532 = Base Sepolia, 8453 = Base mainnet
RPC_URL=https://sepolia.base.org
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # Base Sepolia USDC
IDENTITY_REGISTRY=0x…             # filled after Phase A.2 deploy
REPUTATION_REGISTRY=0x…
STORE_URL=file:./data/agent.db
```

**Process model:**

```bash
# Build once on the VM (or in CI):
pnpm install --frozen-lockfile
pnpm --filter agent build

# Run under a supervisor:
NODE_ENV=production node apps/agent/dist/index.js
```

Use systemd / pm2 / Fly machine / Railway service / ECS. Health check is
`GET /health`. Persist `apps/agent/data/` if you stay on SQLite.

**TLS:** terminate at the edge (Caddy, Cloudflare Tunnel, ALB). The card
URL **must** be HTTPS for clients that verify the on-chain SHA-256 hash.

## 3. Vercel

Works for read-heavy / low-write merchants. The default SQLite driver
will not survive serverless cold starts — switch to Postgres:

1. Provision Postgres (Neon, Supabase, Railway).
2. Implement a `PostgresStore` against `MerchantStore`. Drizzle is already
   in deps; the schema in `src/stores/schema.ts` works on Postgres with
   minimal tweaks (replace `integer({ mode: 'boolean' })` and
   `integer({ mode: 'timestamp' })` with `boolean()` and `timestamp()`).
3. Set `STORE_DRIVER=postgres`, `STORE_URL=postgres://…` in Vercel env.
4. `vercel --prod` from `apps/agent`.

Vercel function timeout default (300s) is plenty for these handlers.

## 4. Post-deploy: register on-chain

The agent-card alone does nothing — clients need to find you via
`IdentityRegistry`.

**One-time, after the URL is live:**

```bash
# 1. Compute card hash + URL
curl -s $PUBLIC_URL/.well-known/agent-card.json -i | grep X-Card-SHA256
# → X-Card-SHA256: 0x<32-byte hex>

# 2. Call IdentityRegistry.register(uri, hash) from AGENT_OWNER wallet
#    Phase A.4 of this template wires `pnpm sync-card` to do this for you.
```

Verify discovery:

```bash
cast call $IDENTITY_REGISTRY 'getAgent(uint256)' <agentId> --rpc-url $RPC_URL
```

When you change the agent-card (update inventory, change payout wallet,
add skills), recompute the hash and call `update(id, uri, newHash)` from
the same wallet. The card URL itself can stay constant.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `pnpm test` fails with `bindings.js: Could not locate the bindings file` | better-sqlite3 native binding not built — run `pnpm rebuild better-sqlite3` |
| `tsc` errors about `rootDir` and tests | `tsconfig.json` should have **no** `rootDir`. Production rootDir is in `tsconfig.build.json` only |
| Card hash mismatch on chain | `PUBLIC_URL` env var doesn't match the URL clients fetched. Re-canonicalize with the deployed URL, then `update()` |
| 401 on `/skills/<x>` for an unauthenticated caller | Skill explicitly opts into auth. By default skills accept anonymous calls |
| `IDEMPOTENCY_KEY_REQUIRED` from `create_booking` | Always send `Idempotency-Key: <unique-string>` for state-changing skills. This is mandatory by design — see `docs/architecture/04_MERCHANT_AGENT_TEMPLATE.md` |
