/**
 * sync-card — register or update this merchant's agent-card on the
 * ERC-8004 IdentityRegistry contract.
 *
 *   pnpm sync-card --dry-run           # fetch live URL + show what would land on chain
 *   pnpm sync-card                      # actually broadcast (needs SYNC_PRIVATE_KEY)
 *   pnpm sync-card --from-local         # compute hash from LOCAL store (legacy / debug)
 *
 * Architecture
 * ────────────
 * The on-chain hash MUST commit to the bytes the URL actually serves.
 * Earlier versions of this script computed the hash from the local
 * SQLite store, but local and deployed stores drift (different env
 * vars, separate seedings, etc.) and the local hash ≠ live hash silently
 * breaks the verification invariant.
 *
 * Default behavior (live-truth):
 *   1. GET the AGENT_CARD_URI, read body bytes
 *   2. SHA-256 those bytes → that IS the hash that goes on chain
 *   3. Sanity-check: the server's X-Card-SHA256 header must equal it
 *   4. Compare against on-chain hash; register / update / no-op
 *
 * Required env vars (live mode):
 *   RPC_URL                — JSON-RPC endpoint
 *   IDENTITY_REGISTRY      — deployed contract address
 *   SYNC_PRIVATE_KEY       — agent owner wallet
 *   PUBLIC_URL or AGENT_CARD_URI — where the card is served
 *
 * Optional:
 *   AGENT_ID               — set after first register; triggers update path
 *   --dry-run              — skip all chain writes (reads + URL fetch still happen)
 *   --from-local           — use local store instead of live URL (debug only)
 */

import 'dotenv/config';
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import {
  createPublicClient, createWalletClient, http, parseAbi, parseEventLogs,
  type Hex, type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

import { loadConfig } from '../core/config.js';
import { SQLiteStore } from '../stores/sqlite.js';
import { buildAgentCard, cardHash, canonicalJson } from '../core/card.js';
import { skills } from '../routes/skill_loader.js';
import packageJson from '../../package.json' with { type: 'json' };

const REGISTRY_ABI = parseAbi([
  'function register(string agentCardURI, bytes32 agentCardHash) returns (uint256)',
  'function update(uint256 agentId, string newURI, bytes32 newHash)',
  'function getAgent(uint256 agentId) view returns (address owner, string agentCardURI, bytes32 agentCardHash, uint64 registeredAt, uint64 updatedAt, bool active)',
  'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentCardURI, bytes32 agentCardHash)',
  'event AgentUpdated(uint256 indexed agentId, string agentCardURI, bytes32 agentCardHash)',
]);

interface SyncResult {
  hash:        Hex;
  uri:         string;
  agentId:     bigint | null;
  txHash:      Hex | null;
  action:      'noop' | 'register' | 'update' | 'dry-run';
  source:      'live-url' | 'local-store';
}

async function fetchLiveCardHash(uri: string): Promise<{ hash: Hex; bytes: number; headerHash: string | null }> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`fetch ${uri} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const computed = ('0x' + createHash('sha256').update(buf).digest('hex')) as Hex;
  const headerHash = res.headers.get('x-card-sha256');
  if (headerHash && headerHash.toLowerCase() !== computed.toLowerCase()) {
    throw new Error(
      `server is dishonest: body SHA-256 = ${computed} but X-Card-SHA256 header = ${headerHash}.\n` +
      `  fix your agent's response (the header must match the body)`,
    );
  }
  return { hash: computed, bytes: buf.length, headerHash };
}

function computeLocalCardHash(
  store: SQLiteStore,
  config: ReturnType<typeof loadConfig>,
): Promise<{ hash: Hex; bytes: number }> {
  return store.getSettings().then((settings) => {
    const card = buildAgentCard({
      config, settings, skills,
      agentVersion: (packageJson as { version: string }).version,
    });
    const json = canonicalJson(card);
    return {
      hash:  cardHash(card) as Hex,
      bytes: Buffer.byteLength(json, 'utf-8'),
    };
  });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const useLocal = process.argv.includes('--from-local');
  const config = loadConfig();

  const dbPath = (process.env.STORE_URL ?? 'file:./data/agent.db').replace(/^file:/, '');
  const store = new SQLiteStore(dbPath);

  try {
    const uri = process.env.AGENT_CARD_URI
             || `${config.publicUrl}/.well-known/agent-card.json`;

    let hash: Hex;
    let bytes: number;
    let source: 'live-url' | 'local-store';

    if (useLocal) {
      const r = await computeLocalCardHash(store, config);
      hash = r.hash; bytes = r.bytes; source = 'local-store';
      console.log('source: LOCAL STORE  (--from-local; for debug only)');
    } else {
      const r = await fetchLiveCardHash(uri);
      hash = r.hash; bytes = r.bytes; source = 'live-url';
      console.log('source: LIVE URL     (server-attested, header matches body)');
    }

    console.log(`uri:    ${uri}`);
    console.log(`hash:   ${hash}`);
    console.log(`bytes:  ${bytes}`);
    console.log('');

    // Sanity warning: when using live mode, also compute local hash and warn
    // if they differ — that means the local store will drift from chain on
    // next deploy, and you should re-seed before redeploying.
    if (!useLocal) {
      try {
        const local = await computeLocalCardHash(store, config);
        if (local.hash.toLowerCase() !== hash.toLowerCase()) {
          console.log('⚠ local store hash differs from live URL:');
          console.log(`    local: ${local.hash}`);
          console.log(`    live:  ${hash}`);
          console.log('  This is fine for register/update (we use live as truth),');
          console.log('  but means re-deploying with local settings would change the hash.');
          console.log('  Re-seed local (pnpm setup) or align env vars before re-deploying.');
          console.log('');
        }
      } catch { /* local store may not be seeded — ignore */ }
    }

    if (dryRun) {
      console.log('--dry-run set — skipping chain writes.');
      printResult({
        hash, uri, source,
        agentId: config.agentId !== null ? BigInt(config.agentId) : null,
        txHash: null, action: 'dry-run',
      });
      return;
    }

    if (!config.identityRegistry) throw new Error('IDENTITY_REGISTRY env var is not set');
    const pk = process.env.SYNC_PRIVATE_KEY as Hex | undefined;
    if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      throw new Error('SYNC_PRIVATE_KEY env var must be set to a 0x-prefixed 32-byte hex private key');
    }
    if (!config.rpcUrl) throw new Error('RPC_URL env var is not set');

    const chain = config.chainId === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(pk);
    const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
    const walletClient = createWalletClient({ chain, account, transport: http(config.rpcUrl) });
    const registry = config.identityRegistry as Address;

    console.log(`chain:    ${chain.name} (chainId ${chain.id})`);
    console.log(`signer:   ${account.address}`);
    console.log(`registry: ${registry}`);
    console.log('');

    if (config.agentId !== null) {
      const agentId = BigInt(config.agentId);
      const onchain = await publicClient.readContract({
        address: registry, abi: REGISTRY_ABI, functionName: 'getAgent', args: [agentId],
      });
      const [owner, , onchainHash] = onchain;
      if (owner.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error(`AGENT_ID ${agentId} is owned by ${owner}, not signer ${account.address}`);
      }
      if (onchainHash.toLowerCase() === hash.toLowerCase()) {
        console.log(`agentId ${agentId} already at hash ${hash} — no-op.`);
        printResult({ hash, uri, source, agentId, txHash: null, action: 'noop' });
        return;
      }
      console.log(`updating agentId ${agentId}: ${onchainHash} -> ${hash}`);
      const txHash = await walletClient.writeContract({
        address: registry, abi: REGISTRY_ABI, functionName: 'update',
        args: [agentId, uri, hash],
      });
      console.log(`tx:       ${txHash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`status:   ${receipt.status}  (block ${receipt.blockNumber})`);
      printResult({ hash, uri, source, agentId, txHash, action: 'update' });
      return;
    }

    console.log('registering new agent…');
    const txHash = await walletClient.writeContract({
      address: registry, abi: REGISTRY_ABI, functionName: 'register',
      args: [uri, hash],
    });
    console.log(`tx:       ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`status:   ${receipt.status}  (block ${receipt.blockNumber})`);

    const events = parseEventLogs({
      abi: REGISTRY_ABI, eventName: 'AgentRegistered', logs: receipt.logs,
    });
    const event = events[0];
    if (!event) throw new Error('no AgentRegistered event found in tx receipt');
    const newAgentId = event.args.agentId;

    appendAgentIdToEnv(newAgentId);
    console.log(`agentId:  ${newAgentId} (written to .env)`);
    printResult({ hash, uri, source, agentId: newAgentId, txHash, action: 'register' });
  } finally {
    store.close();
  }
}

function printResult(r: SyncResult): void {
  console.log('');
  console.log('result:');
  console.log(`  action:   ${r.action}`);
  console.log(`  source:   ${r.source}`);
  console.log(`  agentId:  ${r.agentId ?? '(none)'}`);
  console.log(`  hash:     ${r.hash}`);
  if (r.txHash) console.log(`  txHash:   ${r.txHash}`);
}

function appendAgentIdToEnv(agentId: bigint): void {
  const envPath = resolve(process.cwd(), '.env');
  let body = '';
  try { body = readFileSync(envPath, 'utf8'); } catch { /* empty */ }
  if (/^AGENT_ID=/m.test(body)) {
    console.log(`(skip writing .env — AGENT_ID already present, please update manually to ${agentId})`);
    return;
  }
  appendFileSync(envPath, `\nAGENT_ID=${agentId}\n`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
