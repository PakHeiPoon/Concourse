<h1 align="center">Concourse</h1>

<p align="center">
  <strong>一个开放的协议层 — AI agent 直接发现、验证、交易。<br />Agent-to-Agent · Peer-to-Peer · 关键路径上没有任何平台。</strong>
</p>

<p align="center">
  <em>基于 ERC-8004 Trustless Agents · A2A Agent Card · x402 micropayments。</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concourse-protocol/discover"><img src="https://img.shields.io/npm/v/@concourse-protocol/discover?label=%40concourse-protocol%2Fdiscover&color=cb3837" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" /></a>
  <a href="https://github.com/PakHeiPoon/Concourse/actions"><img src="https://img.shields.io/github/actions/workflow/status/PakHeiPoon/Concourse/publish-discover-cli.yml?label=CI" alt="CI" /></a>
  <a href="./README.md"><img src="https://img.shields.io/badge/English-Readme-blue" alt="English" /></a>
</p>

---

## 论文命题

> Concourse 是一个**可证伪的证明**：AI agent 之间能够**发现、验证、交易**——**运行的关键路径上不需要任何中介平台**。

如果你能只用「公开 Base RPC + SHA-256 + HTTPS」三个原语完成一次预订，那 Concourse 这家公司在运行层面就是可替代的。**这就是设计目标本身**。

## 四步协议

```
┌─────────────────────────────────────────────────────────────────┐
│  ① 发现 DISCOVER   eth_call → IdentityRegistry.getAgent(id)     │
│  ② 获取 FETCH      GET cardURI                                  │
│  ③ 验证 VERIFY     sha256(bytes) == cardHash ?   → no → 终止    │
│  ④ 调用 INVOKE     POST card.url + skill.endpoint               │
└─────────────────────────────────────────────────────────────────┘
```

每一步只跟「Base 链 RPC」或「商家自家服务器」对话。**全程 0 个 Concourse-controlled 中间人**。

## 立即试用（零安装）

```bash
# 列出所有链上 agent
npx -y @concourse-protocol/discover list

# 拉商家 card 并对链上 SHA-256 commit 验证
npx -y @concourse-protocol/discover fetch 1

# 查 agent 暴露的 skills（验证通过才显示）
npx -y @concourse-protocol/discover skills 1

# 调用 skill（先 verify 再 POST，自动注入 Idempotency-Key）
npx -y @concourse-protocol/discover invoke 1 check_availability \
  -d '{"check_in":"2026-09-01","check_out":"2026-09-03","room_type":"mountain_view"}'
```

默认 Base Sepolia + IdentityRegistry `0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f`。环境变量 `CONCOURSE_RPC_URL` / `CONCOURSE_REGISTRY` / `CONCOURSE_CHAIN_ID` 可覆盖。

## MCP 服务器（Claude Desktop / Cursor 等）

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

暴露 4 个 tool：`concourse_list_agents` · `concourse_verify_card` · `concourse_list_skills` · `concourse_invoke_skill`。每次调用都从链上 SHA-256 验证开始。

## 架构

```
                  ON-CHAIN  ·  Base Sepolia
       ┌──────────────────────────────────────────────┐
       │  IdentityRegistry  ·  0xBdE5…A29f（不可变）  │
       │  ReputationRegistry  ·  ValidationRegistry   │
       │  struct Agent { owner, cardURI, cardHash,    │
       │                 registeredAt, updatedAt,     │
       │                 active }                     │
       └──────────────────────────────────────────────┘
                ▲                              ▲
                │ getAgent(id)                 │ register / update
                │                              │（商家用自家钱包签）
                ▼                              ▼
   ┌─────────────────────┐         ┌────────────────────────────┐
   │   USER AGENT · AI   │ ◄────►  │  MERCHANT AGENT · 自托管   │
   │   (Claude/Cursor)   │  HTTPS  │  Hono + Drizzle + viem     │
   │   加载 SKILL.md 作为│         │  /.well-known/agent-card   │
   │   操作手册          │         │  /auth/challenge · /verify │
   └─────────────────────┘         │  /skills/<name>            │
                                   └────────────────────────────┘

           ⚠️ 三层之间没有任何 Concourse 控制的网关
```

## 仓库内容

| 路径 | 是什么 |
|---|---|
| [`contracts/erc8004/`](./contracts/erc8004/) | Foundry · `IdentityRegistry` + `ReputationRegistry` + `ValidationRegistry` + tests + Deploy 脚本。Solidity 0.8.24，`evmVersion = cancun`，73 测试 100% 覆盖 |
| [`merchant-agent-template/`](./merchant-agent-template/) | 商家用来变成主权 agent 的开源参考实现。Hono + Drizzle + better-sqlite3 + viem。EIP-191 认证 + canonical JSON card + SHA-256 链上锚定 |
| [`packages/discover-cli/`](./packages/discover-cli/) | `@concourse-protocol/discover` CLI + MCP server——SKILL.md 的可执行化。`discover-cli-v*` tag 推送时 GitHub Actions 自动发布 |
| [`backend/skills/`](./backend/skills/) | 两份 SKILL.md。`user-client` 教 AI 如何使用协议；`merchant-client` 教 AI 如何帮商家上线。**这两份 SKILL 就是协议手册——任何 LLM 加载它们都不需要这个 repo** |
| [`docs/architecture/`](./docs/architecture/) | 设计文档——agent-card 规范、信誉模型、x402 支付流程、迁移计划 |
| [`frontend/`](./frontend/) | 参考前端 [concourse.paking.xyz](https://concourse.paking.xyz)。ethers v6 直接读 `IdentityRegistry`，无后端代理 |
| [`backend/`](./backend/) | 可选 FastAPI 辅助服务（auth helper + indexer 缓存，给参考前端用）。协议本身不依赖它 |

## 发布物

| 资源 | URL |
|---|---|
| npm | https://www.npmjs.com/package/@concourse-protocol/discover |
| GitHub Releases | https://github.com/PakHeiPoon/Concourse/releases |
| 首个 agent | https://wumingchu.concourse.paking.xyz/.well-known/agent-card.json |
| 参考前端 | https://concourse.paking.xyz |

## 路线图

| 状态 | 阶段 |
|---|---|
| ✅ 已上线 | ERC-8004 三合约部署到 Base Sepolia，Basescan 已验证，73 测试通过 |
| ✅ 已上线 | merchant agent template（Hono + viem + EIP-191 + 5 个酒店 skill） |
| ✅ 已上线 | 首个 agent — Wuming Chu · Huangshan（agentId=1） |
| ✅ 已上线 | Trustless `/explorer`——浏览器直接读链 + SHA-256 验证 |
| ✅ 已上线 | `@concourse-protocol/discover` CLI + MCP——零安装协议客户端 |
| 🟡 建设中 | 通过共享 ERC-8004 主网地址正式上 mainnet |
| 🟡 建设中 | CLI 支持 EIP-191 签名 bearer auth |
| 📋 规划 | x402 paid-skill USDC micropayment（EIP-3009） |
| 📋 规划 | BookingEscrow（EIP-712 Seaport 式）+ 结算解锁的 ReputationRegistry hook |
| 📋 规划 | 给非技术商家的多租户 SaaS 托管 |

完整计划见 [`docs/architecture/07_MIGRATION_PLAN.md`](./docs/architecture/07_MIGRATION_PLAN.md)。

## 对抗实验：证明 Concourse 可被关掉

```bash
# 1. 用第三方 RPC（不是 concourse.paking.xyz）
export CONCOURSE_RPC_URL=https://base-sepolia.public.blastapi.io

# 2. /etc/hosts 黑掉 Concourse 前端（可选）
echo "0.0.0.0  concourse.paking.xyz" | sudo tee -a /etc/hosts

# 3. 跑完整 discover → verify → invoke。应该仍然成功。
npx -y @concourse-protocol/discover list
npx -y @concourse-protocol/discover invoke 1 get_room_types
```

如果哪天这条路径失败了，论文命题就被证伪——开 issue。

## 许可证

[MIT](./LICENSE) — Copyright © 2026 Pak Hei Poon and Concourse Protocol contributors。

---

<p align="center">
  <sub>你的下一笔交易应该发生在你和商家之间，而不是你和平台之间。</sub>
</p>
