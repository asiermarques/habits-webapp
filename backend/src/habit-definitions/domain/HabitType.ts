import { HABIT_TYPES, type HabitType } from '@habitsapp/shared';
export { HABIT_TYPES, type HabitType };

export function isHabitType(value: unknown): value is HabitType {
  return typeof value === 'string' && (HABIT_TYPES as readonly string[]).includes(value);
}
