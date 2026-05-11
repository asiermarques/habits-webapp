import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  HabitDefinition,
  CreateHabitDefinitionBody,
  UpdateHabitDefinitionBody,
} from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

export const habitDefinitionsKey = (userId: number) =>
  ['habit-definitions', userId] as const;

export function useHabitDefinitionsQuery(userId: number) {
  return useQuery({
    queryKey: habitDefinitionsKey(userId),
    enabled: userId > 0,
    queryFn: () =>
      apiFetch<HabitDefinition[]>(`/habit-definitions?userId=${userId}`),
  });
}

export function useCreateHabitDefinition(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<CreateHabitDefinitionBody, 'userId'>) =>
      apiFetch<HabitDefinition>('/habit-definitions', {
        method: 'POST',
        body: { userId, ...body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitDefinitionsKey(userId) }),
  });
}

export function useUpdateHabitDefinition(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateHabitDefinitionBody & { id: number }) =>
      apiFetch<HabitDefinition>(`/habit-definitions/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitDefinitionsKey(userId) }),
  });
}

export function useDeleteHabitDefinition(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/habit-definitions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: habitDefinitionsKey(userId) }),
  });
}
