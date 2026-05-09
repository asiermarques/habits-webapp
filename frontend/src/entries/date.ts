// Date helpers. Entries are stored as YYYY-MM-DD (date-only, no time zone).
// Uses the user's *local* calendar day on purpose: a habit logged at 11:55 PM
// belongs to that day from the user's perspective, even if UTC has rolled over.

export function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(iso: string): string {
  // Render as "Sat, May 9" — locale-aware, no year unless it differs from today's
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const sameYear = today.getFullYear() === y;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(date);
}
