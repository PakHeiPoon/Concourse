/**
 * Browser-side x402 client. When a paid skill returns HTTP 402, this signs
 * an EIP-3009 `transferWithAuthorization` with the connected wallet (one
 * MetaMask prompt, gasless for the payer) and retries with the X-PAYMENT
 * header. The merchant verifies + settles; real USDC moves on Base Sepolia.
 */

import { BrowserProvider, getAddress } from 'ethers'

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const CHAIN_ID = 84532

export interface X402Outcome {
  status:     number
  body:       string
  paid:       boolean
  settlement: { txHash: string; payer: string; amount: string; network: string } | null
}

function prettify(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex as `0x${string}`
}

/**
 * POST to a skill endpoint, transparently paying via x402 if it answers 402.
 * Throws only on wallet/connection errors; HTTP errors are returned in the
 * outcome so the caller can render them.
 */
export async function postWithX402(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<X402Outcome> {
  const baseHeaders = { 'Content-Type': 'application/json', ...extraHeaders }
  const payload = JSON.stringify(body ?? {})

  let res = await fetch(url, { method: 'POST', headers: baseHeaders, body: payload })
  if (res.status !== 402) {
    return { status: res.status, body: prettify(await res.text()), paid: false, settlement: null }
  }

  // ── 402: build + sign the EIP-3009 authorization ──
  const req = (await res.json()).accepts?.[0]
  if (!req) throw new Error('402 without payment requirements')

  const eth = (window as Window & { ethereum?: unknown }).ethereum
  if (!eth) throw new Error('MetaMask is required to pay for this skill')
  const provider = new BrowserProvider(eth as never)
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const from = getAddress(await signer.getAddress())

  const now = Math.floor(Date.now() / 1000)
  const value = BigInt(req.maxAmountRequired)
  const validAfter = 0n
  const validBefore = BigInt(now + (req.maxTimeoutSeconds ?? 300))
  const nonce = randomNonce()

  const signature = await signer.signTypedData(
    { name: req.extra.name, version: req.extra.version, chainId: CHAIN_ID, verifyingContract: getAddress(USDC) },
    {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
      ],
    },
    { from, to: getAddress(req.payTo), value, validAfter, validBefore, nonce },
  )

  const xPayment = btoa(JSON.stringify({
    x402Version: 1,
    scheme: 'exact',
    network: req.network,
    payload: {
      signature,
      authorization: {
        from, to: getAddress(req.payTo),
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  }))

  // ── retry with payment ──
  res = await fetch(url, {
    method: 'POST',
    headers: { ...baseHeaders, 'X-PAYMENT': xPayment },
    body: payload,
  })
  const text = await res.text()
  const settleHeader = res.headers.get('x-payment-response')
  const settlement = settleHeader
    ? (JSON.parse(atob(settleHeader)) as X402Outcome['settlement'])
    : null

  return { status: res.status, body: prettify(text), paid: res.status === 200, settlement }
}

/** True if a card skill charges (has a positive flat price). */
export function skillIsPaid(skill: { pricing?: Record<string, unknown> }): boolean {
  const p = skill.pricing
  if (!p || p.free) return false
  return typeof p.flatUsdc === 'number' && (p.flatUsdc as number) > 0
}

/** Human price label, e.g. "0.10 USDC", from base-unit flatUsdc. */
export function skillPriceLabel(skill: { pricing?: Record<string, unknown> }): string {
  const p = skill.pricing
  const base = typeof p?.flatUsdc === 'number' ? (p.flatUsdc as number) : 0
  return `${(base / 1e6).toFixed(2)} USDC`
}
