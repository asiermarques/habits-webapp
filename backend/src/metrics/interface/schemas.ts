import { z } from 'zod';
import { ISO_DATE_RE } from '../../shared/domain/value-objects/IsoDate.js';

const todayField = z
  .string()
  .regex(ISO_DATE_RE, 'today must be YYYY-MM-DD')
  .optional();

export const baseQuerySchema = z.object({
  userId: z.coerce.number({ invalid_type_error: 'userId is required' }).int(),
  today: todayField,
});

export const weeklyQuerySchema = baseQuerySchema.extend({
  habitDefinitionId: z.coerce.number().int().optional(),
});
