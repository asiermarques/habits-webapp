import { useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, ChevronRight, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { BackupBundle } from '@habitsapp/shared';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/users/UserContext';
import { t } from '@/lib/i18n';
import { useImportBackup } from './queries';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
}

export function BackupSection() {
  const { activeUser } = useUserContext();
  const userId = activeUser?.id ?? 0;
  const importBackup = useImportBackup(userId);

  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activeUser) return null;

  async function onExport() {
    if (!activeUser) return;
    setExporting(true);
    try {
      // Raw fetch (not apiFetch) so we can stream the response as a file blob.
      // credentials:'include' mirrors apiFetch so the gate cookie travels too.
      const res = await fetch(`${API_URL}/api/backup?userId=${activeUser.id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habits-${slugify(activeUser.name)}-backup.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('export.error'));
    } finally {
      setExporting(false);
    }
  }

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    let bundle: BackupBundle;
    try {
      bundle = JSON.parse(await file.text()) as BackupBundle;
    } catch {
      toast.error(t('backup.invalidFile'));
      return;
    }

    importBackup.mutate(bundle, {
      onSuccess: (result) =>
        toast.success(
          t('backup.imported', {
            habits: String(result.habitsCreated),
            entries: String(result.entriesCreated),
            skipped: String(result.habitsSkipped + result.entriesSkipped),
          }),
        ),
      // API errors (e.g. validation 400s) are surfaced by the global MutationCache handler.
    });
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="backup-panel"
        className="flex w-full items-center gap-2 rounded-md border border-hairline bg-card px-3 py-2 text-left text-lg font-semibold hover:bg-paper-deep"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-ink-soft" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-soft" aria-hidden />
        )}
        {t('backup.title')}
      </button>

      {open && (
        <div id="backup-panel" className="mt-2 space-y-3 rounded-md border border-hairline bg-card p-3">
          <p className="text-sm text-ink-soft">{t('backup.description')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={onExport} disabled={exporting} className="sm:flex-1">
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? t('backup.exporting') : t('backup.export')}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBackup.isPending}
              className="sm:flex-1"
            >
              <Upload className="h-4 w-4" aria-hidden />
              {importBackup.isPending ? t('backup.importing') : t('backup.import')}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFileChosen}
          />
        </div>
      )}
    </section>
  );
}
