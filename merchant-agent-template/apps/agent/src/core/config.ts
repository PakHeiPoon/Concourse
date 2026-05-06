/**
 * Reads .env into a typed AgentConfig. Single source of truth for the
 * runtime — every other module asks for `config` rather than reading
 * process.env directly. Makes testing trivial (just hand a built object).
 */

import 'dotenv/config';
import type { AgentConfig } from './types.js';

function get(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function getOptional(name: string): string | null {
  const v = process.env[name];
  return v === undefined || v === '' ? null : v;
}

function getInt(name: string, fallback?: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} is not a number: ${v}`);
  return n;
}

export function loadConfig(): AgentConfig {
  const chainId    = getInt('CHAIN_ID', 84532);
  const chainAlias = chainId === 8453 ? 'base'
                  : chainId === 84532 ? 'base-sepolia'
                  : `chain-${chainId}`;

  const agentIdRaw = getOptional('AGENT_ID');

  return {
    agentId:           agentIdRaw === null ? null : Number(agentIdRaw),
    agentOwnerAddress: get('AGENT_OWNER_ADDRESS', '0x0000000000000000000000000000000000000000').toLowerCase(),

    publicUrl:         get('PUBLIC_URL', 'http://localhost:8787'),
    port:              getInt('PORT', 8787),

    chainId,
    chainAlias,
    rpcUrl:            get('RPC_URL', 'https://sepolia.base.org'),
    identityRegistry:  getOptional('IDENTITY_REGISTRY'),
    reputationRegistry: getOptional('REPUTATION_REGISTRY'),
    bookingEscrow:     getOptional('BOOKING_ESCROW'),
    usdcAddress:       get('USDC_ADDRESS', '0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
    payoutAddress:     getOptional('PAYOUT_ADDRESS')
      ?? get('AGENT_OWNER_ADDRESS', '0x0000000000000000000000000000000000000000'),

    llm: {
      provider: getOptional('LLM_PROVIDER'),
      baseUrl:  getOptional('LLM_BASE_URL'),
      apiKey:   getOptional('LLM_API_KEY'),
      model:    getOptional('LLM_MODEL'),
    },

    tenantId: getOptional('TENANT_ID'),
  };
}
