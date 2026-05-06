import { z } from 'zod';
import { defineSkill } from '../../core/skill.js';

/**
 * get_room_types — list this merchant's active inventory items.
 *
 * Generic across merchant types: for hotels it returns room types, for
 * restaurants it'd return table types, for attractions ticket types.
 * The skill name keeps the hotel framing because that's our default
 * vertical; multi-vertical templates can rename it (or expose
 * `get_inventory_items` as a parallel skill).
 */
export default defineSkill({
  name:        'get_room_types',
  description: 'List this merchant\'s active room types (or generic inventory items) with names, descriptions, and base rates.',
  endpoint:    '/skills/get_room_types',
  pricing:     { free: true },

  inputSchema:  z.object({}),

  outputSchema: z.object({
    items: z.array(z.object({
      item_id:        z.string(),
      item_type:      z.string(),
      name:           z.object({ en: z.string(), zh: z.string().optional() }),
      description:    z.object({ en: z.string(), zh: z.string().optional() }),
      base_rate_usdc: z.number().int().nonnegative(),
      attributes:     z.record(z.unknown()),
    })),
  }),

  async handle({ ctx }) {
    const items = await ctx.store.listItems({ active: true });
    return {
      items: items.map((it) => ({
        item_id:        it.itemId,
        item_type:      it.itemType,
        name:           it.name,
        description:    it.description,
        base_rate_usdc: it.baseRateUsdc,
        attributes:     it.attributes,
      })),
    };
  },
});
