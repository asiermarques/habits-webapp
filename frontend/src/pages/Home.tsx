import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { HealthResponse } from '@habitsapp/shared';

export function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
  });

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Home</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Log button, metrics summary and entries list will live here (Slices 3–4).
      </p>
      <div className="mt-4 rounded-md border border-neutral-200 p-3 text-sm">
        <div className="font-medium">API status</div>
        {isLoading && <div className="text-neutral-500">Checking…</div>}
        {error && <div className="text-red-600">Unreachable: {String(error)}</div>}
        {data && <div className="text-emerald-600">ok: {String(data.ok)}</div>}
      </div>
    </div>
  );
}
