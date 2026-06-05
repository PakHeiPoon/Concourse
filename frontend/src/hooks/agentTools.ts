/**
 * Shared agent tool definitions + MCP execution helper.
 *
 * Provider-agnostic: these types, the system prompt, the OpenAI-style tool
 * schema, and the MCP execute call are reused by every inference provider
 * (currently Qiniu). They have nothing to do with which GPU/chain runs the
 * model, so they live here rather than inside a provider hook.
 */

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

// Match the same env contract used by every other page so prod hits
// api.concourse.paking.xyz, while local dev with VITE_API_BASE_URL set
// can still point at a local backend.
const MCP_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api.concourse.paking.xyz'

export const SYSTEM_PROMPT = `You are a helpful AI travel assistant powered by the Concourse decentralized registry on Base.

You help users discover tourism merchants (hotels, restaurants, attractions) and interact with their on-chain skills.

You have access to tools to:
1. discover_merchants — search the registry by city, type, or keyword
2. invoke_merchant_skill — call a merchant's skill API (get_menu, check_availability, reserve_table, etc.)
3. get_merchant_details — get full merchant profile

CRITICAL: When calling invoke_merchant_skill, use the "merchant_id" field from discovery results as the "did" parameter (e.g. "merchant:968e07fdafc1"). Do NOT use the "did" field (e.g. "did:concourse:merchant:...") — it will fail.

When a user asks about dining, hotels, or attractions in a city:
1. First use discover_merchants to find relevant merchants
2. Then use invoke_merchant_skill with the merchant_id to get details like menus, availability, or rates
3. Present the results in a friendly, helpful way
4. Offer to take action (reserve table, book room, purchase ticket) if appropriate

Always be concise and helpful. Format prices with ¥ symbol for CNY.
Today's date is ${new Date().toISOString().slice(0, 10)}.
Tomorrow's date is ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}.`

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'discover_merchants',
      description: 'Search the Concourse decentralized registry for tourism merchants by city, type, or keyword.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name in lowercase (e.g. hangzhou, shanghai)' },
          type: { type: 'string', enum: ['hotel', 'restaurant', 'attraction'], description: 'Merchant category' },
          keyword: { type: 'string', description: 'Free-text search' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'invoke_merchant_skill',
      description: 'Invoke a skill on a registered merchant (e.g. get_menu, check_availability, reserve_table). IMPORTANT: Use the merchant_id value directly (e.g. "merchant:968e07fdafc1"), NOT the did field.',
      parameters: {
        type: 'object',
        properties: {
          did: { type: 'string', description: 'The merchant_id value from discovery results (e.g. "merchant:968e07fdafc1"). Do NOT use the did field.' },
          skill_name: { type: 'string', description: 'Skill to invoke' },
          skill_args: { type: 'object', description: 'Arguments for the skill' },
        },
        required: ['did', 'skill_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_merchant_details',
      description: 'Get full profile details for a specific merchant by ID.',
      parameters: {
        type: 'object',
        properties: {
          merchant_id: { type: 'string', description: 'The merchant_id to look up' },
        },
        required: ['merchant_id'],
      },
    },
  },
]

export async function executeMcpTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${MCP_BASE}/mcp/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: toolName, arguments: args }),
  })
  const data = await res.json()
  return data.content?.[0]?.text || '{}'
}
