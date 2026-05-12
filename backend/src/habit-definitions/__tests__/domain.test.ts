import { describe, it, expect } from 'vitest';
import { resolvePositive, applyPatch } from '../domain/HabitDefinition.js';
import { TypeLockedError } from '../domain/errors.js';
import { pickColor, POSITIVE_COLORS, NEGATIVE_COLOR } from '../domain/Color.js';
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
