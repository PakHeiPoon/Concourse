import { baseSepolia, base, type Chain } from 'viem/chains'

export interface Config {
  rpcUrl: string
  registry: `0x${string}`
  chainId: number
  chain: Chain
}

const DEFAULTS = {
  rpcUrl: 'https://sepolia.base.org',
  registry: '0xBdE5A55D50d2062FF5529546d8c391f6a6eEA29f' as `0x${string}`,
  chainId: 84532,
} as const

export function loadConfig(): Config {
  const chainId = Number(process.env.CONCOURSE_CHAIN_ID ?? DEFAULTS.chainId)
  const chain: Chain = chainId === base.id ? base : baseSepolia

  return {
    rpcUrl: process.env.CONCOURSE_RPC_URL ?? DEFAULTS.rpcUrl,
    registry: (process.env.CONCOURSE_REGISTRY ?? DEFAULTS.registry) as `0x${string}`,
    chainId,
    chain,
  }
}
