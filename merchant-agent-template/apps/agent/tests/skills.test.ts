import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { SQLiteStore } from '../src/stores/sqlite.js';
import check_availability       from '../src/routes/skills/check_availability.js';
import get_rates                from '../src/routes/skills/get_rates.js';
import create_booking           from '../src/routes/skills/create_booking.js';
import get_room_types           from '../src/routes/skills/get_room_types.js';
import get_cancellation_policy  from '../src/routes/skills/get_cancellation_policy.js';

import type { SkillContext, AgentConfig } from '../src/core/types.js';

const baseConfig: AgentConfig = {
  agentId: 1, agentOwnerAddress: '0x',
  publicUrl: 'http://localhost:8787', port: 8787,
  chainId: 84532, chainAlias: 'base-sepolia',
  rpcUrl: '', identityRegistry: null, reputationRegistry: null,
  bookingEscrow: null, usdcAddress: '0xUSDC', payoutAddress: '0x',
  llm: { provider: null, baseUrl: null, apiKey: null, model: null },
  tenantId: null,
};

let store: SQLiteStore;
let ctx:   SkillContext;

beforeEach(async () => {
  store = new SQLiteStore(':memory:');
  ctx   = { store, config: baseConfig, caller: null };

  // Seed: one room type, 5 nights of stock
  await store.upsertItem({
    itemId:        'king',
    itemType:      'room_type',
    name:          { en: 'King Room', zh: '大床房' },
    description:   { en: 'Large bed', zh: '大床' },
    baseRateUsdc:  1820 * 1_000_000,
    attributes:    {},
    active:        true,
  });
  for (let i = 0; i < 5; i++) {
    const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    await store.setAvailability('king', date, 5);
  }
});

afterEach(() => store.close());

// ─── check_availability ──────────────────────────────────────────────

describe('check_availability', () => {
  it('returns availability + total quote for valid range', async () => {
    const out = await check_availability.handle({
      input: { check_in: '2026-09-01', check_out: '2026-09-03', room_type: 'king' },
      ctx, payment: null,
    });
    expect(out.available).toBe(true);
    expect(out.nights).toBe(2);
    expect(out.total_usdc).toBe(2 * 1820 * 1_000_000);
    expect(out.per_night_usdc).toHaveLength(2);
  });

  it('returns unavailable when stock is zero on any night', async () => {
    await store.setAvailability('king', '2026-09-02', 0);
    const out = await check_availability.handle({
      input: { check_in: '2026-09-01', check_out: '2026-09-03', room_type: 'king' },
      ctx, payment: null,
    });
    expect(out.available).toBe(false);
    expect(out.total_usdc).toBe(0);
  });

  it('throws on unknown room_type', async () => {
    await expect(
      check_availability.handle({
        input: { check_in: '2026-09-01', check_out: '2026-09-02', room_type: 'penthouse' },
        ctx, payment: null,
      }),
    ).rejects.toThrow(/UNKNOWN_ROOM_TYPE/);
  });

  it('throws when check_out is not after check_in', async () => {
    await expect(
      check_availability.handle({
        input: { check_in: '2026-09-03', check_out: '2026-09-01', room_type: 'king' },
        ctx, payment: null,
      }),
    ).rejects.toThrow(/INVALID_RANGE/);
  });

  it('respects per-night rate overrides', async () => {
    await store.setRateOverride('king', '2026-09-01', 9999 * 1_000_000);
    const out = await check_availability.handle({
      input: { check_in: '2026-09-01', check_out: '2026-09-03', room_type: 'king' },
      ctx, payment: null,
    });
    expect(out.per_night_usdc[0]?.usdc).toBe(9999 * 1_000_000);  // override
    expect(out.per_night_usdc[1]?.usdc).toBe(1820 * 1_000_000);  // base
  });
});

// ─── get_rates ───────────────────────────────────────────────────────

describe('get_rates', () => {
  it('returns rates for all active items when room_type omitted', async () => {
    await store.upsertItem({
      itemId: 'twin', itemType: 'room_type',
      name: { en: 'Twin' }, description: { en: '' },
      baseRateUsdc: 1500 * 1_000_000, attributes: {}, active: true,
    });
    const out = await get_rates.handle({
      input: { from: '2026-09-01', to: '2026-09-03' },
      ctx, payment: null,
    });
    expect(out.currency).toBe('USDC');
    expect(out.rates.length).toBe(2);
  });

  it('filters to single room_type when specified', async () => {
    const out = await get_rates.handle({
      input: { from: '2026-09-01', to: '2026-09-02', room_type: 'king' },
      ctx, payment: null,
    });
    expect(out.rates.length).toBe(1);
    expect(out.rates[0]?.room_type).toBe('king');
    expect(out.rates[0]?.per_night.length).toBe(1);
  });

  it('throws on unknown specific room_type', async () => {
    await expect(get_rates.handle({
      input: { from: '2026-09-01', to: '2026-09-02', room_type: 'penthouse' },
      ctx, payment: null,
    })).rejects.toThrow(/UNKNOWN_ROOM_TYPE/);
  });
});

// ─── create_booking ──────────────────────────────────────────────────

describe('create_booking', () => {
  const validInput = {
    check_in:      '2026-09-01',
    check_out:     '2026-09-03',
    room_type:     'king',
    payer_address: '0xABCD000000000000000000000000000000000001',
  };

  it('creates a pending booking + decrements inventory', async () => {
    const stockBefore = (await store.getAvailability('king',
      { from: '2026-09-01', to: '2026-09-03' })).map((d) => d.availableCount);
    expect(stockBefore).toEqual([5, 5]);

    const out = await create_booking.handle({ input: validInput, ctx, payment: null });
    expect(out.status).toBe('pending');
    expect(out.nights).toBe(2);
    expect(out.total_usdc).toBe(2 * 1820 * 1_000_000);
    expect(out.confirmation_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const stockAfter = (await store.getAvailability('king',
      { from: '2026-09-01', to: '2026-09-03' })).map((d) => d.availableCount);
    expect(stockAfter).toEqual([4, 4]);
  });

  it('throws SOLD_OUT when any night has 0 stock', async () => {
    await store.setAvailability('king', '2026-09-02', 0);
    await expect(
      create_booking.handle({ input: validInput, ctx, payment: null }),
    ).rejects.toThrow(/SOLD_OUT/);
  });

  it('throws on unknown room_type', async () => {
    await expect(create_booking.handle({
      input: { ...validInput, room_type: 'fake' },
      ctx, payment: null,
    })).rejects.toThrow(/UNKNOWN_ROOM_TYPE/);
  });
});

// ─── get_room_types + get_cancellation_policy ────────────────────────

describe('get_room_types', () => {
  it('lists active items', async () => {
    const out = await get_room_types.handle({ input: {}, ctx, payment: null });
    expect(out.items.length).toBe(1);
    expect(out.items[0]?.item_id).toBe('king');
  });

  it('hides deactivated items', async () => {
    await store.upsertItem({
      itemId: 'king', itemType: 'room_type',
      name: { en: 'King' }, description: { en: '' },
      baseRateUsdc: 0, attributes: {}, active: false,
    });
    const out = await get_room_types.handle({ input: {}, ctx, payment: null });
    expect(out.items.length).toBe(0);
  });
});

describe('get_cancellation_policy', () => {
  it('returns default 100% refund when no policy set', async () => {
    const out = await get_cancellation_policy.handle({ input: {}, ctx, payment: null });
    expect(out.type).toBeNull();
    expect(out.tiers[0]?.refund_percent).toBe(100);
  });

  it('returns the merchant policy when set', async () => {
    const settings = await store.getSettings();
    settings.cancellationPolicy = {
      type: 'tiered',
      tiers: [
        { hoursBeforeStart: 168, refundPercent: 100 },
        { hoursBeforeStart: 0,   refundPercent: 0 },
      ],
      freeReschedulingHours: 48,
    };
    await store.setSettings(settings);

    const out = await get_cancellation_policy.handle({ input: {}, ctx, payment: null });
    expect(out.type).toBe('tiered');
    expect(out.tiers).toHaveLength(2);
    expect(out.tiers[0]?.hours_before_start).toBe(168);
    expect(out.free_rescheduling_hours).toBe(48);
  });
});
