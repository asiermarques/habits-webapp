import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@habitsapp/shared';

export { SUPPORTED_CURRENCIES, type CurrencyCode };

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function parseCurrencyCode(value: unknown): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error(`Invalid currency code: ${String(value)}. Must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }
  return value;
}
