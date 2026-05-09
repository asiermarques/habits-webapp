import { db } from '../db/index.js';
import { habitDefinitions } from '../db/schema.js';
import { createHabitDefinition } from './repository.js';
import type { CreateInput } from './repository.js';

const SEED: CreateInput[] = [
  { name: 'Running', type: 'workout' },
  { name: 'Rowing', type: 'workout' },
  { name: 'Writing', type: 'writing' },
  { name: 'Reading', type: 'custom', positive: true },
  { name: 'Meat consuming', type: 'custom', positive: false },
  { name: 'Fast food consuming', type: 'custom', positive: false },
  { name: 'Cooking', type: 'custom', positive: true },
  { name: 'Social interactions', type: 'custom', positive: true },
];

export function seedHabitDefinitions() {
  const existing = db.select().from(habitDefinitions).all();
  if (existing.length > 0) return;

  for (const definition of SEED) {
    createHabitDefinition(definition);
  }
}
