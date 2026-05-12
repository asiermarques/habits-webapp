import type { HabitDefinition } from './HabitDefinition.js';
import type { HabitType } from './HabitType.js';
import type { HabitPatch } from './HabitDefinition.js';

export type InsertInput = {
  userId: number;
  name: string;
  type: HabitType;
  positive?: boolean;
};

export interface HabitDefinitionRepository {
  listByUser(userId: number): HabitDefinition[];
  findById(id: number): HabitDefinition | undefined;
  insert(input: InsertInput): HabitDefinition;
  update(id: number, patch: HabitPatch): HabitDefinition;
  delete(id: number): void;
  countPositiveByUser(userId: number): number;
  seedFor(userId: number): void;
}
