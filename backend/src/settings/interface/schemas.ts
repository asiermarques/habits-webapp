import { z } from 'zod';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../shared/value-objects/Currency.js';

export const setCurrencySchema = z.object({
  currency: z
    .string()
    .refine(
      (v) => (SUPPORTED_CURRENCIES as readonly string[]).includes(v),
      { message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` },
    )
    .transform((v) => v as CurrencyCode),
});
