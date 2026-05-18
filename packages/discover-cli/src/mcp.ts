#!/usr/bin/env node
/**
 * Concourse MCP server (stdio transport).
 *
 * Exposes the discover/verify/invoke loop as MCP tools so any MCP host
 * (Claude Desktop, Cursor, custom agents) can talk to ERC-8004 agents
 * natively. The protocol is unchanged: chain RPC + HTTPS + SHA-256.
 * No Concourse-operated infrastructure is in the path.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { loadConfig } from './lib/config.js'
import { makeClient, totalAgents, getAgent } from './lib/chain.js'
import {
  fetchAndVerifyCard,
  findSkill,
  newIdempotencyKey,
  HashMismatchError,
} from './lib/card.js'

const server = new McpServer({
  name: 'concourse-discover',
  version: '0.1.0-alpha.1',
})

function asText(payload: unknown): { content: { type: 'text'; text: string }[] } {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  return { content: [{ type: 'text', text }] }
}

function asError(err: unknown): { content: { type: 'text'; text: string }[]; isError: true } {
  const text = err instanceof Error ? err.message : String(err)
  return { content: [{ type: 'text', text }], isError: true }
}

server.registerTool(
  'concourse_list_agents',
  {
    title: 'List Concourse agents',
    description:
      'Read the IdentityRegistry on-chain and list every registered agent. ' +
      'Active-only by default. No Concourse-operated server is involved.',
    inputSchema: {
      includeInactive: z.boolean().optional().describe('include agents where active == false'),
    },
  },
  async ({ includeInactive }) => {
    try {
      const cfg = loadConfig()
      const client = makeClient(cfg)
      const total = await totalAgents(client, cfg)
      const agents = []
      for (let i = 1n; i <= total; i++) {
        const a = await getAgent(client, cfg, i)
        if (!a.active && !includeInactive) continue
        agents.push({
          agentId: Number(a.agentId),
          owner: a.owner,
          agentCardURI: a.agentCardURI,
          agentCardHash: a.agentCardHash,
          registeredAt: Number(a.registeredAt),
          updatedAt: Number(a.updatedAt),
          active: a.active,
        })
      }
      return asText({
        chainId: cfg.chainId,
        registry: cfg.registry,
        total: Number(total),
        shown: agents.length,
        agents,
      })
    } catch (err) {
      return asError(err)
    }
  },
)

server.registerTool(
  'concourse_verify_card',
  {
    title: 'Verify an agent card',
    description:
      'Fetch the agent-card.json for a given agentId, compute SHA-256, and compare with the ' +
      'on-chain commit. Returns the parsed card on success; throws on hash mismatch.',
    inputSchema: {
      agentId: z.number().int().positive().describe('on-chain agentId'),
    },
  },
  async ({ agentId }) => {
    try {
      const cfg = loadConfig()
      const v = await fetchAndVerifyCard(agentId, cfg)
      return asText({
        agentId: v.agentId,
        cardURI: v.cardURI,
        onChainHash: v.onChainHash,
        computedHash: v.computedHash,
        verified: true,
        card: v.card,
      })
    } catch (err) {
      if (err instanceof HashMismatchError) {
        return asError(
          `HASH MISMATCH — refuse to trust agent #${agentId}\n` +
            `on-chain: ${err.onChainHash}\ncomputed: ${err.computedHash}`,
        )
      }
      return asError(err)
    }
  },
)

server.registerTool(
  'concourse_list_skills',
  {
    title: 'List an agent skills',
    description: 'Fetch + verify the card, then return the skill catalog (name, endpoint, schema).',
    inputSchema: {
      agentId: z.number().int().positive(),
    },
  },
  async ({ agentId }) => {
    try {
      const cfg = loadConfig()
      const v = await fetchAndVerifyCard(agentId, cfg)
      return asText({
        agentId: v.agentId,
        name: v.card.name,
        url: v.card.url,
        verifiedHash: v.computedHash,
        skills: v.card.skills,
        authentication: v.card.authentication,
      })
    } catch (err) {
      return asError(err)
    }
  },
)

server.registerTool(
  'concourse_invoke_skill',
  {
    title: 'Invoke a skill on a verified agent',
    description:
      'Verify the agent card (SHA-256 vs on-chain), then POST the payload to the skill endpoint. ' +
      'Auto-attaches a fresh Idempotency-Key. Aborts before any HTTP call if hash does not match.',
    inputSchema: {
      agentId: z.number().int().positive(),
      skill: z.string().describe('skill name as declared on the agent card'),
      input: z.record(z.unknown()).optional().describe('JSON object matching the skill inputSchema'),
      bearer: z.string().optional().describe('optional Authorization: Bearer <token>'),
    },
  },
  async ({ agentId, skill, input, bearer }) => {
    try {
      const cfg = loadConfig()
      const v = await fetchAndVerifyCard(agentId, cfg)
      const s = findSkill(v.card, skill)
      const url = v.card.url.replace(/\/$/, '') + s.endpoint
      const idempotencyKey = newIdempotencyKey()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      }
      if (bearer) headers.Authorization = `Bearer ${bearer}`

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input ?? {}),
      })
      const ct = res.headers.get('content-type') ?? ''
      const text = await res.text()
      const body = ct.includes('application/json') ? (JSON.parse(text) as unknown) : text

      return asText({
        verified: true,
        verifiedHash: v.computedHash,
        endpoint: url,
        idempotencyKey,
        status: res.status,
        ok: res.ok,
        response: body,
      })
    } catch (err) {
      return asError(err)
    }
  },
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('concourse-mcp ready · stdio · tools: list_agents, verify_card, list_skills, invoke_skill')
}

main().catch((err: Error) => {
  console.error(`concourse-mcp fatal: ${err.message}`)
  process.exit(1)
})
