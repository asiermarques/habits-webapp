export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

declare const _isoDateBrand: unique symbol;
export type IsoDate = string & { readonly [_isoDateBrand]: true };

export function parseIsoDate(value: string): IsoDate {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return value as IsoDate;
}

export function isIsoDate(value: string): value is IsoDate {
  return ISO_DATE_RE.test(value);
}
