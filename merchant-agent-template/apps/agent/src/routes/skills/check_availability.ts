import { z } from 'zod';
import { defineSkill } from '../../core/skill.js';
import { assertIsoDate, daysBetween, eachDate } from '../../core/dates.js';
import { SkillError } from '../../core/types.js';

/**
 * check_availability — read-only inventory query.
 *
 * Returns whether all nights in [check_in, check_out) are available for
 * the requested room_type, plus the total USDC quote (sum of base rates
 * and per-night overrides).
 *
 * Pure CRUD on the merchant's calendar — no LLM, no payment, no auth.
 */
export default defineSkill({
  name:        'check_availability',
  description: 'Check whether a room type is available for the given check-in/check-out range, and return a price quote.',
  endpoint:    '/skills/check_availability',
  pricing:     { free: true },

  inputSchema: z.object({
    check_in:  z.string().describe('YYYY-MM-DD inclusive'),
    check_out: z.string().describe('YYYY-MM-DD exclusive'),
    room_type: z.string().describe("Inventory item ID (e.g. 'king', 'twin')"),
  }),

  outputSchema: z.object({
    available:    z.boolean(),
    nights:       z.number().int().nonnegative(),
    total_usdc:   z.number().int().nonnegative(),
    per_night_usdc: z.array(z.object({
      date:   z.string(),
      usdc:   z.number().int().nonnegative(),
      stock:  z.number().int().nonnegative(),
    })),
  }),

  async handle({ input, ctx }) {
    assertIsoDate(input.check_in,  'check_in');
    assertIsoDate(input.check_out, 'check_out');
    const nights = daysBetween(input.check_in, input.check_out);

    const item = await ctx.store.getItem(input.room_type);
    if (!item || !item.active) {
      throw new SkillError('UNKNOWN_ROOM_TYPE',
        `room_type '${input.room_type}' is not registered or has been deactivated`);
    }

    const days = await ctx.store.getAvailability(input.room_type, {
      from: input.check_in,
      to:   input.check_out,
    });

    // Build a map for O(1) lookup; days returned can be a sparse subset
    // if the merchant only wrote some calendar entries — those default
    // to "no inventory loaded" (treat as 0 stock).
    const dateMap = new Map(days.map((d) => [d.date, d]));
    const perNight = eachDate(input.check_in, input.check_out).map((date) => {
      const row = dateMap.get(date);
      const rate = (row && row.overrideRateUsdc > 0) ? row.overrideRateUsdc : item.baseRateUsdc;
      const stock = row?.availableCount ?? 0;
      return { date, usdc: rate, stock };
    });

    const allAvailable = perNight.every((d) => d.stock > 0);
    const total = perNight.reduce((acc, d) => acc + d.usdc, 0);

    return {
      available:      allAvailable,
      nights,
      total_usdc:     allAvailable ? total : 0,
      per_night_usdc: perNight,
    };
  },
});
