import { DrizzleHabitDefinitionRepository } from './infrastructure/DrizzleHabitDefinitionRepository.js';

export function seedHabitDefinitionsForUser(userId: number): void {
  new DrizzleHabitDefinitionRepository().seedFor(userId);
}
