/**
 * sync-card — registers (or updates) this merchant's agent-card hash on
 * the IdentityRegistry contract.
 *
 * Phase A.3 status: STUB. Returns the hash + canonical JSON without
 * touching the chain. Once contracts/erc8004 is deployed to Base
 * Sepolia (Phase A.2) and the addresses land in
 * docs/architecture/DEPLOY_ADDRESSES.md, this script will:
 *
 *   1. Build the agent-card from local settings + skills
 *   2. Compute its SHA-256 hash
 *   3. Upload to IPFS / pin to Pinata (or use a self-hosted CDN URL)
 *   4. Call IdentityRegistry.register(uri, hash) if AGENT_ID is empty
 *      OR IdentityRegistry.update(agentId, uri, hash) if AGENT_ID is set
 *   5. Write the new agentId back to .env
 *
 * For now we just print the hash so merchants can manually call
 * `cast send` against the deployed registry.
 */

import 'dotenv/config';
import { loadConfig } from '../core/config.js';
import { SQLiteStore } from '../stores/sqlite.js';
import { buildAgentCard, cardHash, canonicalJson } from '../core/card.js';
import { skills } from '../routes/skill_loader.js';
import packageJson from '../../package.json' with { type: 'json' };

async function main(): Promise<void> {
  const config = loadConfig();
  const dbPath = (process.env.STORE_URL ?? 'file:./data/agent.db').replace(/^file:/, '');
  const store = new SQLiteStore(dbPath);

  const settings = await store.getSettings();
  const card = buildAgentCard({
    config,
    settings,
    skills,
    agentVersion: (packageJson as { version: string }).version,
  });

  const json = canonicalJson(card);
  const hash = cardHash(card);

  console.log('=== agent-card.json (canonical) ===');
  console.log(json);
  console.log('');
  console.log('=== SHA-256 hash ===');
  console.log(hash);
  console.log('');

  if (!config.identityRegistry) {
    console.log('IDENTITY_REGISTRY env var is not set — skipping on-chain step.');
    console.log('');
    console.log('Once contracts are deployed (Phase A.2), set IDENTITY_REGISTRY in .env');
    console.log('and re-run this script.');
    store.close();
    return;
  }

  console.log('=== TODO (Phase A.4) ===');
  console.log('  1. Pin canonical JSON to IPFS / your CDN');
  console.log('  2. Get the public URL (this becomes agentCardURI on chain)');
  console.log('  3. cast send <IDENTITY_REGISTRY> "register(string,bytes32)" \\');
  console.log(`      "<your_card_url>" "${hash}" \\`);
  console.log('     --rpc-url ' + config.rpcUrl);
  console.log('  4. Pull the agentId from the AgentRegistered event log');
  console.log('  5. Set AGENT_ID=<id> in .env');

  store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
