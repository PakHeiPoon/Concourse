#!/usr/bin/env node
import { Command } from 'commander'
import { runList } from './commands/list.js'
import { runFetch } from './commands/fetch.js'
import { runInvoke, runListSkills } from './commands/invoke.js'

const program = new Command()

program
  .name('concourse-discover')
  .description(
    'Discover, verify, and invoke ERC-8004 / A2A agents directly from chain — no platform required.',
  )
  .version('0.1.0-alpha.1')

program
  .command('list')
  .description('List all agents registered on the IdentityRegistry')
  .option('--all', 'include inactive agents', false)
  .option('--json', 'machine-readable output', false)
  .action(async (opts: { all: boolean; json: boolean }) => {
    await runList({ includeInactive: opts.all, json: opts.json })
  })

program
  .command('skills <agentId>')
  .description('List skills exposed by a verified agent card')
  .action(async (agentId: string) => {
    await runListSkills(agentId)
  })

program
  .command('invoke <agentId> <skill>')
  .description('Verify the agent card, then POST the skill payload (auto Idempotency-Key)')
  .option('-d, --data <json>', 'JSON payload string')
  .option('--data-file <path>', 'JSON payload file path')
  .option('--bearer <token>', 'Authorization: Bearer <token>')
  .option('--skip-verify', 'DANGEROUS — skip on-chain hash verification', false)
  .option('--json', 'machine-readable output', false)
  .action(
    async (
      agentId: string,
      skill: string,
      opts: {
        data?: string
        dataFile?: string
        bearer?: string
        skipVerify: boolean
        json: boolean
      },
    ) => {
      await runInvoke(agentId, skill, {
        data: opts.data,
        dataFile: opts.dataFile,
        bearer: opts.bearer,
        skipVerify: opts.skipVerify,
        json: opts.json,
      })
    },
  )

program
  .command('fetch <agentId>')
  .description('Fetch an agent card, verify SHA-256 against on-chain commit, ABORT on mismatch')
  .option('--json', 'machine-readable output', false)
  .option('--save <path>', 'also save the raw card bytes to a file')
  .option('--mutate', 'flip one byte before hashing (demonstrates the ABORT path)', false)
  .action(
    async (
      agentId: string,
      opts: { json: boolean; save?: string; mutate: boolean },
    ) => {
      await runFetch(agentId, {
        json: opts.json,
        save: opts.save,
        mutate: opts.mutate,
      })
    },
  )

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
