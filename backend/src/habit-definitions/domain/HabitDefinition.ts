import type { HabitDefinition } from '@habitsapp/shared';
export type { HabitDefinition };

import type { HabitType } from './HabitType.js';
import { TypeLockedError } from './errors.js';

export function resolvePositive(type: HabitType, positive?: boolean): boolean {
  if (type === 'workout' || type === 'writing') return true;
  return positive ?? true;
}

export type HabitPatch = {
  name?: string;
  type?: HabitType;
  positive?: boolean;
};

// Returns the computed field updates to persist. An empty object means no change.
// Throws TypeLockedError when the type would change on a definition that has entries.
export function applyPatch(
  existing: HabitDefinition,
  patch: HabitPatch,
  hasEntries: boolean,
): HabitPatch {
  const typeChanging = patch.type !== undefined && patch.type !== existing.type;
  if (typeChanging && hasEntries) throw new TypeLockedError();

  const newType = patch.type ?? existing.type;
  const newPositive = resolvePositive(newType, patch.positive ?? existing.positive);

  const updates: HabitPatch = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.type !== undefined) updates.type = patch.type;
  if (newPositive !== existing.positive) updates.positive = newPositive;

  return updates;
}
