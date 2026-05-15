# Deployed contract addresses

Living record of every Concourse contract deployment. Append a new
section per deploy; never delete entries — old addresses stay
discoverable for forensic / archival reasons.

---

## Live agents on Base Sepolia

| agentId | owner | URI | hash | active | notes |
|---|---|---|---|---|---|
| **1** | `0x56b0666c4fe6F3BA5572aC7AC99AF7Ede58b67b4` | `https://wumingchu.concourse.paking.xyz/.well-known/agent-card.json` | `0x26219e91…22f7bd` | ✅ active | Wuming Chu · Huangshan. Originally registered at `wumingchu.tourskill.paking.xyz` (hash `0x1304af2b…22f114`); migrated 2026-05-15 via `update(1, …)` tx [`0x95316b23…1a6efe`](https://sepolia.basescan.org/tx/0x95316b23f0002d262facebc05586cb996a55f4b845f4291d6b2725b0e61a6efe). |
| 2 | `0x56b0666c4fe6F3BA5572aC7AC99AF7Ede58b67b4` | `https://wumingchu.concourse.paking.xyz/.well-known/agent-card.json` | `0x26219e91…22f7bd` | 🚫 retired | Accidental duplicate produced by sync-card pre-guardrail (empty `AGENT_ID=` line). Deactivated 2026-05-15 via `setActive(2, false)` tx [`0x3f78be1e…b5c69e7`](https://sepolia.basescan.org/tx/0x3f78be1e5662a40c4b585c3ce9c43a076b9bb6e8aba2cee954a63ef79b5c69e7). Kept on chain (immutable history). |

> Live snapshot: `cast call --rpc-url https://sepolia.base.org 0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f 'getAgent(uint256)((address,string,bytes32,uint64,uint64,bool))' 1`

---

## Base Sepolia (chainId 84532)

### Phase A.2 — ERC-8004 registries (deployed 2026-05-06)

| Contract | Address | Constructor args | Tx |
|---|---|---|---|
| `IdentityRegistry` | `0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f` | (none) | [`0xe0018be5…83a937`](https://sepolia.basescan.org/tx/0xe0018be5363b38b019d34e3114a554b705dea5862ec2991fd86815a18983a937) |
| `ReputationRegistry` | `0xcaC08083B58c7736bDf953dafeC3C3395f0D90c6` | identity + `0x…dEaD` escrow placeholder | [`0xeca406bd…86bf4a`](https://sepolia.basescan.org/tx/0xeca406bd4a7c6ac349e756932bd4552958a9ff2260d38f50260b34877e86bf4a) |
| `ValidationRegistry` | `0x60B0E530621488C985A394686F3E54282D579107` | identity | [`0x88ef9bdd…bc77ba`](https://sepolia.basescan.org/tx/0x88ef9bdd902bdca43cdf9f20039ebeaaec1b7357724accfd5477eec6e5bc77ba) |

**Compiler:** solc 0.8.24, evmVersion `cancun`, optimizer 200 runs.
**Deployer:** `0x56b0666c4fe6F3BA5572aC7AC99AF7Ede58b67b4`.
**Block:** `0x273e210` (41,476,624) — all three contracts in one block.
**Verified:** ✅ all three on Basescan
([Identity](https://sepolia.basescan.org/address/0xbde5a55d50d2062ff5529546d8c391f6a6eea29f#code) ·
[Reputation](https://sepolia.basescan.org/address/0xcac08083b58c7736bdf953dafec3c3395f0d90c6#code) ·
[Validation](https://sepolia.basescan.org/address/0x60b0e530621488c985a394686f3e54282d579107#code)).

#### Live wiring sanity (read at deploy time)

```
totalAgents() on IdentityRegistry              → 0
identityRegistry() on ReputationRegistry      → 0xBdE5...A29f
bookingEscrow()    on ReputationRegistry      → 0x...dEaD  (placeholder)
identityRegistry() on ValidationRegistry      → 0xBdE5...A29f
```

#### Notes

- `ReputationRegistry.bookingEscrow` is `immutable` and points at the
  burn address. `autoAuthorizeFromBooking()` is callable only by
  `bookingEscrow`, so it's physically unreachable until we redeploy
  ReputationRegistry pointing at the real escrow contract.
- BookingEscrow is **not** part of Phase A.2 — by design. See
  [`05_X402_PAYMENT_FLOW.md` § Scope](./05_X402_PAYMENT_FLOW.md) for the
  decision to defer it (it's a Block 2 problem with a different wire
  format than x402).

---

## Base mainnet (chainId 8453)

> Not deployed. Phase B-min (x402 paid-skill MVP) has to ship and pass a
> testnet shakedown before we touch mainnet — and `ReputationRegistry`
> with the dEaD placeholder will never deploy to mainnet (we redeploy
> against a real escrow first).

---

## How to use these in the merchant-agent template

Set in `apps/agent/.env`:

```
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
IDENTITY_REGISTRY=0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f
REPUTATION_REGISTRY=0xcaC08083B58c7736bDf953dafeC3C3395f0D90c6
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Then `pnpm sync-card --dry-run` should produce a hash; `pnpm sync-card`
(with `SYNC_PRIVATE_KEY` set) will register your agent against
`IdentityRegistry`.
