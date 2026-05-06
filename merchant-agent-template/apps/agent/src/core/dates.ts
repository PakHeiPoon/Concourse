/**
 * Date helpers. We deliberately work in YYYY-MM-DD strings + UNIX
 * seconds rather than Date objects on the wire — fewer timezone
 * footguns when JSON serializing across agents.
 */

/** Validates an ISO date `YYYY-MM-DD`. Throws SkillError if malformed. */
import { SkillError } from './types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(d: string, field = 'date'): void {
  if (!ISO_DATE.test(d)) {
    throw new SkillError('INVALID_DATE', `${field} must be YYYY-MM-DD, got: ${d}`);
  }
  const t = Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(t)) {
    throw new SkillError('INVALID_DATE', `${field} is not a real calendar date: ${d}`);
  }
}

/** Number of days from a (inclusive) to b (exclusive). a < b strict. */
export function daysBetween(a: string, b: string): number {
  assertIsoDate(a, 'from');
  assertIsoDate(b, 'to');
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (tb <= ta) {
    throw new SkillError('INVALID_RANGE', `to (${b}) must be strictly after from (${a})`);
  }
  return Math.round((tb - ta) / 86_400_000);
}

/** Iterate dates in [from, to) — returns YYYY-MM-DD strings. */
export function eachDate(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  const out: string[] = [];
  const ts = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    const d = new Date(ts + i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
