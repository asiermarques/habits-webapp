// READ MODEL — date arithmetic helpers shared across metrics queries.
import { ISO_DATE_RE } from '../../shared/domain/value-objects/IsoDate.js';

export { ISO_DATE_RE };

export const BY_TYPE_WEEKS = 13;
export const HEATMAP_WEEKS = 26;

export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isoToday(): string {
  const d = new Date();
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// Monday of the week that contains `iso`.
export function weekStartFor(iso: string): string {
  const dt = parseIso(iso);
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// JS getUTCDay(): Sun=0..Sat=6 → days since Monday: (day + 6) % 7.
export function currentWeekRange(iso: string): { weekStart: string; weekEnd: string } {
  const dt = parseIso(iso);
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weekStart: toIso(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
    weekEnd: toIso(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, sunday.getUTCDate()),
  };
}

export function enumerateWeek(weekStartIso: string): string[] {
  const out: string[] = [];
  const start = parseIso(weekStartIso);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }
  return out;
}

function rangeOfWeeks(
  iso: string,
  weeks: number,
): { rangeStart: string; rangeEnd: string; weekStarts: string[] } {
  const { weekStart: latestWeekStart, weekEnd } = currentWeekRange(iso);
  const earliestWeekStart = addDaysIso(latestWeekStart, -7 * (weeks - 1));

  const weekStarts: string[] = [];
  for (let i = 0; i < weeks; i++) {
    weekStarts.push(addDaysIso(earliestWeekStart, 7 * i));
  }

  return { rangeStart: earliestWeekStart, rangeEnd: weekEnd, weekStarts };
}

export const byTypeRange = (iso: string) => rangeOfWeeks(iso, BY_TYPE_WEEKS);
export const heatmapRange = (iso: string) => rangeOfWeeks(iso, HEATMAP_WEEKS);
