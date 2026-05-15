/**
 * ERC-8004 IdentityRegistry read-only client (Base Sepolia).
 *
 * Pure browser-side reads via ethers v6. No wallet required to discover
 * agents — anyone can call `getAgent(id)` and verify the served bytes.
 */

import { Contract, JsonRpcProvider } from 'ethers'

export const BASE_SEPOLIA = {
  name:        'Base Sepolia',
  chainId:     84532,
  rpcUrl:      'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
} as const

export const IDENTITY_REGISTRY_ADDRESS =
  '0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f' as const

// IMPORTANT: getAgent returns a Solidity struct (tuple), not 6 separate
// return values. ethers v6 is strict — writing it as multi-return makes
// the decoder reject the encoded payload with BAD_DATA. The contract is
// `function getAgent(uint256) returns (Agent memory)` where Agent is a
// struct, so the ABI fragment must wrap fields in `tuple(...)`.
const IDENTITY_REGISTRY_ABI = [
  'function totalAgents() view returns (uint256)',
  'function getAgent(uint256 agentId) view returns (tuple(address owner, string agentCardURI, bytes32 agentCardHash, uint64 registeredAt, uint64 updatedAt, bool active))',
] as const

export interface OnChainAgent {
  agentId:       number
  owner:         string
  agentCardURI:  string
  agentCardHash: string
  registeredAt:  number
  updatedAt:     number
  active:        boolean
}

let cachedProvider: JsonRpcProvider | null = null

function provider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(BASE_SEPOLIA.rpcUrl, BASE_SEPOLIA.chainId, {
      staticNetwork: true,
    })
  }
  return cachedProvider
}

function registry(): Contract {
  return new Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, provider())
}

export async function getTotalAgents(): Promise<number> {
  const n = await registry().totalAgents()
  return Number(n)
}

export async function getAgent(agentId: number): Promise<OnChainAgent> {
  // With `tuple(...)` ABI, ethers returns a single Result wrapping all
  // fields. Access by index works identically.
  const r = await registry().getAgent(BigInt(agentId))
  // Some callers return the tuple as r[0] when only one return param exists;
  // detect both shapes to be safe across ethers minor versions.
  const t = Array.isArray(r) && r.length === 1 && Array.isArray(r[0]) ? r[0] : r
  return {
    agentId,
    owner:         t[0],
    agentCardURI:  t[1],
    agentCardHash: t[2],
    registeredAt:  Number(t[3]),
    updatedAt:     Number(t[4]),
    active:        Boolean(t[5]),
  }
}

export async function listAllAgents(): Promise<OnChainAgent[]> {
  const total = await getTotalAgents()
  if (total === 0) return []
  const ids = Array.from({ length: total }, (_, i) => i + 1)
  const all = await Promise.all(ids.map(getAgent))
  return all.filter((a) => a.active)
}

// ─── SHA-256 verification (browser-side) ─────────────────────────────

/** SHA-256 of UTF-8 bytes, returns 0x-prefixed lowercase hex. */
export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return '0x' + hex
}

export interface FetchedCard {
  bytes:    number
  hash:     string
  raw:      string
  card:     AgentCard
  headerSha256: string | null
}

export interface AgentCardSkill {
  name:        string
  description: string
  endpoint:    string
  pricing?:    Record<string, unknown>
  idempotencyKey?: 'required' | 'optional'
  inputSchema?: unknown
  outputSchema?: unknown
}

export interface AgentCard {
  schemaVersion?: string
  name:           string
  description?:   string
  url:            string
  version?:       string
  skills:         AgentCardSkill[]
  extensions?:    Record<string, unknown>
  provenance?: {
    agentId?:  number | null
    registry?: string | null
    chain?:    string
    owner?:    string
  }
  [key: string]: unknown
}

export async function fetchAndHashCard(uri: string): Promise<FetchedCard> {
  const res = await fetch(uri, { mode: 'cors' })
  if (!res.ok) throw new Error(`fetch ${uri} → HTTP ${res.status}`)
  const headerSha = res.headers.get('x-card-sha256')
  const raw  = await res.text()
  const hash = await sha256Hex(raw)
  return {
    bytes: new Blob([raw]).size,
    hash,
    raw,
    card: JSON.parse(raw) as AgentCard,
    headerSha256: headerSha,
  }
}

export function basescanRegistryUrl(): string {
  return `${BASE_SEPOLIA.explorerUrl}/address/${IDENTITY_REGISTRY_ADDRESS}#readContract`
}

export function basescanTxUrl(txHash: string): string {
  return `${BASE_SEPOLIA.explorerUrl}/tx/${txHash}`
}
