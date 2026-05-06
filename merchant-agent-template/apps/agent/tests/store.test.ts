import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStore } from '../src/stores/sqlite.js';

describe('SQLiteStore', () => {
  let store: SQLiteStore;

  beforeEach(() => {
    // Each test gets a fresh in-memory DB — fast, isolated
    store = new SQLiteStore(':memory:');
  });

  afterEach(() => store.close());

  it('seeds default settings on first open', async () => {
    const s = await store.getSettings();
    expect(s.merchantType).toBe('hotel');
    expect(s.payment.currency).toBe('USDC');
  });

  it('upserts and retrieves an inventory item', async () => {
    await store.upsertItem({
      itemId:        'king',
      itemType:      'room_type',
      name:          { en: 'King Room', zh: '大床房' },
      description:   { en: 'Large bed', zh: '大床' },
      baseRateUsdc:  1820 * 1_000_000,
      attributes:    { bedSize: 'king' },
      active:        true,
    });
    const got = await store.getItem('king');
    expect(got).not.toBeNull();
    expect(got!.name.en).toBe('King Room');
    expect(got!.baseRateUsdc).toBe(1820 * 1_000_000);
    expect(got!.attributes.bedSize).toBe('king');
  });

  it('listItems filters by active flag', async () => {
    await store.upsertItem({
      itemId: 'a', itemType: 'room_type',
      name: { en: 'A' }, description: { en: '' },
      baseRateUsdc: 0, attributes: {}, active: true,
    });
    await store.upsertItem({
      itemId: 'b', itemType: 'room_type',
      name: { en: 'B' }, description: { en: '' },
      baseRateUsdc: 0, attributes: {}, active: false,
    });
    expect((await store.listItems({ active: true })).length).toBe(1);
    expect((await store.listItems({ active: false })).length).toBe(1);
    expect((await store.listItems()).length).toBe(2);
  });

  it('setAvailability + getAvailability round-trips a calendar', async () => {
    await store.upsertItem({
      itemId: 'king', itemType: 'room_type',
      name: { en: '' }, description: { en: '' },
      baseRateUsdc: 0, attributes: {}, active: true,
    });
    await store.setAvailability('king', '2026-09-01', 5);
    await store.setAvailability('king', '2026-09-02', 3);
    await store.setAvailability('king', '2026-09-03', 0);

    const days = await store.getAvailability('king', { from: '2026-09-01', to: '2026-09-04' });
    expect(days.length).toBe(3);
    expect(days[0]?.date).toBe('2026-09-01');
    expect(days[0]?.availableCount).toBe(5);
    expect(days[2]?.availableCount).toBe(0);
  });

  it('getAvailability respects exclusive upper bound', async () => {
    await store.upsertItem({
      itemId: 'king', itemType: 'room_type',
      name: { en: '' }, description: { en: '' },
      baseRateUsdc: 0, attributes: {}, active: true,
    });
    await store.setAvailability('king', '2026-09-01', 1);
    await store.setAvailability('king', '2026-09-02', 1);
    const days = await store.getAvailability('king', { from: '2026-09-01', to: '2026-09-02' });
    expect(days.length).toBe(1);
    expect(days[0]?.date).toBe('2026-09-01');
  });

  it('createBooking + getBooking + status transitions', async () => {
    const booking = await store.createBooking({
      itemId:           'king',
      startDate:        '2026-09-01',
      endDate:          '2026-09-03',
      totalUsdc:        3640 * 1_000_000,
      payerAddress:     '0xABCD000000000000000000000000000000000001',
      confirmationCode: 'WCM-A4B7',
    });
    expect(booking.status).toBe('pending');
    expect(booking.payerAddress).toBe('0xabcd000000000000000000000000000000000001'); // lowercased

    await store.updateBookingStatus(booking.bookingId, 'confirmed', {
      escrowTxHash: '0xdeadbeef',
      releaseAt:    1789200000,
    });

    const after = await store.getBooking(booking.bookingId);
    expect(after?.status).toBe('confirmed');
    expect(after?.escrowTxHash).toBe('0xdeadbeef');
    expect(after?.releaseAt).toBe(1789200000);
  });

  it('listBookings filters by payer + status', async () => {
    await store.createBooking({
      itemId: 'king', startDate: '2026-09-01', endDate: '2026-09-02',
      totalUsdc: 100, payerAddress: '0xPAYER1', confirmationCode: 'C1',
    });
    await store.createBooking({
      itemId: 'king', startDate: '2026-09-05', endDate: '2026-09-06',
      totalUsdc: 200, payerAddress: '0xPAYER2', confirmationCode: 'C2',
    });

    const byPayer = await store.listBookings({ payerAddress: '0xPAYER1' });
    expect(byPayer.length).toBe(1);
    expect(byPayer[0]?.totalUsdc).toBe(100);

    const all = await store.listBookings({ status: 'pending' });
    expect(all.length).toBe(2);
  });

  it('settings round-trip', async () => {
    const next = await store.getSettings();
    next.name = { en: 'Test', zh: '测试' };
    next.priceLevel = 4;
    await store.setSettings(next);

    const back = await store.getSettings();
    expect(back.name.en).toBe('Test');
    expect(back.name.zh).toBe('测试');
    expect(back.priceLevel).toBe(4);
  });
});
