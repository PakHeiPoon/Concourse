import { createHash } from 'node:crypto'
import kleur from 'kleur'
import { loadConfig } from '../lib/config.js'
import { makeClient, getAgent } from '../lib/chain.js'

export interface FetchOptions {
  json: boolean
  save?: string
  mutate?: boolean
}

export interface FetchResult {
  agentId: number
  cardURI: string
  onChainHash: `0x${string}`
  computedHash: `0x${string}`
  verified: boolean
  bytes: number
  cardServerHeader: string | null
}

export class VerificationError extends Error {
  constructor(public readonly result: FetchResult) {
    super(
      `card hash mismatch — refuse to trust\n` +
        `  on-chain : ${result.onChainHash}\n` +
        `  computed : ${result.computedHash}`,
    )
    this.name = 'VerificationError'
  }
}

export async function runFetch(
  agentIdRaw: string,
  opts: FetchOptions,
): Promise<FetchResult> {
  const cfg = loadConfig()
  const client = makeClient(cfg)
  const agentId = BigInt(agentIdRaw)

  if (!opts.json) {
    console.error(
      kleur.dim(`↳ chain ${cfg.chainId} · registry ${cfg.registry}`),
    )
    console.error(kleur.dim(`↳ getAgent(${agentId})`))
  }

  const agent = await getAgent(client, cfg, agentId)

  if (!opts.json) {
    console.error(kleur.dim(`  owner    ${agent.owner}`))
    console.error(kleur.dim(`  cardURI  ${agent.agentCardURI}`))
    console.error(kleur.dim(`  cardHash ${agent.agentCardHash}  (on chain)`))
    console.error(kleur.dim(`  active   ${agent.active}`))
  }

  const res = await fetch(agent.agentCardURI)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${agent.agentCardURI}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const cardServerHeader = res.headers.get('x-card-sha256')

  // Optional: tamper one byte to demonstrate the ABORT path.
  if (opts.mutate) {
    const idx = Math.floor(buf.length / 2)
    buf[idx] = buf[idx]! ^ 0x01
  }

  const computedHex = createHash('sha256').update(buf).digest('hex')
  const computedHash = `0x${computedHex}` as `0x${string}`
  const verified =
    computedHash.toLowerCase() === agent.agentCardHash.toLowerCase()

  const result: FetchResult = {
    agentId: Number(agentId),
    cardURI: agent.agentCardURI,
    onChainHash: agent.agentCardHash,
    computedHash,
    verified,
    bytes: buf.length,
    cardServerHeader,
  }

  if (opts.save) {
    const fs = await import('node:fs/promises')
    await fs.writeFile(opts.save, buf)
    if (!opts.json) console.error(kleur.dim(`  saved → ${opts.save}`))
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    if (!verified) throw new VerificationError(result)
    return result
  }

  console.error('')
  console.error(`  bytes        ${result.bytes}`)
  console.error(`  server header ${result.cardServerHeader ?? '(none)'}`)
  console.error(`  on-chain     ${result.onChainHash}`)
  console.error(`  computed     ${result.computedHash}`)
  console.error('')

  if (verified) {
    console.error(kleur.green().bold('  ✓ verified — safe to trust this card'))
    console.error(kleur.dim('    (the on-chain commit matches the actual bytes served)'))
  } else {
    console.error(kleur.red().bold('  ✗ ABORT — hash mismatch, refuse to transact'))
    console.error(
      kleur.dim('    server returned bytes that do NOT match the on-chain commit.'),
    )
    console.error(
      kleur.dim('    do NOT trust the X-Card-SHA256 header — always re-compute (which we just did).'),
    )
    throw new VerificationError(result)
  }

  return result
}
