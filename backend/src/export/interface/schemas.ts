import { z } from 'zod';
import { ISO_DATE_RE } from '../../shared/domain/value-objects/IsoDate.js';

const isoDateField = (label: string) =>
  z.string().regex(ISO_DATE_RE, `${label} must be YYYY-MM-DD`);

export const exportQuerySchema = z
  .object({
    userId: z.coerce.number({ invalid_type_error: 'userId is required' }).int(),
    from: isoDateField('from'),
    to: isoDateField('to'),
  })
  .refine(({ from, to }) => from <= to, {
    message: 'from must be on or before to',
    path: ['from'],
  });
