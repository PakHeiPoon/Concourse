import { createPublicClient, http, type PublicClient } from 'viem'
import type { Config } from './config.js'

export interface Agent {
  agentId: bigint
  owner: `0x${string}`
  agentCardURI: string
  agentCardHash: `0x${string}`
  registeredAt: bigint
  updatedAt: bigint
  active: boolean
}

export const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'totalAgents',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAgent',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'agentCardURI', type: 'string' },
          { name: 'agentCardHash', type: 'bytes32' },
          { name: 'registeredAt', type: 'uint64' },
          { name: 'updatedAt', type: 'uint64' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
] as const

export function makeClient(cfg: Config): PublicClient {
  return createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  })
}

export async function totalAgents(client: PublicClient, cfg: Config): Promise<bigint> {
  return client.readContract({
    address: cfg.registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'totalAgents',
  })
}

export async function getAgent(
  client: PublicClient,
  cfg: Config,
  agentId: bigint,
): Promise<Agent> {
  const raw = await client.readContract({
    address: cfg.registry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'getAgent',
    args: [agentId],
  })

  return {
    agentId,
    owner: raw.owner,
    agentCardURI: raw.agentCardURI,
    agentCardHash: raw.agentCardHash,
    registeredAt: raw.registeredAt,
    updatedAt: raw.updatedAt,
    active: raw.active,
  }
}
