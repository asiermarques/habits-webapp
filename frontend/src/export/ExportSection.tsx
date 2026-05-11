import { useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserContext } from '@/users/UserContext';
import { todayIso } from '@/entries/date';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
}

export function ExportSection() {
  const { activeUser } = useUserContext();

  const [from, setFrom] = useState<string>(isoDaysAgo(30));
  const [to, setTo] = useState<string>(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  const valid = !!activeUser && from && to && from <= to;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || !activeUser) return;
    setError(null);
    setPending(true);
    try {
      const params = new URLSearchParams({
        userId: String(activeUser.id),
        from,
        to,
      });
      const res = await fetch(`${API_URL}/export/csv?${params.toString()}`);
      if (!res.ok) {
        let message = `Request failed: ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        setError(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habits-${slugify(activeUser.name)}-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setPending(false);
    }
  }

  if (!activeUser) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="export-panel"
        className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-lg font-semibold hover:bg-neutral-50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-neutral-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-500" aria-hidden />
        )}
        Export CSV
      </button>

      {open && (
        <form
          id="export-panel"
          onSubmit={onSubmit}
          className="mt-2 space-y-3 rounded-md border border-neutral-200 bg-white p-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-from">From</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-to">To</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                min={from || undefined}
                max={todayIso()}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" disabled={!valid || pending} className="w-full">
            {pending ? 'Exporting…' : 'Export'}
          </Button>
        </form>
      )}
    </section>
  );
}
