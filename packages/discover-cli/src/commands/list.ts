import kleur from 'kleur'
import { loadConfig } from '../lib/config.js'
import { makeClient, totalAgents, getAgent, type Agent } from '../lib/chain.js'

export interface ListOptions {
  includeInactive: boolean
  json: boolean
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

function isoDate(unix: bigint): string {
  return new Date(Number(unix) * 1000).toISOString().slice(0, 10)
}

export async function runList(opts: ListOptions): Promise<void> {
  const cfg = loadConfig()
  const client = makeClient(cfg)

  if (!opts.json) {
    console.error(
      kleur.dim(
        `↳ chain ${cfg.chainId} · registry ${cfg.registry} · rpc ${cfg.rpcUrl}`,
      ),
    )
  }

  const total = await totalAgents(client, cfg)

  if (total === 0n) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ total: 0, agents: [] }, null, 2) + '\n')
    } else {
      console.error(kleur.yellow('No agents registered.'))
    }
    return
  }

  const agents: Agent[] = []
  for (let i = 1n; i <= total; i++) {
    try {
      const a = await getAgent(client, cfg, i)
      if (!a.active && !opts.includeInactive) continue
      agents.push(a)
    } catch (err) {
      if (!opts.json) {
        console.error(kleur.red(`  agent #${i}: read failed — ${(err as Error).message}`))
      }
    }
  }

  if (opts.json) {
    const payload = {
      chainId: cfg.chainId,
      registry: cfg.registry,
      total: Number(total),
      shown: agents.length,
      agents: agents.map((a) => ({
        agentId: Number(a.agentId),
        owner: a.owner,
        agentCardURI: a.agentCardURI,
        agentCardHash: a.agentCardHash,
        registeredAt: Number(a.registeredAt),
        updatedAt: Number(a.updatedAt),
        active: a.active,
      })),
    }
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
    return
  }

  console.error(kleur.dim(`↳ ${agents.length}/${total} shown\n`))
  console.log(
    kleur.bold(
      'id'.padEnd(5) +
        'active '.padEnd(8) +
        'owner'.padEnd(16) +
        'cardHash'.padEnd(22) +
        'updated   ' +
        'cardURI',
    ),
  )
  console.log(kleur.dim('─'.repeat(110)))

  for (const a of agents) {
    const tick = a.active ? kleur.green('✓') : kleur.red('✗')
    console.log(
      String(a.agentId).padEnd(5) +
        (`  ${tick}   `).padEnd(8) +
        shortAddr(a.owner).padEnd(16) +
        shortHash(a.agentCardHash).padEnd(22) +
        isoDate(a.updatedAt) +
        '  ' +
        kleur.cyan(a.agentCardURI),
    )
  }
}
