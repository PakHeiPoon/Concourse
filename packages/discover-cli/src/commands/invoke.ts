import kleur from 'kleur'
import { loadConfig } from '../lib/config.js'
import { fetchAndVerifyCard, findSkill, newIdempotencyKey } from '../lib/card.js'

export interface InvokeOptions {
  data?: string
  dataFile?: string
  bearer?: string
  json: boolean
  skipVerify: boolean
}

async function readInput(opts: InvokeOptions): Promise<unknown> {
  if (opts.dataFile) {
    const fs = await import('node:fs/promises')
    return JSON.parse(await fs.readFile(opts.dataFile, 'utf-8'))
  }
  if (opts.data) return JSON.parse(opts.data)
  return {}
}

export async function runInvoke(
  agentIdRaw: string,
  skillName: string,
  opts: InvokeOptions,
): Promise<void> {
  if (opts.skipVerify) {
    throw new Error(
      'refusing to invoke without on-chain hash verification. remove --skip-verify to proceed.',
    )
  }

  const cfg = loadConfig()

  if (!opts.json) {
    console.error(kleur.dim(`↳ discover + verify agent #${agentIdRaw}…`))
  }

  const verified = await fetchAndVerifyCard(agentIdRaw, cfg)

  if (!opts.json) {
    console.error(
      kleur.dim(`  ✓ verified — ${verified.computedHash.slice(0, 18)}… matches on-chain commit`),
    )
  }

  const skill = findSkill(verified.card, skillName)
  const fullUrl = verified.card.url.replace(/\/$/, '') + skill.endpoint
  const input = await readInput(opts)
  const idempotencyKey = newIdempotencyKey()

  if (!opts.json) {
    console.error(kleur.dim(`↳ POST ${fullUrl}`))
    console.error(kleur.dim(`  Idempotency-Key: ${idempotencyKey}`))
    console.error(kleur.dim(`  payload: ${JSON.stringify(input)}`))
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  }
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })

  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  const body = ct.includes('application/json')
    ? (JSON.parse(text) as unknown)
    : text

  if (opts.json) {
    const payload = {
      agentId: verified.agentId,
      cardURI: verified.cardURI,
      onChainHash: verified.onChainHash,
      computedHash: verified.computedHash,
      verified: true,
      skill: skillName,
      endpoint: fullUrl,
      idempotencyKey,
      status: res.status,
      response: body,
    }
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
    if (!res.ok) process.exitCode = 1
    return
  }

  console.error('')
  if (res.ok) {
    console.error(kleur.green().bold(`  ✓ HTTP ${res.status} — skill responded`))
    console.error('')
    console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
  } else {
    console.error(kleur.red().bold(`  ✗ HTTP ${res.status} ${res.statusText}`))
    console.error('')
    console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
    process.exitCode = 1
  }
}

export async function runListSkills(agentIdRaw: string): Promise<void> {
  const cfg = loadConfig()
  const verified = await fetchAndVerifyCard(agentIdRaw, cfg)

  console.error(kleur.dim(`agent #${verified.agentId} · ${verified.card.name}`))
  console.error(kleur.dim(`url     ${verified.card.url}`))
  console.error(
    kleur.dim(`verified ${verified.computedHash.slice(0, 18)}… ✓ matches on-chain commit`),
  )
  console.error('')

  for (const s of verified.card.skills ?? []) {
    console.log(kleur.cyan().bold(s.name))
    console.log(`  endpoint  POST ${s.endpoint}`)
    if (s.description) console.log(`  desc      ${s.description}`)
    if (s.inputSchema) {
      const required = (s.inputSchema as { required?: string[] }).required ?? []
      const props = Object.keys(
        (s.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
      )
      console.log(
        `  inputs    ${props.map((p) => (required.includes(p) ? kleur.bold(p) + '*' : p)).join(', ') || '(none)'}`,
      )
    }
    console.log('')
  }
}
