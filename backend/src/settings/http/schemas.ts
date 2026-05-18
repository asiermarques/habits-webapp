import { z } from 'zod';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../shared/domain/value-objects/Currency.js';
import { SUPPORTED_LOCALES, type LocaleCode } from '@habitsapp/shared';

export const setCurrencySchema = z.object({
  currency: z
    .string()
    .refine(
      (v) => (SUPPORTED_CURRENCIES as readonly string[]).includes(v),
      { message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` },
    )
    .transform((v) => v as CurrencyCode),
});

export const setLocaleSchema = z.object({
  locale: z
    .string()
    .refine(
      (v) => (SUPPORTED_LOCALES as readonly string[]).includes(v),
      { message: `locale must be one of: ${SUPPORTED_LOCALES.join(', ')}` },
    )
    .transform((v) => v as LocaleCode),
});
