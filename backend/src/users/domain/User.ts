import type { User } from '@habitsapp/shared';
export type { User };

export function resolveIsDefault(existingCount: number): boolean {
  return existingCount === 0;
}

export function pickNextDefaultAfter(deletedWasDefault: boolean, remaining: User[]): User | undefined {
  if (!deletedWasDefault) return undefined;
  return remaining[0];
}
