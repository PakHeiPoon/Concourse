/**
 * Drizzle ORM schema — the canonical data model for a merchant-agent's
 * own database. Used by SQLiteStore (single-process) and PostgresStore
 * (multi-tenant, future).
 *
 * Design intent:
 *   - Inventory items are the things merchants sell. For a hotel, items
 *     are room types ("king", "twin"). For a restaurant, items might be
 *     "dinner-table-of-2" / "dinner-table-of-4". The shape is generic;
 *     the merchant declares semantics in agent-card extensions.
 *
 *   - The calendar table is item × date × available_count. Updates happen
 *     when bookings settle (decrement) or get refunded (increment).
 *
 *   - Bookings record what happened. We never delete a booking row —
 *     state transitions go through `status` field. Audit-friendly.
 *
 *   - Settings is a single-row JSON blob — fast to read, easy to evolve
 *     without migrations. The agent reads it at every request that
 *     needs cancellation policy, opening hours, payout address, etc.
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// ─── inventory_items ──────────────────────────────────────────────────

export const items = sqliteTable('inventory_items', {
  /** Stable string ID, merchant-chosen. Examples: 'king', 'twin', 'suite' */
  itemId:        text('item_id').primaryKey(),
  /** Type discriminator from agent-card.json `tourskill.org/v1/merchant.type` */
  itemType:      text('item_type').notNull(),
  /** Display name in en/zh — JSON serialized */
  nameJson:      text('name_json').notNull().default('{}'),
  /** One-paragraph description, en/zh JSON */
  descriptionJson: text('description_json').notNull().default('{}'),
  /** Nightly / per-slot rate in USDC base units (6 decimals).
   *  Example: 1820 USDC/night = 1_820_000_000 */
  baseRateUsdc:  integer('base_rate_usdc').notNull().default(0),
  /** Free-form attributes per agent-card schema (room_type details, etc.) */
  attributesJson: text('attributes_json').notNull().default('{}'),
  /** Soft-delete flag */
  active:        integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:     integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── calendar (per item × date) ──────────────────────────────────────

export const calendar = sqliteTable(
  'calendar',
  {
    itemId:        text('item_id').notNull().references(() => items.itemId, { onDelete: 'cascade' }),
    /** ISO date YYYY-MM-DD */
    date:          text('date').notNull(),
    /** How many of this item are still available on this date */
    availableCount: integer('available_count').notNull().default(0),
    /** Override of base rate for this specific date (0 = use base) */
    overrideRateUsdc: integer('override_rate_usdc').notNull().default(0),
    updatedAt:      integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.itemId, t.date] }),
  })
);

// ─── bookings ────────────────────────────────────────────────────────

export const bookings = sqliteTable('bookings', {
  /** Public booking ID (e.g. 'bk_xyz789') */
  bookingId:     text('booking_id').primaryKey(),
  /** Human-readable confirmation code (e.g. 'WCM-A4B7') */
  confirmationCode: text('confirmation_code').notNull(),
  /** What was booked */
  itemId:        text('item_id').notNull(),
  /** ISO start date (check-in for hotel, reservation date for restaurant) */
  startDate:     text('start_date').notNull(),
  /** ISO end date (check-out; for single-day items same as start) */
  endDate:       text('end_date').notNull(),
  /** Total USDC base units paid */
  totalUsdc:     integer('total_usdc').notNull(),
  /** Wallet that paid (address) */
  payerAddress:  text('payer_address').notNull(),
  /** BookingEscrow lock tx hash on Base; null until Phase B wired up */
  escrowTxHash:  text('escrow_tx_hash'),
  /** When the funds will release to merchant (UNIX seconds) */
  releaseAt:     integer('release_at'),
  /** State machine: pending → confirmed → settled → cancelled */
  status:        text('status').notNull().default('pending'),
  /** Free-form metadata: guest_email, special_requests, etc. */
  metadataJson:  text('metadata_json').notNull().default('{}'),
  createdAt:     integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:     integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── settings (single row, JSON blob) ────────────────────────────────

export const settings = sqliteTable('settings', {
  /** Singleton row — always 'default' */
  key:           text('key').primaryKey(),
  valueJson:     text('value_json').notNull().default('{}'),
  updatedAt:     integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type ItemRow     = typeof items.$inferSelect;
export type ItemInsert  = typeof items.$inferInsert;
export type CalRow      = typeof calendar.$inferSelect;
export type BookingRow  = typeof bookings.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
