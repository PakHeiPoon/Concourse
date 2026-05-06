/**
 * Skill helper. Lets skill files declare their handler with strict
 * input/output type inference from Zod schemas.
 *
 *   import { defineSkill } from '../../core/skill.js';
 *   export default defineSkill({
 *     name: 'check_availability',
 *     description: '...',
 *     inputSchema:  z.object({...}),
 *     outputSchema: z.object({...}),
 *     endpoint:     '/skills/check_availability',
 *     async handle({ input, ctx }) { ... }
 *   });
 */

import type { z } from 'zod';
import type { SkillDef, SkillContext, PaymentProof } from './types.js';

export function defineSkill<I, O>(
  spec: {
    name:           string;
    description:    string;
    inputSchema:    z.ZodType<I>;
    outputSchema:   z.ZodType<O>;
    endpoint:       string;
    pricing?:       NonNullable<SkillDef<I, O>['pricing']>;
    idempotencyKey?: NonNullable<SkillDef<I, O>['idempotencyKey']>;
    handle(args: { input: I; ctx: SkillContext; payment?: PaymentProof | null }): Promise<O>;
  },
): SkillDef<I, O> {
  const { pricing, idempotencyKey, ...rest } = spec;
  return {
    ...rest,
    ...(pricing        !== undefined ? { pricing }        : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  };
}
