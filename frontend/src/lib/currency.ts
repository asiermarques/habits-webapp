import type { CurrencyCode } from '@habitsapp/shared';

const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

// Renders an amount with a 3-letter code suffix (e.g. "12.50 EUR"). The value
// is trimmed of trailing zeros so integer amounts render as "12 EUR" rather
// than "12.00 EUR".
export function formatCurrency(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  const formatted = Number.isInteger(amount)
    ? String(amount)
    : Number(amount.toFixed(2)).toString();
  return `${formatted} ${currency}`;
}
