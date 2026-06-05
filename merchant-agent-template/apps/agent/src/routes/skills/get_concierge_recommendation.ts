import { z } from 'zod';
import { defineSkill } from '../../core/skill.js';

/**
 * get_concierge_recommendation — a paid (x402) per-call micropayment skill.
 *
 * Returns a short, curated concierge recommendation tailored to the
 * merchant's city and the guest's stated interest. Deterministic content
 * (no LLM) so the demo always returns data. The interesting part is the
 * payment: this skill charges 0.10 USDC via x402 before it answers.
 */

// 0.10 USDC, expressed in base units (6 decimals) like every other amount.
const PRICE_BASE_UNITS = 100_000;

type Rec = { title: string; detail: string; insiderTip: string };

const BY_CITY: Record<string, Partial<Record<string, Rec>>> = {
  hangzhou: {
    dining: {
      title: 'Private Longjing tea-paired dinner at Jinsha',
      detail: 'A seasonal Hangzhou tasting menu paired with first-flush Longjing from the hills above the hotel.',
      insiderTip: 'Ask for the window table after 18:30 — the koi pond lights come on and the camphor courtyard empties out.',
    },
    sightseeing: {
      title: 'Dawn boat on West Lake before the crowds',
      detail: 'A 6:30am private hand-rowed boat from Jinsha Harbour to Three Pools Mirroring the Moon.',
      insiderTip: 'The mist usually lifts around 7:15 — have the boatman pause at Su Causeway for the light.',
    },
  },
  guangzhou: {
    dining: {
      title: 'Chef’s table at Yu Yue Heen (Michelin)',
      detail: 'A Cantonese fine-dining counter on the 70th floor with Pearl River views and a live dim-sum pass.',
      insiderTip: 'Pre-order the roast pigeon and the double-boiled soup of the day when you book — both sell out by 19:00.',
    },
    sightseeing: {
      title: 'Canton Tower sunset, then Liwan night walk',
      detail: 'Time the river-facing bar for golden hour, then cross to the old town for Xiguan arcades and street eats.',
      insiderTip: 'Skip the tower queue — the hotel’s 100F atrium gives a better skyline shot for free.',
    },
  },
  huangshan: {
    dining: {
      title: 'Hui-style banquet by the spring pool',
      detail: 'Stinky mandarin fish, bamboo-shoot stew, and Maofeng tea, served in the century-old courtyard.',
      insiderTip: 'Tell the kitchen if you want it less pungent — the classic fish is an acquired taste.',
    },
    sightseeing: {
      title: 'Sunrise at Bright Summit Peak',
      detail: 'Pre-dawn cable car up Yungu, then the ridge walk to catch the sea of clouds at first light.',
      insiderTip: 'Rent a padded coat at the station — the summit is 10°C colder than the valley at dawn.',
    },
  },
};

export default defineSkill({
  name:        'get_concierge_recommendation',
  description: 'Paid concierge: a curated, city-specific recommendation for dining or sightseeing. Costs 0.10 USDC via x402.',
  endpoint:    '/skills/get_concierge_recommendation',
  pricing:     { type: 'flat', flatUsdc: PRICE_BASE_UNITS },

  inputSchema: z.object({
    interest: z.enum(['dining', 'sightseeing']).default('dining')
      .describe('What the guest wants a recommendation for.'),
  }),

  outputSchema: z.object({
    city:        z.string(),
    interest:    z.string(),
    title:       z.string(),
    detail:      z.string(),
    insider_tip: z.string(),
    paid:        z.boolean(),
    settlement_tx: z.string().nullable(),
  }),

  async handle({ input, ctx, payment }) {
    const interest = input.interest ?? 'dining';
    const settings = await ctx.store.getSettings();
    const city = settings.location.city.toLowerCase();
    const rec =
      BY_CITY[city]?.[interest]
      ?? {
        title: `A local favorite in ${city}`,
        detail: 'Our concierge suggests asking the front desk for today’s seasonal pick.',
        insiderTip: 'Tell them your hotel and they’ll arrange priority seating.',
      };

    return {
      city,
      interest,
      title:       rec.title,
      detail:      rec.detail,
      insider_tip: rec.insiderTip,
      paid:        Boolean(payment),
      settlement_tx: payment?.escrowTxHash ?? null,
    };
  },
});
