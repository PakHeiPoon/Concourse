/**
 * Auto-discovers skills under `routes/skills/*.ts`.
 *
 * Each file there default-exports a `SkillDef` (see core/skill.ts).
 * On boot we collect them into an array, mount HTTP routes for each,
 * and feed them to the agent-card builder so they appear in
 * `agent-card.json#/skills`.
 *
 * Why static imports rather than dynamic `import.meta.glob` style:
 *   - Hono runs on Node, Bun, Edge, Workers; not all runtimes support
 *     glob-style. Explicit static imports work everywhere.
 *   - When you add a new skill, you add ONE line to this file. Trivial,
 *     and TypeScript catches typos immediately.
 *   - Tree-shaking can drop unused skills if a downstream merchant
 *     forks and removes some.
 */

import type { SkillDef } from '../core/types.js';

import check_availability       from './skills/check_availability.js';
import get_rates                from './skills/get_rates.js';
import create_booking           from './skills/create_booking.js';
import get_cancellation_policy  from './skills/get_cancellation_policy.js';
import get_room_types           from './skills/get_room_types.js';
import get_concierge_recommendation from './skills/get_concierge_recommendation.js';

export const skills: SkillDef<unknown, unknown>[] = [
  check_availability       as unknown as SkillDef<unknown, unknown>,
  get_rates                as unknown as SkillDef<unknown, unknown>,
  create_booking           as unknown as SkillDef<unknown, unknown>,
  get_cancellation_policy  as unknown as SkillDef<unknown, unknown>,
  get_room_types           as unknown as SkillDef<unknown, unknown>,
  get_concierge_recommendation as unknown as SkillDef<unknown, unknown>,
];
