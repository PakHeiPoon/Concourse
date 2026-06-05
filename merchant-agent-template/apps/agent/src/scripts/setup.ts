/**
 * One-shot setup: initializes the SQLite DB, seeds settings + a few
 * sample inventory items + a 90-day calendar so the agent has data to
 * serve from the moment it boots.
 *
 * Usage:
 *   pnpm --filter agent setup                       # MERCHANT defaults to wumingchu
 *   MERCHANT=four-seasons-hangzhou pnpm setup        # seed a different merchant
 *   # or:  tsx src/scripts/setup.ts
 *
 * Which merchant gets seeded is selected by the MERCHANT env var (see
 * ./profiles). One template codebase serves many merchant-agents — each
 * instance picks its profile + its own PUBLIC_URL + payout wallet.
 *
 * Idempotent: running twice is safe (upserts, not deletes).
 */

import 'dotenv/config';
import { SQLiteStore } from '../stores/sqlite.js';
import type { MerchantSettings } from '../core/types.js';
import { getProfile } from './profiles/index.js';

const MERCHANT = (process.env.MERCHANT ?? 'wumingchu').trim();
const profile = getProfile(MERCHANT);

// `||` (not `??`) so empty strings from a partially-filled .env fall through
// to the next source — otherwise PAYOUT_ADDRESS="" (a common .env mistake)
// silently overrides AGENT_OWNER_ADDRESS and breaks the agent-card hash.
const payoutAddress = (process.env.PAYOUT_ADDRESS
                    || process.env.AGENT_OWNER_ADDRESS
                    || '0x0000000000000000000000000000000000000000').trim();

const SETTINGS: MerchantSettings = {
  ...profile.settings,
  payment: { ...profile.settings.payment, payoutAddress },
};

const ROOM_TYPES = profile.roomTypes;

// ─── Run ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dbPath = (process.env.STORE_URL ?? 'file:./data/agent.db').replace(/^file:/, '');
  const store = new SQLiteStore(dbPath);

  console.log(`seeding merchant "${MERCHANT}" → ${dbPath}`);
  await store.setSettings(SETTINGS);

  console.log('upserting room types');
  for (const r of ROOM_TYPES) {
    await store.upsertItem({
      itemId:        r.itemId,
      itemType:      'room_type',
      name:          { en: r.nameEn, zh: r.nameZh },
      description:   { en: r.descEn, zh: r.descZh },
      baseRateUsdc:  r.rateUsdc * 1_000_000,    // base units (6 decimals)
      attributes:    {},
      active:        true,
    });
  }

  console.log('seeding 90-day calendar');
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (const r of ROOM_TYPES) {
    for (let i = 0; i < 90; i++) {
      const d = new Date(today.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      await store.setAvailability(r.itemId, d, r.stockPerNight);
    }
  }

  store.close();
  console.log('✓ setup complete. Run `pnpm dev` to start the agent.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
