import { describe, it, expect } from 'vitest';
import { repCount } from '../repCount';

describe('repCount', () => {
  it('counts a workout entry by its number field when present', () => {
    expect(repCount('workout', { duration: 30, number: 4 })).toBe(4);
  });

  it('counts a workout entry as 1 when number is absent', () => {
    expect(repCount('workout', { duration: 30 })).toBe(1);
  });

  it('counts a custom entry by its number field when present', () => {
    expect(repCount('custom', { number: 5 })).toBe(5);
  });

  it('always counts a writing entry as 1', () => {
    expect(repCount('writing', { words: 500, number: 9 } as never)).toBe(1);
  });
});
