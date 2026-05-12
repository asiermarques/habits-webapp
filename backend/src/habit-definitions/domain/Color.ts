declare const _colorBrand: unique symbol;
export type Color = string & { readonly [_colorBrand]: true };

export const POSITIVE_COLORS: Color[] = [
  '#3b82f6', '#10b981', '#a855f7', '#f97316',
  '#14b8a6', '#ec4899', '#6366f1', '#eab308',
] as Color[];

export const NEGATIVE_COLOR: Color = '#ef4444' as Color;

export function pickColor(positive: boolean, existingPositiveCount: number): Color {
  if (!positive) return NEGATIVE_COLOR;
  return POSITIVE_COLORS[existingPositiveCount % POSITIVE_COLORS.length];
}
