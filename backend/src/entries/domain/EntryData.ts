import type { EntryData, HabitType, WorkoutData, WritingData } from '@habitsapp/shared';
import { InvalidEntryDataError } from './errors.js';

export function validateEntryData(type: HabitType, data: EntryData): void {
  if (type === 'workout') {
    const d = data as WorkoutData;
    if (typeof d.duration !== 'number' || d.duration <= 0) {
      throw new InvalidEntryDataError('workout entries require a positive `duration`');
    }
    return;
  }
  if (type === 'writing') {
    const d = data as WritingData;
    if (typeof d.words !== 'number' || d.words < 0) {
      throw new InvalidEntryDataError('writing entries require a non-negative `words`');
    }
  }
  // custom: all fields optional, no validation required
}
