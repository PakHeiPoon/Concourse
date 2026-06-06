/**
 * Chain-native agent tools for the Agent Demo.
 *
 * The assistant discovers, reads, invokes, and pays merchant-agents by
 * talking straight to the chain and to each merchant's own URL — no
 * Concourse backend in the path. This is the product itself, driven by an
 * LLM in conversation:
 *   discover  → read IdentityRegistry + fetch each self-hosted AgentCard
 *   invoke    → POST the merchant's own skill endpoint
 *   pay       → if a skill returns 402, settle via x402 (EIP-3009 USDC)
 */

import {
  listAllAgents, getAgent, fetchAndHashCard,
  type AgentCard, type AgentCardSkill,
} from '../lib/erc8004'
import { postWithX402, skillIsPaid, skillPriceLabel } from '../lib/x402'

export interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolLogEntry {
  type: 'tool_call' | 'tool_result' | 'info' | 'error'
  name?: string
  args?: Record<string, unknown>
  text?: string
  time: string
}

export const SYSTEM_PROMPT = `You are the Concourse travel agent. You discover and use real merchant-agents that are registered on the Base blockchain (ERC-8004), reading each merchant's self-hosted AgentCard and calling its skills directly. There is no central database — everything you see is read live from the chain and from each merchant's own server.

Tools:
1. discover_merchants(city?, type?) — list merchants registered on-chain, each with its agentId, name, city, type, on-chain verification status, and its skills (some are PAID).
2. get_merchant_skills(agent_id) — full skill list for one merchant, including each skill's input fields.
3. invoke_merchant_skill(agent_id, skill_name, skill_args) — call a skill on that merchant's own URL. If the skill is PAID it costs USDC: the user's wallet will be asked to sign an x402 payment, and real USDC settles on-chain before the result comes back.

Rules:
- Always discover_merchants first; refer to merchants by their agentId.
- Pass skill arguments that match the skill's input fields. Dates are YYYY-MM-DD.
- Before invoking a PAID skill, tell the user the price and that their wallet will prompt to pay. Payment is irreversible.
- When a paid call settles, mention the USDC amount and the settlement tx.
- Be concise. Today is ${new Date().toISOString().slice(0, 10)}, tomorrow ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}.`

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'discover_merchants',
      description: 'Read the on-chain ERC-8004 registry and return merchants (with their skills). Optionally filter by city or type.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City in lowercase, e.g. hangzhou, guangzhou, huangshan' },
          type: { type: 'string', enum: ['hotel', 'restaurant', 'attraction'], description: 'Merchant category' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_merchant_skills',
      description: 'Get the full skill list (with input fields and prices) for one merchant by its agentId.',
      parameters: {
        type: 'object',
        properties: { agent_id: { type: 'number', description: 'The merchant agentId from discovery' } },
        required: ['agent_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'invoke_merchant_skill',
      description: 'Call a skill on a merchant by agentId. Paid skills trigger an x402 USDC payment (the wallet will prompt).',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'number', description: 'The merchant agentId' },
          skill_name: { type: 'string', description: 'Skill to call, e.g. get_rates, check_availability, get_concierge_recommendation' },
          skill_args: { type: 'object', description: 'Arguments matching the skill input fields' },
        },
        required: ['agent_id', 'skill_name'],
      },
    },
  },
]

// ─── helpers ─────────────────────────────────────────────────────────

function cardExt(card: AgentCard, key: string): Record<string, unknown> {
  return ((card.extensions ?? {}) as Record<string, Record<string, unknown>>)[key] ?? {}
}

function merchantName(card: AgentCard): string {
  const i18n = cardExt(card, 'tourskill.org/v1/i18n')
  const name = i18n.name as { en?: string; zh?: string } | undefined
  return name?.en ?? card.name
}

function skillSummary(s: AgentCardSkill): Record<string, unknown> {
  const schema = s.inputSchema as { properties?: Record<string, unknown> } | undefined
  return {
    name: s.name,
    description: s.description,
    paid: skillIsPaid(s as { pricing?: Record<string, unknown> }),
    price: skillIsPaid(s as { pricing?: Record<string, unknown> }) ? skillPriceLabel(s as { pricing?: Record<string, unknown> }) : 'free',
    input_fields: schema?.properties ? Object.keys(schema.properties) : [],
  }
}

/** Resolve an agentId to its live, verified card + base URL. */
async function resolveAgent(agentId: number): Promise<{ card: AgentCard; baseUrl: string; verified: boolean }> {
  const agent = await getAgent(agentId)
  const { card, hash } = await fetchAndHashCard(agent.agentCardURI)
  const baseUrl = card.url || agent.agentCardURI.replace('/.well-known/agent-card.json', '')
  return { card, baseUrl, verified: hash.toLowerCase() === agent.agentCardHash.toLowerCase() }
}

// ─── executor ────────────────────────────────────────────────────────

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    if (toolName === 'discover_merchants') {
      const agents = await listAllAgents()
      const rows = await Promise.all(agents.map(async (a) => {
        try {
          const { card, hash } = await fetchAndHashCard(a.agentCardURI)
          return {
            agent_id: a.agentId,
            name: merchantName(card),
            type: cardExt(card, 'tourskill.org/v1/merchant').type ?? '',
            city: cardExt(card, 'tourskill.org/v1/location').city ?? '',
            verified: hash.toLowerCase() === a.agentCardHash.toLowerCase(),
            owner: a.owner,
            skills: (card.skills ?? []).map(skillSummary),
          }
        } catch {
          return null
        }
      }))
      let list = rows.filter((r): r is NonNullable<typeof r> => r !== null)
      const city = typeof args.city === 'string' ? args.city.toLowerCase() : null
      const type = typeof args.type === 'string' ? args.type : null
      if (city) list = list.filter((m) => String(m.city).toLowerCase() === city)
      if (type) list = list.filter((m) => m.type === type)
      return JSON.stringify({ count: list.length, merchants: list })
    }

    if (toolName === 'get_merchant_skills') {
      const id = Number(args.agent_id)
      const { card, verified } = await resolveAgent(id)
      return JSON.stringify({
        agent_id: id,
        name: merchantName(card),
        verified,
        skills: (card.skills ?? []).map(skillSummary),
      })
    }

    if (toolName === 'invoke_merchant_skill') {
      const id = Number(args.agent_id)
      const skillName = String(args.skill_name)
      const skillArgs = (args.skill_args as Record<string, unknown>) ?? {}
      const { card, baseUrl } = await resolveAgent(id)
      const skill = (card.skills ?? []).find((s) => s.name === skillName)
      if (!skill) return JSON.stringify({ error: `skill ${skillName} not found on agent ${id}` })

      const url = baseUrl + skill.endpoint
      const headers: Record<string, string> = {
        'Idempotency-Key': `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }
      // postWithX402 pays via MetaMask only if the skill answers 402.
      const out = await postWithX402(url, skillArgs, headers)
      let parsed: unknown
      try { parsed = JSON.parse(out.body) } catch { parsed = out.body }
      return JSON.stringify({
        http_status: out.status,
        paid: out.paid && skillIsPaid(skill as { pricing?: Record<string, unknown> }),
        settlement_tx: out.settlement?.txHash ?? null,
        result: parsed,
      })
    }

    return JSON.stringify({ error: `unknown tool ${toolName}` })
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) })
  }
}
