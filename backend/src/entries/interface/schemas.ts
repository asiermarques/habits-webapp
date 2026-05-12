import { z } from 'zod';
import { ISO_DATE_RE } from '../../shared/value-objects/IsoDate.js';

export const PAGE_SIZE = 20;

const cursorSchema = z
  .string()
  .optional()
  .transform((raw) => {
    if (!raw) return undefined;
    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (
        decoded &&
        typeof decoded.date === 'string' &&
        ISO_DATE_RE.test(decoded.date) &&
        typeof decoded.id === 'number'
      ) {
        return decoded as { date: string; id: number };
      }
    } catch {
      // invalid cursor — treat as absent
    }
    return undefined;
  });

export const listQuerySchema = z.object({
  userId: z.coerce.number({ invalid_type_error: 'userId is required' }).int(),
  habitDefinitionId: z.coerce.number().int().optional(),
  cursor: cursorSchema,
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .transform((v) => v ?? PAGE_SIZE),
});

export const createEntrySchema = z.object({
  habitDefinitionId: z.number({ required_error: 'habitDefinitionId is required' }).int(),
  userId: z.number({ required_error: 'userId is required' }).int(),
  date: z
    .string({ required_error: 'date is required' })
    .regex(ISO_DATE_RE, 'date must be YYYY-MM-DD'),
  data: z.object({}).passthrough(),
});

export const updateEntrySchema = z
  .object({
    date: z.string().regex(ISO_DATE_RE, 'date must be YYYY-MM-DD').optional(),
    data: z.object({}).passthrough().optional(),
  })
  .refine((v) => v.date !== undefined || v.data !== undefined, {
    message: 'at least one of date or data must be provided',
  });
