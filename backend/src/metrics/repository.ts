import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { entries } from '../db/schema.js';
import type { HabitCount, WeeklyMetrics } from '@habitsapp/shared';

export type WeeklyInput = {
  userId: number;
  habitDefinitionId?: number;
  // Anchor for the Mon..Sun week, YYYY-MM-DD; defaults to UTC today.
  today?: string;
};

export function getWeeklyMetrics({
  userId,
  habitDefinitionId,
  today,
}: WeeklyInput): WeeklyMetrics {
  const anchor = today ?? isoToday();
  const { weekStart, weekEnd } = currentWeekRange(anchor);

  const conditions = [
    eq(entries.userId, userId),
    gte(entries.date, weekStart),
    lte(entries.date, weekEnd),
  ];
  if (habitDefinitionId !== undefined) {
    conditions.push(eq(entries.habitDefinitionId, habitDefinitionId));
  }

  const rows = db
    .select({
      date: entries.date,
      habitDefinitionId: entries.habitDefinitionId,
      count: sql<number>`COUNT(*)`,
    })
    .from(entries)
    .where(and(...conditions))
    .groupBy(entries.date, entries.habitDefinitionId)
    .all();

  // Bucket by date.
  const buckets = new Map<string, HabitCount[]>();
  for (const r of rows) {
    const list = buckets.get(r.date) ?? [];
    list.push({ habitDefinitionId: r.habitDefinitionId, count: Number(r.count) });
    buckets.set(r.date, list);
  }

  // Always emit 7 days (Mon..Sun), even when empty.
  const days = enumerateWeek(weekStart).map((date) => ({
    date,
    counts: buckets.get(date) ?? [],
  }));

  return { weekStart, weekEnd, days };
}

// --- date helpers ---

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isoToday(): string {
  const d = new Date();
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
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

function enumerateWeek(weekStartIso: string): string[] {
  const out: string[] = [];
  const start = parseIso(weekStartIso);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }
  return out;
}
