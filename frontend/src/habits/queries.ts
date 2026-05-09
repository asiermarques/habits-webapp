import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  HabitDefinition,
  CreateHabitDefinitionBody,
  UpdateHabitDefinitionBody,
} from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

const habitDefinitionsKey = ['habit-definitions'] as const;

export function useHabitDefinitionsQuery() {
  return useQuery({
    queryKey: habitDefinitionsKey,
    queryFn: () => apiFetch<HabitDefinition[]>('/habit-definitions'),
  });
}

export function useCreateHabitDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateHabitDefinitionBody) =>
      apiFetch<HabitDefinition>('/habit-definitions', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitDefinitionsKey }),
  });
}

export function useUpdateHabitDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateHabitDefinitionBody & { id: number }) =>
      apiFetch<HabitDefinition>(`/habit-definitions/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitDefinitionsKey }),
  });
}

export function useDeleteHabitDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/habit-definitions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitDefinitionsKey }),
  });
}
