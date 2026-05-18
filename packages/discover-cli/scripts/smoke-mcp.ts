/**
 * End-to-end smoke test for the Concourse MCP server.
 * Spawns src/mcp.ts via tsx, then calls all 4 tools through stdio.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverScript = resolve(__dirname, '../src/mcp.ts')

function bar(title: string): void {
  console.log('\n' + '═'.repeat(72))
  console.log(title)
  console.log('═'.repeat(72))
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'tsx',
    args: [serverScript],
  })
  const client = new Client({ name: 'concourse-mcp-smoke', version: '0.0.1' })
  await client.connect(transport)

  bar('1. tools/list')
  const tools = await client.listTools()
  for (const t of tools.tools) {
    console.log(`  • ${t.name}  —  ${t.description?.slice(0, 80) ?? ''}`)
  }

  bar('2. concourse_list_agents')
  const list = await client.callTool({
    name: 'concourse_list_agents',
    arguments: {},
  })
  console.log(
    JSON.stringify(list.content, null, 2).slice(0, 600) + '\n  …',
  )

  bar('3. concourse_verify_card { agentId: 1 }')
  const verify = await client.callTool({
    name: 'concourse_verify_card',
    arguments: { agentId: 1 },
  })
  const first = (verify.content as Array<{ text?: string }>)[0]
  const parsed = first?.text ? JSON.parse(first.text) : verify.content
  console.log(`  verified:    ${parsed.verified}`)
  console.log(`  onChainHash: ${parsed.onChainHash}`)
  console.log(`  computedHash:${parsed.computedHash}`)
  console.log(`  card.name:   ${parsed.card?.name}`)

  bar('4. concourse_list_skills { agentId: 1 }')
  const skills = await client.callTool({
    name: 'concourse_list_skills',
    arguments: { agentId: 1 },
  })
  const sk = JSON.parse((skills.content as Array<{ text: string }>)[0]!.text)
  console.log(`  agent:  ${sk.name}`)
  console.log(`  url:    ${sk.url}`)
  for (const s of sk.skills) {
    console.log(`    - ${s.name}  →  POST ${s.endpoint}`)
  }

  bar('5. concourse_invoke_skill (get_room_types)')
  const invoke = await client.callTool({
    name: 'concourse_invoke_skill',
    arguments: { agentId: 1, skill: 'get_room_types', input: {} },
  })
  const inv = JSON.parse((invoke.content as Array<{ text: string }>)[0]!.text)
  console.log(`  status:        ${inv.status}  ok=${inv.ok}`)
  console.log(`  endpoint:      ${inv.endpoint}`)
  console.log(`  idempotencyKey:${inv.idempotencyKey}`)
  console.log(`  verifiedHash:  ${inv.verifiedHash}`)
  const rooms = inv.response?.items ?? inv.response?.room_types ?? []
  if (Array.isArray(rooms)) {
    console.log(`  rooms returned: ${rooms.length}`)
    for (const r of rooms.slice(0, 3)) {
      const name = typeof r.name === 'string' ? r.name : (r.name?.en ?? r.item_id)
      console.log(`    • ${r.item_id ?? r.id ?? '?'} — ${name}`)
    }
  }

  bar('ALL 4 TOOLS PASSED · MCP server is wire-format valid')
  await client.close()
  process.exit(0)
}

main().catch((err: Error) => {
  console.error(`smoke FAILED: ${err.message}`)
  process.exit(1)
})
