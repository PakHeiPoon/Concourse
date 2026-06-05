/**
 * Merchant profile registry.
 *
 * One template codebase, many merchants. `setup.ts` picks a profile by the
 * MERCHANT env var (defaults to `wumingchu` so existing deploys are
 * unchanged). Each profile is the full seed data for one merchant-agent
 * instance: its MerchantSettings plus a representative room/inventory set.
 *
 * To deploy a new merchant:
 *   MERCHANT=four-seasons-hangzhou PUBLIC_URL=https://… pnpm setup && pnpm start
 */

import type { MerchantSettings } from '../../core/types.js';

export interface RoomTypeSeed {
  itemId:        string;
  nameEn:        string;
  nameZh:        string;
  descEn:        string;
  descZh:        string;
  rateUsdc:      number;        // whole USDC per night (converted to base units on seed)
  stockPerNight: number;
}

export interface MerchantProfile {
  /** MerchantSettings minus payment.payoutAddress, which is resolved from env at seed time. */
  settings:  Omit<MerchantSettings, 'payment'> & {
    payment: Omit<MerchantSettings['payment'], 'payoutAddress'>;
  };
  roomTypes: RoomTypeSeed[];
}

import { wumingchu } from './wumingchu.js';
import { fourSeasonsHangzhou } from './four-seasons-hangzhou.js';
import { fourSeasonsGuangzhou } from './four-seasons-guangzhou.js';

export const PROFILES: Record<string, MerchantProfile> = {
  'wumingchu':              wumingchu,
  'four-seasons-hangzhou':  fourSeasonsHangzhou,
  'four-seasons-guangzhou': fourSeasonsGuangzhou,
};

export function getProfile(key: string): MerchantProfile {
  const profile = PROFILES[key];
  if (!profile) {
    const known = Object.keys(PROFILES).join(', ');
    throw new Error(`Unknown MERCHANT="${key}". Known profiles: ${known}`);
  }
  return profile;
}
