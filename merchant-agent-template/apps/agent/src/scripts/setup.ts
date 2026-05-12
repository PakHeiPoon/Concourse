/**
 * One-shot setup: initializes the SQLite DB, seeds settings + a few
 * sample inventory items + a 90-day calendar so the agent has data to
 * serve from the moment it boots.
 *
 * Usage:
 *   pnpm --filter agent setup
 *   # or:  tsx src/scripts/setup.ts
 *
 * Idempotent: running twice is safe (upserts, not deletes).
 */

import 'dotenv/config';
import { SQLiteStore } from '../stores/sqlite.js';
import type { MerchantSettings } from '../core/types.js';

// ─── Sample data: Wuming Chu (Huangshan boutique hotel) ──────────────
// Pulled from docs/presentation/wumingchu-huangshan-mock.json — same
// merchant we used as seed test data when the project still had mocks.
// Now it's a real merchant-agent serving real (mock-but-realistic) inventory.

const SETTINGS: MerchantSettings = {
  name: {
    en: 'Wuming Chu · Huangshan Hidden Retreat',
    zh: '黄山无名初隐世酒店',
  },
  description: {
    en: '28-room boutique hideaway nestled in the cloud-shrouded valleys of Huangshan, restored from a century-old Hui-style courtyard estate.',
    zh: '藏于黄山云谷腹地的隐世精品酒店，由当地百年徽派古宅修缮而成，仅设 28 间客房。',
  },
  merchantType: 'hotel',
  location: {
    country:     'CN',
    city:        'huangshan',
    address:     '安徽省黄山市黄山风景区云谷寺路侧（毗邻云谷索道下站）',
    coordinates: { lat: 30.1372, lng: 118.1856 },
    timezone:    'Asia/Shanghai',
  },
  contact: {
    phone:      '+86 559 558 6688',
    email:      'stay@wumingchu.com',
    websiteUrl: 'https://wumingchu.com',
  },
  cancellationPolicy: {
    type: 'tiered',
    tiers: [
      { hoursBeforeStart: 168, refundPercent: 100 }, // 7d+
      { hoursBeforeStart: 72,  refundPercent: 50  }, // 3d+
      { hoursBeforeStart: 0,   refundPercent: 0   }, // <3d
    ],
    freeReschedulingHours: 48,
  },
  payment: {
    chain:           'base-sepolia',
    chainId:         84532,
    // `||` (not `??`) so empty strings from a partially-filled .env fall
    // through to the next source — otherwise PAYOUT_ADDRESS="" (a common
    // .env mistake) silently overrides AGENT_OWNER_ADDRESS and breaks
    // the agent-card hash invariant.
    payoutAddress:   (process.env.PAYOUT_ADDRESS
                   || process.env.AGENT_OWNER_ADDRESS
                   || '0x0000000000000000000000000000000000000000').trim(),
    currency:        'USDC',
    currencyAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    // BookingEscrow gets filled in once Phase B ships:
    // escrow: { contract: '0x...', disputeWindowSeconds: 86400 },
  },
  languagesSupported: ['zh', 'en'],
  priceLevel:         5,
  tags:               ['boutique', 'retreat', 'mountain', 'huizhou-architecture', 'hot-spring'],
  specifics: {
    starRating:    5,
    checkInTime:   '15:00',
    checkOutTime:  '12:00',
    breakfastIncluded: true,
    parkingAvailable:  true,
  },
};

// Three room types representative of the original mock
const ROOM_TYPES = [
  {
    itemId:     'mountain_view',
    nameEn:     'Mountain View Room',
    nameZh:     '云栖山景房',
    descEn:     'Floor-to-ceiling windows facing pine-clad valleys.',
    descZh:     '落地窗外是郁郁苍苍的松涛山谷。',
    rateUsdc:   1820,
    stockPerNight: 12,
  },
  {
    itemId:     'pine_terrace',
    nameEn:     'Pine Terrace Room',
    nameZh:     '松隐露台房',
    descEn:     'Private outdoor terrace shaded by ancient camphor trees.',
    descZh:     '私享室外露台，百年香樟下饮茶观景。',
    rateUsdc:   2480,
    stockPerNight: 8,
  },
  {
    itemId:     'spring_pool',
    nameEn:     'Spring Pool Courtyard Room',
    nameZh:     '汤池院子房',
    descEn:     'Direct access to a private spring-fed soaking pool.',
    descZh:     '直通独立汤池，山泉水温润。',
    rateUsdc:   3680,
    stockPerNight: 6,
  },
];

// ─── Run ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dbPath = (process.env.STORE_URL ?? 'file:./data/agent.db').replace(/^file:/, '');
  const store = new SQLiteStore(dbPath);

  console.log(`writing settings to ${dbPath}`);
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
