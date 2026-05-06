import { z } from 'zod';
import { defineSkill } from '../../core/skill.js';
import { assertIsoDate, eachDate } from '../../core/dates.js';
import { SkillError } from '../../core/types.js';

/**
 * get_rates — return the per-night rate for one or all room types
 * across a date range. Pure read; no inventory levels.
 *
 * Useful when a user-agent wants to compare prices ("show me all room
 * types with their rates next weekend") without committing to a specific
 * type yet.
 */
export default defineSkill({
  name:        'get_rates',
  description: 'List per-night USDC rates for one or all room types across a date range.',
  endpoint:    '/skills/get_rates',
  pricing:     { free: true },

  inputSchema: z.object({
    from:      z.string().describe('YYYY-MM-DD inclusive'),
    to:        z.string().describe('YYYY-MM-DD exclusive'),
    room_type: z.string().optional().describe('If omitted, returns all active room types.'),
  }),

  outputSchema: z.object({
    currency: z.literal('USDC'),
    rates: z.array(z.object({
      room_type:    z.string(),
      name_en:      z.string(),
      base_rate_usdc: z.number().int().nonnegative(),
      per_night: z.array(z.object({
        date:        z.string(),
        rate_usdc:   z.number().int().nonnegative(),
      })),
    })),
  }),

  async handle({ input, ctx }) {
    assertIsoDate(input.from, 'from');
    assertIsoDate(input.to,   'to');

    const items = input.room_type
      ? [(await ctx.store.getItem(input.room_type))].filter((x): x is NonNullable<typeof x> => x !== null && x.active)
      : await ctx.store.listItems({ active: true });

    if (input.room_type && items.length === 0) {
      throw new SkillError('UNKNOWN_ROOM_TYPE',
        `room_type '${input.room_type}' is not registered or has been deactivated`);
    }

    const dates = eachDate(input.from, input.to);
    const rates = await Promise.all(items.map(async (item) => {
      const cal = await ctx.store.getAvailability(item.itemId, { from: input.from, to: input.to });
      const overrideMap = new Map(cal.map((c) => [c.date, c.overrideRateUsdc]));
      return {
        room_type:      item.itemId,
        name_en:        item.name.en ?? item.itemId,
        base_rate_usdc: item.baseRateUsdc,
        per_night: dates.map((date) => {
          const ov = overrideMap.get(date) ?? 0;
          return { date, rate_usdc: ov > 0 ? ov : item.baseRateUsdc };
        }),
      };
    }));

    return { currency: 'USDC' as const, rates };
  },
});
