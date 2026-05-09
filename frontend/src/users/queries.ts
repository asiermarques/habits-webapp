import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, CreateUserBody, UpdateUserBody } from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

const usersKey = ['users'] as const;

export function useUsersQuery() {
  return useQuery({
    queryKey: usersKey,
    queryFn: () => apiFetch<User[]>('/users'),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) =>
      apiFetch<User>('/users', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserBody & { id: number }) =>
      apiFetch<User>(`/users/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}
