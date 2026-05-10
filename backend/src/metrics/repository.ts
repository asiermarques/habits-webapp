import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { entries, habitDefinitions } from '../db/schema.js';
import type {
  ByTypeMetrics,
  ByTypeWeek,
  HabitCount,
  HabitHeatmap,
  HabitType,
  HeatmapDay,
  HeatmapMetrics,
  WeeklyMetrics,
} from '@habitsapp/shared';

export const BY_TYPE_WEEKS = 13;
export const HEATMAP_WEEKS = 26;

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

// --- Last 3 months: by-type ---

export type RangeInput = {
  userId: number;
  today?: string;
};

export function getByTypeMetrics({ userId, today }: RangeInput): ByTypeMetrics {
  const anchor = today ?? isoToday();
  const { rangeStart, rangeEnd, weekStarts } = byTypeRange(anchor);

  const rows = db
    .select({
      date: entries.date,
      type: habitDefinitions.type,
      count: sql<number>`COUNT(*)`,
    })
    .from(entries)
    .innerJoin(habitDefinitions, eq(entries.habitDefinitionId, habitDefinitions.id))
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.date, rangeStart),
        lte(entries.date, rangeEnd),
      ),
    )
    .groupBy(entries.date, habitDefinitions.type)
    .all();

  const byWeekStart = new Map<string, { workout: number; writing: number; custom: number }>();
  for (const ws of weekStarts) {
    byWeekStart.set(ws, { workout: 0, writing: 0, custom: 0 });
  }

  for (const r of rows) {
    const ws = weekStartFor(r.date);
    const bucket = byWeekStart.get(ws);
    if (!bucket) continue; // outside range guard
    bucket[r.type as HabitType] += Number(r.count);
  }

  const weeks: ByTypeWeek[] = weekStarts.map((weekStart) => ({
    weekStart,
    weekEnd: addDaysIso(weekStart, 6),
    ...byWeekStart.get(weekStart)!,
  }));

  return { rangeStart, rangeEnd, weeks };
}

// --- Last 3 months: heatmap ---

export function getHeatmapMetrics({ userId, today }: RangeInput): HeatmapMetrics {
  const anchor = today ?? isoToday();
  const { rangeStart, rangeEnd } = heatmapRange(anchor);

  const rows = db
    .select({
      habitDefinitionId: entries.habitDefinitionId,
      date: entries.date,
      count: sql<number>`COUNT(*)`,
    })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        gte(entries.date, rangeStart),
        lte(entries.date, rangeEnd),
      ),
    )
    .groupBy(entries.habitDefinitionId, entries.date)
    .all();

  const allDefs = db
    .select({ id: habitDefinitions.id })
    .from(habitDefinitions)
    .all();

  const byDef = new Map<number, HeatmapDay[]>();
  for (const def of allDefs) byDef.set(def.id, []);

  for (const r of rows) {
    const list = byDef.get(r.habitDefinitionId) ?? [];
    list.push({ date: r.date, count: Number(r.count) });
    byDef.set(r.habitDefinitionId, list);
  }

  const habits: HabitHeatmap[] = [];
  for (const [habitDefinitionId, days] of byDef) {
    days.sort((a, b) => a.date.localeCompare(b.date));
    habits.push({ habitDefinitionId, days });
  }
  habits.sort((a, b) => a.habitDefinitionId - b.habitDefinitionId);

  return { rangeStart, rangeEnd, habits };
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

function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// Monday of the week that contains `iso`.
function weekStartFor(iso: string): string {
  const dt = parseIso(iso);
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
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
