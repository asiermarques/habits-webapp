import { describe, it, expect } from 'vitest';
import { resolvePositive, applyPatch } from '../domain/HabitDefinition.js';
import { TypeLockedError } from '../domain/errors.js';
import { pickColor, POSITIVE_COLORS, NEGATIVE_COLOR, CURATED_COLORS, validateColor } from '../domain/Color.js';
import { ValidationError } from '../../shared/domain/errors/DomainError.js';
import type { HabitDefinition } from '../domain/HabitDefinition.js';

const makeHabit = (overrides: Partial<HabitDefinition> = {}): HabitDefinition => ({
  id: 1,
  userId: 1,
  name: 'Reading',
  type: 'custom',
  positive: true,
  color: POSITIVE_COLORS[0],
  createdAt: '2024-01-01T00:00:00.000Z',
  hasEntries: false,
  ...overrides,
});

describe('resolvePositive', () => {
  it('forces workout to positive=true regardless of flag', () => {
    expect(resolvePositive('workout', false)).toBe(true);
    expect(resolvePositive('workout', true)).toBe(true);
    expect(resolvePositive('workout')).toBe(true);
  });

  it('forces writing to positive=true regardless of flag', () => {
    expect(resolvePositive('writing', false)).toBe(true);
  });

  it('respects the flag for custom habits', () => {
    expect(resolvePositive('custom', true)).toBe(true);
    expect(resolvePositive('custom', false)).toBe(false);
  });

  it('defaults custom to true when flag is absent', () => {
    expect(resolvePositive('custom')).toBe(true);
  });
});

describe('applyPatch', () => {
  it('returns empty updates when nothing changes', () => {
    const habit = makeHabit({ type: 'custom', positive: true });
    expect(applyPatch(habit, {}, false)).toEqual({});
  });

  it('includes a name change', () => {
    const habit = makeHabit();
    expect(applyPatch(habit, { name: 'Books' }, false)).toMatchObject({ name: 'Books' });
  });

  it('forces positive=true when switching to workout', () => {
    const habit = makeHabit({ type: 'custom', positive: false });
    const updates = applyPatch(habit, { type: 'workout' }, false);
    expect(updates.type).toBe('workout');
    expect(updates.positive).toBe(true);
  });

  it('throws TypeLockedError when type changes and entries exist', () => {
    const habit = makeHabit({ type: 'custom' });
    expect(() => applyPatch(habit, { type: 'workout' }, true)).toThrow(TypeLockedError);
  });

  it('allows other patches (name, positive) even when entries exist', () => {
    const habit = makeHabit({ type: 'custom', positive: true });
    expect(() => applyPatch(habit, { name: 'New name' }, true)).not.toThrow();
    expect(() => applyPatch(habit, { positive: false }, true)).not.toThrow();
  });

  it('does not throw when type is unchanged but entries exist', () => {
    const habit = makeHabit({ type: 'custom' });
    expect(() => applyPatch(habit, { type: 'custom' }, true)).not.toThrow();
  });
});

describe('pickColor', () => {
  it('returns NEGATIVE_COLOR for negative habits', () => {
    expect(pickColor(false, 0)).toBe(NEGATIVE_COLOR);
    expect(pickColor(false, 5)).toBe(NEGATIVE_COLOR);
  });

  it('rotates through POSITIVE_COLORS for positive habits', () => {
    expect(pickColor(true, 0)).toBe(POSITIVE_COLORS[0]);
    expect(pickColor(true, 1)).toBe(POSITIVE_COLORS[1]);
    expect(pickColor(true, POSITIVE_COLORS.length)).toBe(POSITIVE_COLORS[0]);
  });
});

describe('CURATED_COLORS', () => {
  it('does not include NEGATIVE_COLOR', () => {
    expect(CURATED_COLORS as string[]).not.toContain(NEGATIVE_COLOR);
  });

  it('has at least 2 distinct colors', () => {
    expect(CURATED_COLORS.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validateColor', () => {
  it('accepts a curated color for a positive habit', () => {
    expect(() => validateColor(CURATED_COLORS[0], true)).not.toThrow();
  });

  it('rejects NEGATIVE_COLOR for a positive habit', () => {
    expect(() => validateColor(NEGATIVE_COLOR, true)).toThrow(ValidationError);
  });

  it('rejects an out-of-set color for a positive habit', () => {
    expect(() => validateColor('#000000', true)).toThrow(ValidationError);
  });

  it('accepts NEGATIVE_COLOR for a negative habit', () => {
    expect(() => validateColor(NEGATIVE_COLOR, false)).not.toThrow();
  });

  it('accepts a curated color for a negative habit', () => {
    expect(() => validateColor(CURATED_COLORS[0], false)).not.toThrow();
  });

  it('rejects an out-of-set color for a negative habit', () => {
    expect(() => validateColor('#000000', false)).toThrow(ValidationError);
  });
});

describe('applyPatch with color', () => {
  it('includes a color change in updates', () => {
    const habit = makeHabit({ color: CURATED_COLORS[0] });
    const updates = applyPatch(habit, { color: CURATED_COLORS[1] }, false);
    expect(updates.color).toBe(CURATED_COLORS[1]);
  });

  it('omits color from updates when unchanged', () => {
    const habit = makeHabit({ color: CURATED_COLORS[0] });
    const updates = applyPatch(habit, { color: CURATED_COLORS[0] }, false);
    expect(updates.color).toBeUndefined();
  });

  it('omits color from updates when not in patch', () => {
    const habit = makeHabit({ color: CURATED_COLORS[0] });
    const updates = applyPatch(habit, { name: 'New name' }, false);
    expect(updates.color).toBeUndefined();
  });
});
