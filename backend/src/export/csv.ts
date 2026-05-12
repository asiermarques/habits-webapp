import type { ExportRow } from './queries/getRowsInRange.js';

export const EXPORT_COLUMNS = [
  'date',
  'habit_name',
  'type',
  'positive',
  'duration',
  'distance',
  'weight',
  'amount',
  'notes',
  'words',
  'time',
  'number',
] as const;

export function rowsToCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const lines = rows.map((r) =>
    [
      r.date,
      r.habitName,
      r.type,
      r.positive,
      r.duration,
      r.distance,
      r.weight,
      r.amount,
      r.notes,
      r.words,
      r.time,
      r.number,
    ]
      .map(csvEscape)
      .join(','),
  );
  // Trailing newline keeps tools like `wc -l` honest.
  return [header, ...lines].join('\n') + '\n';
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
