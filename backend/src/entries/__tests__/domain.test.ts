import { describe, it, expect } from 'vitest';
import { validateEntryData } from '../domain/EntryData.js';
import { enforceOwnership } from '../domain/Entry.js';
import { InvalidEntryDataError, WrongUserError } from '../domain/errors.js';

describe('validateEntryData', () => {
  describe('workout', () => {
    it('accepts a valid duration', () => {
      expect(() => validateEntryData('workout', { duration: 30 })).not.toThrow();
    });

    it('accepts duration with optional fields', () => {
      expect(() => validateEntryData('workout', { duration: 45, distance: 10, notes: 'easy' })).not.toThrow();
    });

    it('rejects missing duration', () => {
      expect(() => validateEntryData('workout', {} as never)).toThrow(InvalidEntryDataError);
    });

    it('rejects zero duration', () => {
      expect(() => validateEntryData('workout', { duration: 0 })).toThrow(InvalidEntryDataError);
    });

    it('rejects negative duration', () => {
      expect(() => validateEntryData('workout', { duration: -5 })).toThrow(InvalidEntryDataError);
    });
  });

  describe('writing', () => {
    it('accepts zero words', () => {
      expect(() => validateEntryData('writing', { words: 0 })).not.toThrow();
    });

    it('accepts positive words', () => {
      expect(() => validateEntryData('writing', { words: 500 })).not.toThrow();
    });

    it('rejects missing words', () => {
      expect(() => validateEntryData('writing', {} as never)).toThrow(InvalidEntryDataError);
    });

    it('rejects negative words', () => {
      expect(() => validateEntryData('writing', { words: -1 })).toThrow(InvalidEntryDataError);
    });
  });

  describe('custom', () => {
    it('accepts empty data', () => {
      expect(() => validateEntryData('custom', {})).not.toThrow();
    });

    it('accepts any combination of optional fields', () => {
      expect(() => validateEntryData('custom', { number: 42, amount: 9.99, duration: 15 })).not.toThrow();
    });
  });
});

describe('enforceOwnership', () => {
  it('does not throw when user IDs match', () => {
    expect(() => enforceOwnership(1, 1)).not.toThrow();
  });

  it('throws WrongUserError when user IDs differ', () => {
    expect(() => enforceOwnership(1, 2)).toThrow(WrongUserError);
  });
});
