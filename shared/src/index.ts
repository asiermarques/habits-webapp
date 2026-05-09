// Shared types between backend and frontend.
// Will grow with each slice.

export type HealthResponse = {
  ok: boolean;
};

export type User = {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: string;
};

export type CreateUserBody = {
  name: string;
};

export type UpdateUserBody = {
  name?: string;
  isDefault?: boolean;
};

export type HabitType = 'workout' | 'writing' | 'custom';

export const HABIT_TYPES: HabitType[] = ['workout', 'writing', 'custom'];

export type HabitDefinition = {
  id: number;
  name: string;
  type: HabitType;
  positive: boolean;
  color: string;
  createdAt: string;
};

export type CreateHabitDefinitionBody = {
  name: string;
  type: HabitType;
  positive?: boolean;
};

export type UpdateHabitDefinitionBody = {
  name?: string;
  type?: HabitType;
  positive?: boolean;
};
