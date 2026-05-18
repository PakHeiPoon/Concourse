import { createHash, randomUUID } from 'node:crypto'
import type { Config } from './config.js'
import { getAgent, makeClient } from './chain.js'
import type { PublicClient } from 'viem'

export interface AgentCardSkill {
  name: string
  description?: string
  endpoint: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  authentication?: string | null
}

export interface AgentCardAuth {
  schemes: string[]
  challengeEndpoint: string
  verifyEndpoint: string
}

export interface AgentCard {
  name: string
  url: string
  skills: AgentCardSkill[]
  authentication?: AgentCardAuth
  [key: string]: unknown
}

export interface VerifiedCard {
  agentId: number
  card: AgentCard
  rawBytes: Buffer
  onChainHash: `0x${string}`
  computedHash: `0x${string}`
  cardURI: string
}

export class HashMismatchError extends Error {
  constructor(
    public readonly onChainHash: string,
    public readonly computedHash: string,
  ) {
    super(
      `card hash mismatch — refuse to trust\n  on-chain: ${onChainHash}\n  computed: ${computedHash}`,
    )
    this.name = 'HashMismatchError'
  }
}

export async function fetchAndVerifyCard(
  agentIdRaw: string | number | bigint,
  cfg: Config,
  client?: PublicClient,
): Promise<VerifiedCard> {
  const agentId = BigInt(agentIdRaw)
  const c = client ?? makeClient(cfg)
  const agent = await getAgent(c, cfg, agentId)

  const res = await fetch(agent.agentCardURI)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${agent.agentCardURI}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const computedHash = `0x${createHash('sha256').update(buf).digest('hex')}` as `0x${string}`

  if (computedHash.toLowerCase() !== agent.agentCardHash.toLowerCase()) {
    throw new HashMismatchError(agent.agentCardHash, computedHash)
  }

  const card = JSON.parse(buf.toString('utf-8')) as AgentCard

  return {
    agentId: Number(agentId),
    card,
    rawBytes: buf,
    onChainHash: agent.agentCardHash,
    computedHash,
    cardURI: agent.agentCardURI,
  }
}

export function findSkill(card: AgentCard, name: string): AgentCardSkill {
  const s = card.skills?.find((sk) => sk.name === name)
  if (!s) {
    const avail = (card.skills ?? []).map((sk) => sk.name).join(', ')
    throw new Error(`skill "${name}" not found on this agent. available: ${avail || '(none)'}`)
  }
  return s
}

export function newIdempotencyKey(): string {
  return randomUUID()
}
