import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BackupBundle, ImportResult } from '@habitsapp/shared';
import { apiFetch } from '@/lib/api';

// Restores a backup bundle into the given user (merge, skip duplicates). On
// success, invalidate every per-user read so the freshly imported definitions,
// entries, and metrics show up without a reload.
export function useImportBackup(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bundle: BackupBundle) =>
      apiFetch<ImportResult>('/backup/import', { method: 'POST', body: { ...bundle, userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habit-definitions'] });
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}
