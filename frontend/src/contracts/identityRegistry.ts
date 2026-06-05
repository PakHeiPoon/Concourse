/**
 * ERC-8004 IdentityRegistry — write-side config (Base Sepolia).
 *
 * The read path lives in lib/erc8004.ts (JsonRpcProvider, no wallet). This
 * module is the *write* counterpart used by the in-browser registration
 * flow: it carries the minimal ABI for register()/update() plus the chain
 * descriptor MetaMask needs to switch/add Base Sepolia.
 *
 * Replaces the legacy contracts/MerchantRegistry.ts (0G Galileo). The
 * on-chain record is just (agentCardURI, agentCardHash) — every mutable
 * merchant detail lives off-chain in the card the URI resolves to, with the
 * SHA-256 committed here so consumers can detect tampering.
 */

import { IDENTITY_REGISTRY_ADDRESS, BASE_SEPOLIA } from '../lib/erc8004'

export { IDENTITY_REGISTRY_ADDRESS, BASE_SEPOLIA }

/** Hex chainId for wallet_switchEthereumChain / wallet_addEthereumChain. */
export const BASE_SEPOLIA_HEX = '0x' + BASE_SEPOLIA.chainId.toString(16)

/** Params for wallet_addEthereumChain if the wallet doesn't know Base Sepolia. */
export const BASE_SEPOLIA_ADD_PARAMS = {
  chainId: BASE_SEPOLIA_HEX,
  chainName: BASE_SEPOLIA.name,
  rpcUrls: [BASE_SEPOLIA.rpcUrl],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: [BASE_SEPOLIA.explorerUrl],
} as const

/**
 * Minimal write ABI. ethers v6 parses these human-readable fragments.
 * register returns the new agentId; AgentRegistered carries it in logs.
 */
export const IDENTITY_REGISTRY_WRITE_ABI = [
  'function register(string agentCardURI, bytes32 agentCardHash) returns (uint256 agentId)',
  'function update(uint256 agentId, string newURI, bytes32 newHash)',
  'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentCardURI, bytes32 agentCardHash)',
] as const

/**
 * SHA-256 of an ArrayBuffer as a 0x-prefixed bytes32 hex string, using the
 * browser-native Web Crypto API (no deps). This is the exact value that goes
 * on-chain as agentCardHash, and that discover-cli re-computes to verify.
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}`
}

/**
 * Fetch the bytes a URI actually serves and return both the raw bytes and
 * their SHA-256. Registering with the hash of the *served* bytes guarantees
 * the verify step (sha256(fetched) === on-chain hash) passes immediately.
 */
export async function fetchCardAndHash(
  uri: string,
): Promise<{ bytes: Uint8Array; hash: `0x${string}` }> {
  const res = await fetch(uri)
  if (!res.ok) {
    throw new Error(`Could not fetch agent card at ${uri} (HTTP ${res.status})`)
  }
  const arrayBuf = await res.arrayBuffer()
  const hash = await sha256Hex(arrayBuf)
  return { bytes: new Uint8Array(arrayBuf), hash }
}
