import { z } from 'zod';
import { defineSkill } from '../../core/skill.js';

/**
 * get_cancellation_policy — return the merchant's published cancellation
 * tiers. The same data also lives in agent-card.json's
 * `extensions["tourskill.org/v1/cancellation"]`; this skill is a
 * convenience for callers who want a typed response without parsing
 * agent-card themselves.
 */
export default defineSkill({
  name:        'get_cancellation_policy',
  description: 'Return the merchant\'s cancellation policy tiers (refund % vs hours before stay starts).',
  endpoint:    '/skills/get_cancellation_policy',
  pricing:     { free: true },

  inputSchema:  z.object({}),

  outputSchema: z.object({
    type: z.literal('tiered').nullable(),
    tiers: z.array(z.object({
      hours_before_start: z.number().int().nonnegative(),
      refund_percent:     z.number().int().min(0).max(100),
    })),
    free_rescheduling_hours: z.number().int().nonnegative().optional(),
  }),

  async handle({ ctx }) {
    const settings = await ctx.store.getSettings();
    const policy = settings.cancellationPolicy;

    if (!policy) {
      // No policy declared = "always refundable up until check-in" by
      // default. This matches consumer expectations on most chains and
      // makes new merchants safe-by-default.
      return {
        type:  null,
        tiers: [{ hours_before_start: 0, refund_percent: 100 }],
      };
    }

    return {
      type: 'tiered' as const,
      tiers: policy.tiers.map((t) => ({
        hours_before_start: t.hoursBeforeStart,
        refund_percent:     t.refundPercent,
      })),
      ...(policy.freeReschedulingHours !== undefined
        ? { free_rescheduling_hours: policy.freeReschedulingHours }
        : {}),
    };
  },
});
