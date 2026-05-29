import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GateLoginResponse, GateStatus } from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';
import { clearApiCache } from '@/pwa/cache';

export const gateKey = () => ['gate', 'status'] as const;

// Whether the instance is gated and whether this browser is currently unlocked.
// Drives GateGuard. staleTime: Infinity because it only changes via login/logout
// or a 401, both of which invalidate the key explicitly.
export function useGateStatus() {
  return useQuery({
    queryKey: gateKey(),
    queryFn: () => apiFetch<GateStatus>('/auth/status'),
    staleTime: Infinity,
  });
}

export function useGateLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      apiFetch<GateLoginResponse>('/auth/login', { method: 'POST', body: { password } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gate'] });
    },
  });
}

export function useGateLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<GateLoginResponse>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Re-lock synchronously: flip the cached status to authenticated:false so
      // GateGuard swaps in the unlock screen on the next render — don't wait for
      // a refetch. Then drop every *other* cached query so the next unlock starts
      // fresh (qc.clear() would also evict the gate status and break this).
      qc.setQueryData<GateStatus>(gateKey(), (prev) =>
        prev ? { ...prev, authenticated: false } : prev,
      );
      qc.removeQueries({ predicate: (query) => query.queryKey[0] !== 'gate' });
      // Also drop the service worker's offline copy of API reads so a later
      // offline session can't resurface this session's data (RISK-G1).
      void clearApiCache();
    },
  });
}
