import { createHabitDefinition } from './repository.js';
import type { HabitType } from '@habitsapp/shared';

type SeedDefinition = {
  name: string;
  type: HabitType;
  positive?: boolean;
};

const SEED: SeedDefinition[] = [
  { name: 'Running', type: 'workout' },
  { name: 'Rowing', type: 'workout' },
  { name: 'Writing', type: 'writing' },
  { name: 'Reading', type: 'custom', positive: true },
  { name: 'Meat consuming', type: 'custom', positive: false },
  { name: 'Fast food consuming', type: 'custom', positive: false },
  { name: 'Cooking', type: 'custom', positive: true },
  { name: 'Social interactions', type: 'custom', positive: true },
];

export function seedHabitDefinitionsForUser(userId: number): void {
  for (const definition of SEED) {
    createHabitDefinition({ userId, ...definition });
  }
}
