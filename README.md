<h1 align="center">Concourse</h1>

<p align="center">
  <strong>An open protocol layer where AI agents discover, verify, and transact directly.<br />Agent-to-Agent. Peer-to-Peer. No platform in the critical path.</strong>
</p>

<p align="center">
  <em>Built on ERC-8004 Trustless Agents · A2A Agent Card · x402 micropayments.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concourse-protocol/discover"><img src="https://img.shields.io/npm/v/@concourse-protocol/discover?label=%40concourse-protocol%2Fdiscover&color=cb3837" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" /></a>
  <a href="https://github.com/PakHeiPoon/Concourse/actions"><img src="https://img.shields.io/github/actions/workflow/status/PakHeiPoon/Concourse/publish-discover-cli.yml?label=CI" alt="CI" /></a>
  <a href="./README_ZH.md"><img src="https://img.shields.io/badge/中文-Readme-orange" alt="中文" /></a>
</p>

---

## Thesis

> Concourse is a falsifiable proof that AI agents can **discover, verify, and transact** with each other **without any platform intermediary** in the operational critical path.

If you can complete a booking using only a public Base RPC, SHA-256, and HTTPS — Concourse the company is operationally dispensable. That is the point.

## The 4-step protocol

```
┌─────────────────────────────────────────────────────────────────┐
│  ① DISCOVER   eth_call → IdentityRegistry.getAgent(id)          │
│  ② FETCH      GET cardURI                                       │
│  ③ VERIFY     sha256(bytes) == cardHash ?       → no → ABORT    │
│  ④ INVOKE     POST card.url + skill.endpoint                    │
└─────────────────────────────────────────────────────────────────┘
```

Every step talks to **either Base chain RPC or the merchant's own URL**. No Concourse-operated server sits in between.

## Quick start (zero install)

```bash
# List every agent on the registry
npx -y @concourse-protocol/discover list

# Fetch + SHA-256 verify a card against the on-chain commit
npx -y @concourse-protocol/discover fetch 1

# Show available skills (verified before display)
npx -y @concourse-protocol/discover skills 1

# Invoke a skill end-to-end (verify → POST with auto Idempotency-Key)
npx -y @concourse-protocol/discover invoke 1 check_availability \
  -d '{"check_in":"2026-09-01","check_out":"2026-09-03","room_type":"mountain_view"}'
```

Defaults to Base Sepolia + the canonical IdentityRegistry at `0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f`. Override with `CONCOURSE_RPC_URL`, `CONCOURSE_REGISTRY`, `CONCOURSE_CHAIN_ID`.

## MCP server (Claude Desktop / Cursor / any MCP host)

```json
{
  "mcpServers": {
    "concourse": {
      "command": "npx",
      "args": ["-y", "@concourse-protocol/discover", "concourse-mcp"]
    }
  }
}
```

Exposes 4 tools — `concourse_list_agents`, `concourse_verify_card`, `concourse_list_skills`, `concourse_invoke_skill`. Every call begins with on-chain SHA-256 verification.

## Architecture

```
                  ON-CHAIN  ·  Base Sepolia                           
       ┌──────────────────────────────────────────────┐
       │  IdentityRegistry  ·  0xBdE5…A29f (immutable)│
       │  ReputationRegistry  ·  ValidationRegistry   │
       │  struct Agent { owner, cardURI, cardHash,    │
       │                 registeredAt, updatedAt,     │
       │                 active }                     │
       └──────────────────────────────────────────────┘
                ▲                              ▲
                │ getAgent(id)                 │ register / update
                │                              │ (merchant signs)
                ▼                              ▼
   ┌─────────────────────┐         ┌────────────────────────────┐
   │   USER AGENT  · AI  │ ◄────► │  MERCHANT AGENT · self-host │
   │   (Claude/Cursor)   │  HTTPS  │  Hono + Drizzle + viem      │
   │   loads SKILL.md as │         │  /.well-known/agent-card    │
   │   protocol manual   │         │  /auth/challenge · /verify  │
   └─────────────────────┘         │  /skills/<name>             │
                                   └────────────────────────────┘

           ⚠️ NO Concourse-controlled gateway between any of these layers
```

## What's in this repo

| Path | What it is |
|---|---|
| [`contracts/erc8004/`](./contracts/erc8004/) | Foundry — `IdentityRegistry` + `ReputationRegistry` + `ValidationRegistry` + tests + Deploy script. Solidity 0.8.24, evmVersion `cancun`, 73 tests at 100% coverage. |
| [`merchant-agent-template/`](./merchant-agent-template/) | Open-source reference implementation a merchant clones to become a sovereign agent. Hono + Drizzle + better-sqlite3 + viem. EIP-191 auth, canonical-JSON cards, SHA-256 anchored on chain. |
| [`packages/discover-cli/`](./packages/discover-cli/) | `@concourse-protocol/discover` — CLI + MCP server. The executable form of `SKILL.md`. Auto-publishes on `discover-cli-v*` tag push. |
| [`backend/skills/`](./backend/skills/) | Two SKILL.md files. `user-client/SKILL.md` teaches an AI agent the protocol; `merchant-client/SKILL.md` teaches it how to onboard a merchant. **The SKILL files are the protocol manuals — load them into any LLM, they don't need this repo to function.** |
| [`docs/architecture/`](./docs/architecture/) | Design notes — agent-card schema, reputation model, x402 payment flow, migration plan. |
| [`frontend/`](./frontend/) | Reference UI at [concourse.paking.xyz](https://concourse.paking.xyz). Reads `IdentityRegistry` directly via ethers v6 — no backend proxy. |
| [`backend/`](./backend/) | Optional FastAPI side-service (auth helpers + indexer cache for the reference UI). The protocol does not depend on it. |

## Releases

| Resource | URL |
|---|---|
| npm | https://www.npmjs.com/package/@concourse-protocol/discover |
| GitHub Releases | https://github.com/PakHeiPoon/Concourse/releases |
| Live agent #1 | https://wumingchu.concourse.paking.xyz/.well-known/agent-card.json |
| Live indexer UI | https://concourse.paking.xyz |

## Roadmap

| Status | Phase |
|---|---|
| ✅ Live | ERC-8004 contracts on Base Sepolia, Basescan-verified, 73 tests passing |
| ✅ Live | Merchant agent template (Hono + viem + EIP-191 auth, 5 hotel skills) |
| ✅ Live | First agent — Wuming Chu · Huangshan (agentId=1) |
| ✅ Live | Trustless `/explorer` — reads chain directly, browser-side SHA-256 verification |
| ✅ Live | `@concourse-protocol/discover` CLI + MCP — zero-install protocol client |
| 🟡 Building | Canonical mainnet via shared ERC-8004 address |
| 🟡 Building | EIP-191 signed bearer auth in CLI |
| 📋 Planned | x402 paid-skill USDC micropayments (EIP-3009) |
| 📋 Planned | BookingEscrow (EIP-712 Seaport-style) + settlement-gated ReputationRegistry hook |
| 📋 Planned | Multi-tenant SaaS hosting for non-technical merchants |

See [`docs/architecture/07_MIGRATION_PLAN.md`](./docs/architecture/07_MIGRATION_PLAN.md) for the full plan.

## Prove the platform is dispensable (adversarial test)

```bash
# 1. Pick any third-party RPC — not concourse.paking.xyz
export CONCOURSE_RPC_URL=https://base-sepolia.public.blastapi.io

# 2. Black-hole the Concourse frontend (optional)
echo "0.0.0.0  concourse.paking.xyz" | sudo tee -a /etc/hosts

# 3. Run the full discover → verify → invoke loop. It should still succeed.
npx -y @concourse-protocol/discover list
npx -y @concourse-protocol/discover invoke 1 get_room_types
```

If this ever fails, the thesis is falsified — file an issue.

## License

[MIT](./LICENSE) — Copyright © 2026 Pak Hei Poon and Concourse Protocol contributors.

---

<p align="center">
  <sub>Because your next transaction should be between you and the merchant, not you and a platform.</sub>
</p>
