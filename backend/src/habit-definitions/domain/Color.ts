import { HABIT_CURATED_COLORS, HABIT_NEGATIVE_COLOR } from '@habitsapp/shared';
import { ValidationError } from '../../shared/domain/errors/DomainError.js';

declare const _colorBrand: unique symbol;
export type Color = string & { readonly [_colorBrand]: true };

export const CURATED_COLORS: Color[] = HABIT_CURATED_COLORS as unknown as Color[];

// Alias kept for backward compatibility with rotation logic and existing tests.
export const POSITIVE_COLORS: Color[] = CURATED_COLORS;

export const NEGATIVE_COLOR: Color = HABIT_NEGATIVE_COLOR as Color;

export function pickColor(positive: boolean, existingPositiveCount: number): Color {
  if (!positive) return NEGATIVE_COLOR;
  return CURATED_COLORS[existingPositiveCount % CURATED_COLORS.length];
}

export function validateColor(color: string, positive: boolean): void {
  const valid = positive
    ? (CURATED_COLORS as string[])
    : ([...(CURATED_COLORS as string[]), NEGATIVE_COLOR as string]);
  if (!valid.includes(color)) {
    throw new ValidationError(
      `invalid color for ${positive ? 'positive' : 'negative'} habit: ${color}`,
    );
  }
}
