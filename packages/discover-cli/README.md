# @concourse-protocol/discover

Discover, verify, and invoke ERC-8004 / A2A agents directly from chain. No platform required.

This CLI is the executable form of [`backend/skills/user-client/SKILL.md`](../../backend/skills/user-client/SKILL.md). Where the SKILL file teaches an LLM the protocol, this CLI lets a human or script speak it. Both paths bottom out at the same primitives: Base RPC, HTTPS, SHA-256.

## Install (alpha)

```bash
# zero-install (once published)
npx -y @concourse-protocol/discover list

# global
npm i -g @concourse-protocol/discover
concourse-discover list

# from source
cd packages/discover-cli && pnpm install && pnpm dev list
```

Requires Node ≥ 20.

## MCP server (Claude Desktop / Cursor / any MCP host)

Add this snippet to your MCP host config (Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

The MCP server exposes four tools that an LLM can call:

| Tool | Purpose |
|---|---|
| `concourse_list_agents` | Read IdentityRegistry on chain |
| `concourse_verify_card` | Fetch + SHA-256 verify against on-chain commit |
| `concourse_list_skills` | List skills exposed by a verified agent |
| `concourse_invoke_skill` | Verify-then-POST with auto Idempotency-Key |

Every call begins with on-chain verification. No host can serve tampered bytes without the tool aborting.

## Commands

### `list`

Read every agent on the IdentityRegistry. Default hides inactive entries.

```bash
pnpm dev list                # human-readable
pnpm dev list --all          # include inactive
pnpm dev list --json         # machine-readable
```

Reads on-chain. **No Concourse-operated server is involved.**

## Environment

All optional — defaults match the Base Sepolia deployment described in [`SKILL.md`](../../backend/skills/user-client/SKILL.md).

| Variable | Default |
|---|---|
| `CONCOURSE_RPC_URL` | `https://sepolia.base.org` |
| `CONCOURSE_REGISTRY` | `0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f` |
| `CONCOURSE_CHAIN_ID` | `84532` |

Swap any of these to point at a different chain or RPC provider. The CLI does not depend on any Concourse-operated infrastructure.

## Roadmap

- [x] `list` against on-chain IdentityRegistry
- [x] `fetch <id>` + SHA-256 verify (ABORT on mismatch)
- [x] `skills <id>` + `invoke <id> <skill>` with auto Idempotency-Key
- [x] MCP server wrap (`@modelcontextprotocol/sdk` stdio)
- [ ] Adversarial test script (kill Concourse infra, verify protocol still works)
- [ ] EIP-191 signed bearer auth flow
- [ ] x402 paid-skill handshake

## Release flow

After the initial publish, every release is fully automated by [`.github/workflows/publish-discover-cli.yml`](../../.github/workflows/publish-discover-cli.yml):

```bash
# 1. bump version (semver)
cd packages/discover-cli
npm version patch              # or minor / major / prerelease

# 2. tag with the workflow-specific prefix
TAG="discover-cli-v$(jq -r .version package.json)"
git add package.json && git commit -m "release: $TAG"
git tag "$TAG"
git push --follow-tags

# 3. GitHub Actions runs typecheck → build → version-sanity-check → npm publish --provenance
```

Required GitHub repo secret: `NPM_TOKEN` (npm "Automation" token; bypasses 2FA on CI).

## License

MIT — see [LICENSE](./LICENSE).
