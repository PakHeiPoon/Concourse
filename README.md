<p align="center">
  <img src="https://img.shields.io/badge/0G_Network-Powered-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNyIgeT0iMTYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IndoaXRlIj4wRzwvdGV4dD48L3N2Zz4=" alt="0G Network" />
  <img src="https://img.shields.io/github/stars/PakHeiPoon/TourSkill?style=for-the-badge&color=yellow" alt="Stars" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Hackathon-0G_APAC-orange?style=for-the-badge" alt="Hackathon" />
</p>

<h1 align="center">TourSkill</h1>

<p align="center">
  <strong>Decentralized AI Yellow Pages for Tourism on 0G Network</strong>
</p>

<p align="center">
  <a href="#-english">English</a> | <a href="#-中文">中文</a>
</p>

---

## [EN] English

### What is TourSkill?

TourSkill is a **decentralized AI-powered tourism merchant registry** built on the [0G Network](https://0g.ai). It combines on-chain merchant identity (ERC-8004 inspired), an MCP (Model Context Protocol) gateway, and 0G Compute Network LLM inference to create a fully decentralized "AI Yellow Pages" for tourism.

**Users connect their own MetaMask wallet and use their own 0G tokens to power AI agent queries** — no centralized API keys, no platform intermediaries.

### Architecture

```
                                 TourSkill Architecture
 ┌──────────────────────────────────────────────────────────────────────┐
 │                         USER (Browser + MetaMask)                    │
 │                                                                      │
 │  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────┐ │
 │  │ Registration │    │   Explorer       │    │   Agent Demo         │ │
 │  │   Portal     │    │   (Browse &      │    │   (AI Chat with     │ │
 │  │   (Register  │    │    Test Skills)  │    │    Tool Calling)    │ │
 │  │   Merchant)  │    │                  │    │                      │ │
 │  └──────┬───────┘    └────────┬─────────┘    └──────────┬───────────┘ │
 └─────────┼─────────────────────┼─────────────────────────┼────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
 ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
 │  0G Chain        │   │  MCP Gateway     │   │  0G Compute Network     │
 │  (Solidity)      │   │  (FastAPI)       │   │  (Decentralized LLM)   │
 │                  │   │                  │   │                         │
 │  MerchantRegistry│   │  /mcp/tools/*    │   │  qwen/GLM/DeepSeek     │
 │  .sol            │   │  discover        │   │  via @0glabs/broker    │
 │                  │   │  invoke_skill    │   │                         │
 │  - register()   │   │  get_details     │   │  User's wallet pays    │
 │  - getMerchant()│   │                  │   │  for inference          │
 │  - listByType() │   │  ┌────────────┐  │   │                         │
 │                  │   │  │  Supabase  │  │   │  ┌─────────────────┐   │
 │  Deployed on     │   │  │  (DB)      │  │   │  │ Tool Calling    │   │
 │  0G Testnet      │   │  └────────────┘  │   │  │ Loop (max 8)    │   │
 └─────────────────┘   └─────────────────┘   │  └────────┬────────┘   │
                                               │           │            │
                                               │           ▼            │
                                               │  MCP Gateway ──────►  │
                                               │  (execute tools)       │
                                               └─────────────────────────┘
```

### Workflow

```
 User asks: "Find me restaurants in Hangzhou"
      │
      ▼
 ┌─────────────────────────────────────────┐
 │ 1. Connect MetaMask to 0G Network       │
 │    (Testnet or Mainnet)                 │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 2. Create Ledger & Transfer Funds       │
 │    (Auto: 3 0G deposit + 2 0G to       │
 │     provider if needed)                 │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 3. Send query to 0G Compute LLM        │
 │    (User's tokens pay for inference)    │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 4. LLM decides to call tools:           │
 │    → discover_merchants(hangzhou,        │
 │      restaurant)                        │
 │    → invoke_merchant_skill(get_menu)    │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 5. MCP Gateway executes tools against   │
 │    Supabase + returns results to LLM   │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 6. LLM generates final response with   │
 │    real merchant data, menus, prices    │
 └─────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **On-Chain Registry** | Merchants register via `MerchantRegistry.sol` on 0G Chain with profile hash verification |
| **MCP Gateway** | Model Context Protocol server exposing `discover_merchants`, `invoke_merchant_skill`, `get_merchant_details` |
| **0G Compute LLM** | Decentralized AI inference — users pay with their own 0G tokens via MetaMask |
| **Network Selection** | Switch between 0G Testnet (Galileo) and Mainnet with automatic chain switching |
| **Auto Funding** | Smart balance detection — only deposits/transfers when locked balance is insufficient |
| **Skill System** | 12 merchant skills: `get_menu`, `reserve_table`, `check_availability`, `purchase_ticket`, etc. |
| **Tool Calling Loop** | LLM autonomously decides which MCP tools to call (up to 8 iterations) |
| **Real-time Logs** | Terminal panel shows every tool call, result, and LLM interaction live |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS |
| **Smart Contract** | Solidity 0.8.24 + Hardhat 3 on 0G Chain |
| **Backend** | FastAPI (Python) + Supabase |
| **AI Compute** | 0G Compute Network + `@0glabs/0g-serving-broker` |
| **Protocol** | MCP (Model Context Protocol) for tool invocation |
| **Wallet** | MetaMask + ethers.js v6 |

### Quick Start

#### Prerequisites

- Node.js 18+
- Python 3.10+
- MetaMask browser extension
- 0G Testnet tokens ([faucet](https://faucet.0g.ai))

#### 1. Clone & Install

```bash
git clone https://github.com/PakHeiPoon/TourSkill.git
cd TourSkill
```

#### 2. Backend (MCP Gateway)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase credentials
uvicorn app.main:app --reload --port 8000
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

#### 4. Smart Contract (Optional — already deployed)

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your deployer private key
npx hardhat run scripts/deploy.js --network zerog_testnet
```

**Deployed Contract:** `0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543` on [0G Testnet](https://chainscan-galileo.0g.ai/address/0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543)

### Project Structure

```
TourSkill/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── RegistrationPortal.tsx   # Merchant registration
│   │   │   ├── Explorer.tsx             # Browse & test skills
│   │   │   └── AgentDemo.tsx            # AI agent chat
│   │   ├── hooks/
│   │   │   └── use0gCompute.ts          # 0G Compute hook
│   │   └── contracts/
│   │       └── MerchantRegistry.ts      # Contract ABI
│   └── vite.config.ts
├── backend/               # FastAPI MCP Gateway
│   ├── app/
│   │   ├── routers/mcp.py              # MCP tool endpoints
│   │   ├── services/
│   │   │   ├── merchant_service.py      # Supabase queries
│   │   │   └── skill_service.py         # Skill execution (12 skills)
│   │   └── db/supabase_client.py
│   └── requirements.txt
├── contracts/             # Solidity smart contracts
│   ├── contracts/MerchantRegistry.sol
│   ├── scripts/deploy.js
│   └── hardhat.config.js
└── agent/                 # (Optional) Server-side agent
    └── server.js
```

### Screenshots

> Coming soon — see the live demo!

### License

MIT

---

## [ZH] 中文

### TourSkill 是什么？

TourSkill 是一个基于 [0G Network](https://0g.ai) 构建的**去中心化 AI 旅游商家注册表**。它结合了链上商家身份（受 ERC-8004 启发）、MCP（模型上下文协议）网关和 0G 计算网络 LLM 推理，打造了一个完全去中心化的"AI 旅游黄页"。

**用户使用自己的 MetaMask 钱包连接，用自己的 0G 代币驱动 AI 智能体查询** —— 无需中心化 API 密钥，无需平台中间商。

### 架构概览

```
                              TourSkill 架构
 ┌──────────────────────────────────────────────────────────────────────┐
 │                       用户（浏览器 + MetaMask）                       │
 │                                                                      │
 │  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────┐ │
 │  │  商家注册     │    │   商家浏览器      │    │   AI 智能体演示      │ │
 │  │  Portal      │    │   Explorer       │    │   Agent Demo         │ │
 │  └──────┬───────┘    └────────┬─────────┘    └──────────┬───────────┘ │
 └─────────┼─────────────────────┼─────────────────────────┼────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
 ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
 │  0G Chain        │   │  MCP 网关        │   │  0G 计算网络            │
 │  (智能合约)      │   │  (FastAPI)       │   │  (去中心化 LLM)        │
 │                  │   │                  │   │                         │
 │  商家注册合约     │   │  发现商家         │   │  qwen / GLM / DeepSeek │
 │                  │   │  调用技能         │   │  用户钱包付费推理       │
 │  已部署在         │   │  查询详情         │   │                         │
 │  0G 测试网       │   │                  │   │  Tool Calling 循环     │
 └─────────────────┘   └─────────────────┘   └─────────────────────────┘
```

### 工作流程

```
 用户提问："帮我找杭州的餐厅"
      │
      ▼
 ┌─────────────────────────────────────────┐
 │ 1. MetaMask 连接 0G 网络                 │
 │    （支持测试网 / 主网切换）              │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 2. 自动创建账本 & 转账                   │
 │    （存入 3 0G + 向 Provider 转 2 0G）  │
 │    余额充足时自动跳过                    │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 3. 发送查询到 0G 计算网络 LLM            │
 │    （用户自己的代币支付推理费用）          │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 4. LLM 自主决定调用工具：                │
 │    → discover_merchants(杭州, 餐厅)     │
 │    → invoke_merchant_skill(get_menu)    │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 5. MCP 网关执行工具，查询 Supabase       │
 │    返回真实商家数据给 LLM               │
 └──────────────────┬──────────────────────┘
                    ▼
 ┌─────────────────────────────────────────┐
 │ 6. LLM 生成最终回复                      │
 │    包含真实菜单、价格、可用性等信息       │
 └─────────────────────────────────────────┘
```

### 核心特性

| 特性 | 说明 |
|------|------|
| **链上注册** | 商家通过 `MerchantRegistry.sol` 在 0G Chain 上注册，Profile Hash 验证 |
| **MCP 网关** | 模型上下文协议服务器，提供 `discover_merchants`、`invoke_merchant_skill`、`get_merchant_details` |
| **0G 计算 LLM** | 去中心化 AI 推理 —— 用户用自己的 0G 代币通过 MetaMask 付费 |
| **网络选择** | 支持 0G 测试网（Galileo）和主网切换，自动添加链配置 |
| **智能充值** | 智能检测余额 —— 仅在 locked balance 不足时才触发存款/转账 |
| **技能系统** | 12 种商家技能：获取菜单、预订桌位、查询可用性、购买门票等 |
| **工具调用循环** | LLM 自主决定调用哪些 MCP 工具（最多 8 轮迭代） |
| **实时日志** | 终端面板实时展示每个工具调用、返回结果和 LLM 交互 |

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + TypeScript + Vite + Tailwind CSS |
| **智能合约** | Solidity 0.8.24 + Hardhat 3（0G Chain） |
| **后端** | FastAPI (Python) + Supabase |
| **AI 计算** | 0G 计算网络 + `@0glabs/0g-serving-broker` |
| **协议** | MCP（模型上下文协议） |
| **钱包** | MetaMask + ethers.js v6 |

### 快速开始

#### 前置要求

- Node.js 18+
- Python 3.10+
- MetaMask 浏览器插件
- 0G 测试网代币（[水龙头](https://faucet.0g.ai)）

#### 1. 克隆仓库

```bash
git clone https://github.com/PakHeiPoon/TourSkill.git
cd TourSkill
```

#### 2. 启动后端（MCP 网关）

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入你的 Supabase 凭证
uvicorn app.main:app --reload --port 8000
```

#### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

#### 4. 部署智能合约（可选 —— 已部署）

```bash
cd contracts
npm install
cp .env.example .env
# 编辑 .env 填入你的部署私钥
npx hardhat run scripts/deploy.js --network zerog_testnet
```

**已部署合约：** `0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543`（[0G 测试网浏览器](https://chainscan-galileo.0g.ai/address/0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543)）

### 致谢

- [0G Network](https://0g.ai) — 去中心化 AI 操作系统
- [0G APAC Hackathon](https://0g.ai) — 黑客松支持
- [Supabase](https://supabase.com) — 数据库服务

---

<p align="center">
  <strong>Built with 0G Network for the 0G APAC Hackathon 2025</strong>
</p>
