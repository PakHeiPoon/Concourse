/**
 * Shared types for the merchant-agent runtime.
 *
 * Three audience layers:
 *   1. Skill authors — only consume `SkillContext` and the `MerchantStore`
 *      interface. Never touch concrete store / config / LLM classes.
 *   2. Store implementers — implement `MerchantStore`. Free to back it
 *      with SQLite, Postgres, a third-party PMS, anything.
 *   3. App glue (Hono entry, route loader) — wires everything together.
 *
 * No domain types ("hotel", "restaurant", …) live here; those are agent-
 * card extension data that flows through generic fields.
 */

import type { z } from 'zod';

// ─── Inventory + bookings ────────────────────────────────────────────

export interface InventoryItem {
  itemId:           string;
  itemType:         string;                       // 'room_type' | 'table_slot' | …
  name:             { en: string; zh?: string };
  description:      { en: string; zh?: string };
  baseRateUsdc:     number;                       // base units (6 decimals)
  attributes:       Record<string, unknown>;
  active:           boolean;
  createdAt:        Date;
  updatedAt:        Date;
}

export interface DailyAvailability {
  itemId:            string;
  date:              string;                       // YYYY-MM-DD
  availableCount:    number;
  overrideRateUsdc:  number;                       // 0 means "use baseRate"
}

export interface BookingDraft {
  itemId:           string;
  startDate:        string;                       // YYYY-MM-DD
  endDate:          string;                       // YYYY-MM-DD
  totalUsdc:        number;
  payerAddress:     string;
  metadata?:        Record<string, unknown>;
}

export interface Booking {
  bookingId:        string;
  confirmationCode: string;
  itemId:           string;
  startDate:        string;
  endDate:          string;
  totalUsdc:        number;
  payerAddress:     string;
  escrowTxHash:     string | null;
  releaseAt:        number | null;                // unix seconds
  status:           'pending' | 'confirmed' | 'settled' | 'cancelled' | 'refunded';
  metadata:         Record<string, unknown>;
  createdAt:        Date;
  updatedAt:        Date;
}

export interface MerchantSettings {
  // What the merchant publishes in agent-card.json. Stored as a single
  // JSON blob so we can evolve without migrations.
  name:                { en: string; zh?: string };
  description:         { en: string; zh?: string };
  merchantType:        'hotel' | 'restaurant' | 'attraction' | 'shop';
  location: {
    country:           string;
    city:              string;                     // lowercase
    address:           string;
    coordinates?:      { lat: number; lng: number };
    timezone?:         string;
  };
  contact: {
    phone?:            string;
    email?:            string;
    websiteUrl?:       string;
  };
  cancellationPolicy?: {
    type:              'tiered';
    tiers: {
      hoursBeforeStart: number;
      refundPercent:   number;
    }[];
    freeReschedulingHours?: number;
  };
  payment: {
    chain:             string;                     // 'base-sepolia' | 'base'
    chainId:           number;
    payoutAddress:     string;
    currency:          'USDC';
    currencyAddress:   string;
    escrow?: {
      contract:        string;
      disputeWindowSeconds: number;
    };
  };
  languagesSupported:  string[];
  priceLevel?:         number;                     // 1-5
  tags?:               string[];
  // Type-specific extras (room_types[] for hotels, cuisine for restaurants…)
  specifics?:          Record<string, unknown>;
}

// ─── Date helpers ────────────────────────────────────────────────────

export interface DateRange {
  /** Inclusive YYYY-MM-DD */
  from: string;
  /** Exclusive YYYY-MM-DD (so "from=09-01, to=09-03" → 2 nights) */
  to:   string;
}

// ─── MerchantStore interface ─────────────────────────────────────────

export interface MerchantStore {
  // Inventory CRUD
  listItems(filter?: { itemType?: string; active?: boolean }): Promise<InventoryItem[]>;
  getItem(itemId: string): Promise<InventoryItem | null>;
  upsertItem(item: Omit<InventoryItem, 'createdAt' | 'updatedAt'>): Promise<void>;

  // Calendar
  getAvailability(itemId: string, range: DateRange): Promise<DailyAvailability[]>;
  setAvailability(itemId: string, date: string, availableCount: number): Promise<void>;
  setRateOverride(itemId: string, date: string, overrideRateUsdc: number): Promise<void>;

  // Bookings
  createBooking(b: BookingDraft & { confirmationCode: string }): Promise<Booking>;
  getBooking(bookingId: string): Promise<Booking | null>;
  listBookings(filter?: {
    payerAddress?: string;
    status?:       Booking['status'];
    fromDate?:     string;
    toDate?:       string;
  }): Promise<Booking[]>;
  updateBookingStatus(
    bookingId: string,
    status: Booking['status'],
    extra?: { escrowTxHash?: string; releaseAt?: number }
  ): Promise<void>;

  // Settings (single row)
  getSettings(): Promise<MerchantSettings>;
  setSettings(s: MerchantSettings): Promise<void>;
}

// ─── Skill definition ────────────────────────────────────────────────

/**
 * Each file in src/routes/skills/*.ts default-exports one of these.
 * The route loader auto-discovers them at boot, registers HTTP routes,
 * and exposes them in the agent-card's `skills[]` array.
 */
export interface SkillDef<I, O> {
  /** snake_case ASCII, unique within this agent */
  name:           string;
  description:    string;                          // for LLM tool selection
  inputSchema:    z.ZodType<I>;
  outputSchema:   z.ZodType<O>;
  /** URL path under PUBLIC_URL where this skill is reachable */
  endpoint:       string;
  /** Free | dynamically-priced; full x402 wiring lands in Phase B */
  pricing?: {
    free?: boolean;
    type?: 'flat' | 'dynamic';
    flatUsdc?: number;
  };
  /** Optional: require Idempotency-Key header. Booking endpoints must. */
  idempotencyKey?: 'required' | 'optional';
  /** The actual implementation */
  handle(args: {
    input:  I;
    ctx:    SkillContext;
    /** Phase B: payment proof set by x402 middleware. null in Phase A. */
    payment?: PaymentProof | null;
  }): Promise<O>;
}

export interface PaymentProof {
  payer:        string;
  amountUsdc:   number;
  escrowTxHash: string;
  intentId:     string;
}

/**
 * The handler context. Everything a skill might need is on this object.
 * Concrete: store, settings cache, optional LLM, request metadata.
 */
export interface SkillContext {
  store:    MerchantStore;
  config:   AgentConfig;
  /** Lazy: undefined unless skill calls `ctx.llm` and LLM env vars are set */
  llm?:     LLMClient;
  /** Originating wallet address if request was authenticated */
  caller?:  string | null;
  /** Idempotency-Key header value if present */
  idempotencyKey?: string;
}

export interface AgentConfig {
  // Identity
  agentId:           number | null;
  agentOwnerAddress: string;

  // Hosting
  publicUrl:         string;
  port:              number;

  // Chain
  chainId:           number;
  chainAlias:        string;                       // 'base-sepolia' | 'base'
  rpcUrl:            string;
  identityRegistry:  string | null;
  reputationRegistry: string | null;
  bookingEscrow:     string | null;
  usdcAddress:       string;
  payoutAddress:     string;

  // LLM (optional)
  llm: {
    provider:        string | null;
    baseUrl:         string | null;
    apiKey:          string | null;
    model:           string | null;
  };

  // Multi-tenant (platform-hosted only)
  tenantId:          string | null;
}

// ─── LLM client ──────────────────────────────────────────────────────

export interface LLMClient {
  chat(opts: {
    system?:    string;
    messages:   { role: 'user' | 'assistant' | 'tool' | 'system'; content: string }[];
    maxTokens?: number;
  }): Promise<string>;
}

// ─── Errors ──────────────────────────────────────────────────────────

export class SkillError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(code: string, message?: string, status = 400) {
    super(message ? `${code}: ${message}` : code);
    this.code = code;
    this.status = status;
    this.name = 'SkillError';
  }
}
