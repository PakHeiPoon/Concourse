/**
 * Hono entry — wires everything together and starts the HTTP server.
 *
 *   app
 *   ├─ GET  /health
 *   ├─ GET  /.well-known/agent-card.json    (per A2A spec)
 *   ├─ POST /auth/challenge
 *   ├─ POST /auth/verify
 *   └─ POST /skills/<each>                  (auto-mounted from skill_loader)
 *
 * The Hono runtime is portable: this same code runs on Node (default),
 * Bun, Cloudflare Workers, Vercel Edge, and Fly Machines. Switch by
 * picking a different `@hono/*-server` adapter in your hosting platform.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { z, ZodError } from 'zod';

import { loadConfig } from './core/config.js';
import { SQLiteStore } from './stores/sqlite.js';
import {
  AuthError, mintChallenge, verifyAndMintToken, resolveToken,
} from './core/auth.js';
import { buildAgentCard, cardHash, canonicalJson } from './core/card.js';
import { SkillError, type SkillContext, type AgentConfig, type MerchantStore } from './core/types.js';
import { skills } from './routes/skill_loader.js';

import packageJson from '../package.json' with { type: 'json' };

// ─── Boot ─────────────────────────────────────────────────────────────

const config: AgentConfig = loadConfig();
const store: MerchantStore = new SQLiteStore(
  resolveSqlitePath(process.env.STORE_URL ?? 'file:./data/agent.db'),
);

console.log('booting merchant-agent', {
  publicUrl: config.publicUrl,
  port:      config.port,
  agentId:   config.agentId,
  chain:     config.chainAlias,
});

const app = new Hono();

app.use('*', honoLogger());
app.use('/skills/*',                 cors({ origin: '*' }));
app.use('/.well-known/*',            cors({ origin: '*' }));
app.use('/auth/*',                   cors({ origin: '*' }));

// ─── /health ─────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', agentId: config.agentId }));

// ─── /.well-known/agent-card.json ────────────────────────────────────

app.get('/.well-known/agent-card.json', async () => {
  const settings = await store.getSettings();
  const card = buildAgentCard({
    config,
    settings,
    skills,
    agentVersion: (packageJson as { version: string }).version,
  });
  // Serve the canonical bytes — the same string we'd hash. Clients that
  // verify SubresourceIntegrity-style will compare against the on-chain
  // commit, so we MUST emit exactly the canonical form.
  return new Response(canonicalJson(card), {
    headers: {
      'Content-Type':    'application/json; charset=utf-8',
      'Cache-Control':   'public, max-age=300',
      'X-Card-SHA256':   cardHash(card),
    },
  });
});

// ─── /auth ───────────────────────────────────────────────────────────

const challengeSchema = z.object({
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '0x-prefixed 20-byte hex'),
});

const verifySchema = z.object({
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  nonce:          z.string().min(1),
  signature:      z.string().regex(/^0x[a-fA-F0-9]{130}$/, '0x-prefixed 65-byte hex'),
});

app.post('/auth/challenge', async (c) => {
  const body = await safeJson(c);
  const { wallet_address } = challengeSchema.parse(body);
  return c.json(mintChallenge(wallet_address));
});

app.post('/auth/verify', async (c) => {
  const body = await safeJson(c);
  const { wallet_address, nonce, signature } = verifySchema.parse(body);
  const result = await verifyAndMintToken(wallet_address, nonce, signature as `0x${string}`);
  return c.json(result);
});

// ─── /skills/<name> ──────────────────────────────────────────────────

// Mount one POST route per skill. Strict input validation, owner-of-
// caller resolution, error normalization. Phase B will wrap the whole
// stack in x402 middleware for paid skills.
for (const skill of skills) {
  app.post(skill.endpoint, async (c) => {
    // Idempotency-Key check (skills that mutate state require it)
    const idempotencyKey = c.req.header('Idempotency-Key') ?? undefined;
    if (skill.idempotencyKey === 'required' && !idempotencyKey) {
      return c.json({ error: 'IDEMPOTENCY_KEY_REQUIRED', skill: skill.name }, 400);
    }

    // Optional bearer token resolution. Used by skills that want to
    // know who is calling (e.g. for booking attribution). Skills can
    // ignore `caller`; nothing breaks if a caller passes no auth.
    const auth = c.req.header('Authorization');
    let caller: string | null = null;
    if (auth?.startsWith('Bearer ')) {
      caller = resolveToken(auth.slice('Bearer '.length).trim());
    }

    // Strict input validation
    const raw = await safeJson(c);
    const parsedInput = skill.inputSchema.safeParse(raw);
    if (!parsedInput.success) {
      return c.json({
        error:  'INVALID_INPUT',
        skill:  skill.name,
        issues: parsedInput.error.issues,
      }, 400);
    }

    // Build skill context (lazily; LLM only created if config has provider)
    const ctx: SkillContext = {
      store,
      config,
      caller,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    };

    try {
      const result = await skill.handle({ input: parsedInput.data, ctx, payment: null });
      // Validate output (catches handler regressions)
      const parsedOutput = skill.outputSchema.safeParse(result);
      if (!parsedOutput.success) {
        console.error('skill output schema mismatch', skill.name, parsedOutput.error.issues);
        return c.json({ error: 'INTERNAL_OUTPUT_INVALID', skill: skill.name }, 500);
      }
      return c.json(parsedOutput.data);
    } catch (err) {
      if (err instanceof SkillError) {
        return c.json({ error: err.code, message: err.message }, err.status as 400 | 401 | 403 | 404);
      }
      if (err instanceof ZodError) {
        return c.json({ error: 'ZOD_ERROR', issues: err.issues }, 400);
      }
      console.error('skill handler threw', skill.name, err);
      return c.json({ error: 'INTERNAL', message: (err as Error).message }, 500);
    }
  });
}

// ─── Global error handler ────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof AuthError) {
    return c.json({ error: 'AUTH_FAILED', message: err.message }, err.status as 400 | 401 | 403);
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'INVALID_INPUT', issues: err.issues }, 400);
  }
  console.error('unhandled error', err);
  return c.json({ error: 'INTERNAL', message: (err as Error).message }, 500);
});

// ─── Start (skip when imported by tests) ─────────────────────────────

const isMain = (import.meta.url ?? '').endsWith(
  process.argv[1]?.replace(/^file:\/\//, '') ?? '',
);
const isDev = process.env.NODE_ENV !== 'test';

if (isMain || isDev) {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`merchant-agent listening on http://localhost:${info.port}`);
    console.log(`  agent-card: ${config.publicUrl}/.well-known/agent-card.json`);
  });
}

// Export for tests
export { app, store, config };

// ─── Helpers ─────────────────────────────────────────────────────────

async function safeJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try { return await c.req.json(); } catch { return {}; }
}

function resolveSqlitePath(url: string): string {
  // Drizzle uses better-sqlite3 with a plain filename; strip 'file:' prefix
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}
