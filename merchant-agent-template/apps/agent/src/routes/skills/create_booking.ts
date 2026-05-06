import { z } from 'zod';
import { defineSkill } from '../../core/skill.js';
import { assertIsoDate, eachDate } from '../../core/dates.js';
import { SkillError } from '../../core/types.js';

/**
 * create_booking — record a booking and decrement inventory.
 *
 * **Phase A behavior** (this template's first cut):
 *   - Caller must provide a `payer_address` (the wallet that will pay).
 *   - We don't lock funds yet — Phase B wires up x402 + BookingEscrow.
 *     Until then, this skill creates a `pending` booking row that the
 *     merchant can manually settle or cancel.
 *
 * **Phase B behavior** (when x402 lands):
 *   - The route handler (in Hono) will return HTTP 402 Payment Required
 *     with a quote + escrow address. After the user signs USDC.lock,
 *     this handler is re-invoked with `payment` proof attached and
 *     creates a confirmed booking.
 *
 * **Idempotency**: this is a state-changing skill, so the route layer
 * will reject calls without an `Idempotency-Key` header (see
 * agent-card.json `idempotencyKey: 'required'`).
 */
export default defineSkill({
  name:        'create_booking',
  description: 'Reserve a room for a date range. Decrements inventory; payment settlement happens via x402 (Phase B).',
  endpoint:    '/skills/create_booking',
  idempotencyKey: 'required',
  pricing: {
    type:  'dynamic',
    // Real x402 quoteFn lives in the Phase B middleware. For now we
    // expose pricing.type so consumers know this skill can charge.
  },

  inputSchema: z.object({
    check_in:       z.string(),
    check_out:      z.string(),
    room_type:      z.string(),
    payer_address:  z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'must be 0x-prefixed 20-byte hex'),
    guest_email:    z.string().email().optional(),
    special_requests: z.string().max(2000).optional(),
  }),

  outputSchema: z.object({
    booking_id:        z.string(),
    confirmation_code: z.string(),
    status:            z.enum(['pending', 'confirmed']),
    nights:            z.number().int().positive(),
    total_usdc:        z.number().int().positive(),
    notes:             z.string().optional(),
  }),

  async handle({ input, ctx }) {
    assertIsoDate(input.check_in,  'check_in');
    assertIsoDate(input.check_out, 'check_out');

    const item = await ctx.store.getItem(input.room_type);
    if (!item || !item.active) {
      throw new SkillError('UNKNOWN_ROOM_TYPE',
        `room_type '${input.room_type}' is not registered or has been deactivated`);
    }

    const cal = await ctx.store.getAvailability(input.room_type, {
      from: input.check_in,
      to:   input.check_out,
    });
    const calMap = new Map(cal.map((c) => [c.date, c]));

    const dates = eachDate(input.check_in, input.check_out);
    let total = 0;
    for (const date of dates) {
      const row = calMap.get(date);
      if (!row || row.availableCount <= 0) {
        throw new SkillError('SOLD_OUT', `No availability for ${input.room_type} on ${date}`);
      }
      const rate = row.overrideRateUsdc > 0 ? row.overrideRateUsdc : item.baseRateUsdc;
      total += rate;
    }

    // Generate human-readable confirmation code: 4 chars + dash + 4 chars
    const confirmationCode = makeConfirmationCode();

    const booking = await ctx.store.createBooking({
      itemId:       input.room_type,
      startDate:    input.check_in,
      endDate:      input.check_out,
      totalUsdc:    total,
      payerAddress: input.payer_address.toLowerCase(),
      ...(input.guest_email !== undefined || input.special_requests !== undefined
        ? { metadata: {
              ...(input.guest_email      !== undefined ? { guest_email:      input.guest_email      } : {}),
              ...(input.special_requests !== undefined ? { special_requests: input.special_requests } : {}),
            } }
        : {}),
      confirmationCode,
    });

    // Decrement inventory for each night
    for (const date of dates) {
      const row = calMap.get(date)!;
      await ctx.store.setAvailability(input.room_type, date, row.availableCount - 1);
    }

    return {
      booking_id:        booking.bookingId,
      confirmation_code: booking.confirmationCode,
      status:            (booking.status === 'confirmed' ? 'confirmed' : 'pending') as 'pending' | 'confirmed',
      nights:            dates.length,
      total_usdc:        booking.totalUsdc,
      notes:             'Phase A: booking created in pending state. Payment settlement (x402 + BookingEscrow) lands in Phase B.',
    };
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────

function makeConfirmationCode(): string {
  // Crockford-base32 alphabet (no I, L, O, U) for human-readability
  const alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const chars = Array.from(buf, (b) => alpha[b % alpha.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}
