import { describe, it, expect } from 'vitest';
import { resolveIsDefault, pickNextDefaultAfter } from '../domain/User.js';
import type { User } from '../domain/User.js';

const makeUser = (id: number, isDefault = false): User => ({
  id,
  name: `User ${id}`,
  isDefault,
  createdAt: '2024-01-01T00:00:00.000Z',
});

describe('resolveIsDefault', () => {
  it('returns true when there are no existing users', () => {
    expect(resolveIsDefault(0)).toBe(true);
  });

  it('returns false when users already exist', () => {
    expect(resolveIsDefault(1)).toBe(false);
    expect(resolveIsDefault(5)).toBe(false);
  });
});

describe('pickNextDefaultAfter', () => {
  it('returns undefined when the deleted user was not default', () => {
    const remaining = [makeUser(2, true), makeUser(3)];
    expect(pickNextDefaultAfter(false, remaining)).toBeUndefined();
  });

  it('returns the first remaining user when the deleted user was default', () => {
    const remaining = [makeUser(2), makeUser(3)];
    expect(pickNextDefaultAfter(true, remaining)).toEqual(remaining[0]);
  });

  it('returns undefined when remaining list is empty', () => {
    expect(pickNextDefaultAfter(true, [])).toBeUndefined();
  });
});
