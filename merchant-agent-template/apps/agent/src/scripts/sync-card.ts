/**
 * sync-card — register or update this merchant's agent-card on the
 * ERC-8004 IdentityRegistry contract.
 *
 *   pnpm sync-card --dry-run    # build card, print hash + calldata, no tx
 *   pnpm sync-card               # actually broadcast (needs SYNC_PRIVATE_KEY)
 *
 * Flow
 * ────
 *   1. Load agent-card from local store + skill loader
 *   2. Compute canonical-JSON SHA-256 hash
 *   3. If AGENT_ID is set: read on-chain hash; skip tx if equal, else
 *      send IdentityRegistry.update(agentId, uri, newHash)
 *   4. If AGENT_ID is empty: send IdentityRegistry.register(uri, hash),
 *      parse the AgentRegistered event, append AGENT_ID=<id> to .env
 *
 * Required env vars (live mode):
 *   RPC_URL                 — JSON-RPC endpoint (Base Sepolia / mainnet)
 *   IDENTITY_REGISTRY       — deployed contract address
 *   SYNC_PRIVATE_KEY        — agent owner wallet (do NOT reuse mainnet keys)
 *   AGENT_CARD_URI          — public URL of the agent-card (defaults to
 *                             `${PUBLIC_URL}/.well-known/agent-card.json`)
 *
 * Optional:
 *   AGENT_ID                — set after first register; triggers update path
 *   --dry-run               — skip all chain reads/writes
 */

import 'dotenv/config';
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadConfig();

  const dbPath = (process.env.STORE_URL ?? 'file:./data/agent.db').replace(/^file:/, '');
  const store = new SQLiteStore(dbPath);

  try {
    // ── 1. Build canonical agent-card + hash ─────────────────────────
    const settings = await store.getSettings();
    const card = buildAgentCard({
      config, settings, skills,
      agentVersion: (packageJson as { version: string }).version,
    });
    const json = canonicalJson(card);
    const hash = cardHash(card) as Hex;          // 0x-prefixed 32-byte
    const uri  = process.env.AGENT_CARD_URI
              ?? `${config.publicUrl}/.well-known/agent-card.json`;

    console.log('agent-card');
    console.log(`  uri:   ${uri}`);
    console.log(`  hash:  ${hash}`);
    console.log(`  bytes: ${Buffer.byteLength(json)} (canonical JSON)`);
    console.log('');

    // ── 2. Dry-run: stop here ────────────────────────────────────────
    if (dryRun) {
      console.log('--dry-run set — skipping chain calls.');
      printResult({ hash, uri, agentId: config.agentId !== null ? BigInt(config.agentId) : null,
                    txHash: null, action: 'dry-run' });
      return;
    }

    // ── 3. Live mode preflight ───────────────────────────────────────
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

    // ── 4. Update path ───────────────────────────────────────────────
    if (config.agentId !== null) {
      const agentId = BigInt(config.agentId);
      const onchain = await publicClient.readContract({
        address: registry, abi: REGISTRY_ABI, functionName: 'getAgent', args: [agentId],
      });
      const [owner, , onchainHash] = onchain;
      if (owner.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error(`AGENT_ID ${agentId} is owned by ${owner}, not signer ${account.address}`);
      }
      if (onchainHash === hash) {
        console.log(`agentId ${agentId} already at hash ${hash} — no-op.`);
        printResult({ hash, uri, agentId, txHash: null, action: 'noop' });
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
      printResult({ hash, uri, agentId, txHash, action: 'update' });
      return;
    }

    // ── 5. Register path ─────────────────────────────────────────────
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
    printResult({ hash, uri, agentId: newAgentId, txHash, action: 'register' });
  } finally {
    store.close();
  }
}

function printResult(r: SyncResult): void {
  console.log('');
  console.log('result:');
  console.log(`  action:   ${r.action}`);
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
