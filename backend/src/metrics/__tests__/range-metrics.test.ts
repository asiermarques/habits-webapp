import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type {
  ByTypeMetrics,
  HabitDefinition,
  HeatmapMetrics,
  User,
} from '@habitsapp/shared';
import { BY_TYPE_WEEKS, byTypeRange, heatmapRange } from '../repository.js';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/users').send({ name });
  return res.body as User;
}

async function createHabit(
  name: string,
  type: 'workout' | 'writing' | 'custom',
): Promise<HabitDefinition> {
  const res = await request(app).post('/habit-definitions').send({ name, type });
  return res.body as HabitDefinition;
}

async function logEntry(habit: HabitDefinition, userId: number, date: string) {
  const data =
    habit.type === 'workout'
      ? { duration: 30 }
      : habit.type === 'writing'
      ? { words: 100 }
      : { number: 1 };
  return request(app)
    .post('/entries')
    .send({ habitDefinitionId: habit.id, userId, date, data });
}

const ANCHOR = '2026-05-09'; // Saturday → current week 2026-05-04..2026-05-10

describe('GET /metrics/by-type', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/metrics/by-type');
    expect(res.status).toBe(400);
  });

  it('returns 400 when today is malformed', async () => {
    const user = await createUser('Alice');
    const res = await request(app).get(
      `/metrics/by-type?userId=${user.id}&today=09-05-2026`,
    );
    expect(res.status).toBe(400);
  });

  it(`emits ${BY_TYPE_WEEKS} weeks (oldest first) covering the last 3 months`, async () => {
    const user = await createUser('Alice');
    const res = await request(app).get(
      `/metrics/by-type?userId=${user.id}&today=${ANCHOR}`,
    );
    expect(res.status).toBe(200);
    const body = res.body as ByTypeMetrics;

    const { rangeStart, rangeEnd, weekStarts } = byTypeRange(ANCHOR);
    expect(body.rangeStart).toBe(rangeStart);
    expect(body.rangeEnd).toBe(rangeEnd);
    expect(body.weeks).toHaveLength(BY_TYPE_WEEKS);
    expect(body.weeks.map((w) => w.weekStart)).toEqual(weekStarts);
    expect(body.weeks.every(
      (w) => w.workout === 0 && w.writing === 0 && w.custom === 0,
    )).toBe(true);
  });

  it('aggregates entries per archetype per week', async () => {
    const user = await createUser('Alice');
    const running = await createHabit('Running', 'workout');
    const journal = await createHabit('Journal', 'writing');
    const reading = await createHabit('Reading', 'custom');

    // current week (2026-05-04..2026-05-10)
    await logEntry(running, user.id, '2026-05-04');
    await logEntry(running, user.id, '2026-05-05');
    await logEntry(journal, user.id, '2026-05-06');
    await logEntry(reading, user.id, '2026-05-09');
    await logEntry(reading, user.id, '2026-05-09');

    // previous week (2026-04-27..2026-05-03)
    await logEntry(running, user.id, '2026-04-27');

    const body = (
      await request(app).get(`/metrics/by-type?userId=${user.id}&today=${ANCHOR}`)
    ).body as ByTypeMetrics;

    const current = body.weeks.find((w) => w.weekStart === '2026-05-04')!;
    expect(current).toMatchObject({ workout: 2, writing: 1, custom: 2 });

    const previous = body.weeks.find((w) => w.weekStart === '2026-04-27')!;
    expect(previous).toMatchObject({ workout: 1, writing: 0, custom: 0 });

    // Some other week is empty.
    const other = body.weeks.find((w) => w.weekStart === '2026-04-20')!;
    expect(other).toMatchObject({ workout: 0, writing: 0, custom: 0 });
  });

  it('excludes entries outside the 3-month range', async () => {
    const user = await createUser('Alice');
    const running = await createHabit('Running', 'workout');

    const { rangeStart, rangeEnd, weekStarts } = byTypeRange(ANCHOR);
    // One day before the range, one day after.
    const beforeRange = subtractOneDay(rangeStart);
    const afterRange = addOneDay(rangeEnd);

    await logEntry(running, user.id, beforeRange);
    await logEntry(running, user.id, afterRange);
    await logEntry(running, user.id, weekStarts[0]); // inside

    const body = (
      await request(app).get(`/metrics/by-type?userId=${user.id}&today=${ANCHOR}`)
    ).body as ByTypeMetrics;

    const total = body.weeks.reduce(
      (s, w) => s + w.workout + w.writing + w.custom,
      0,
    );
    expect(total).toBe(1);
  });

  it('isolates results per user', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const running = await createHabit('Running', 'workout');

    await logEntry(running, alice.id, '2026-05-04');
    await logEntry(running, bob.id, '2026-05-04');
    await logEntry(running, bob.id, '2026-05-05');

    const aliceBody = (
      await request(app).get(`/metrics/by-type?userId=${alice.id}&today=${ANCHOR}`)
    ).body as ByTypeMetrics;
    const bobBody = (
      await request(app).get(`/metrics/by-type?userId=${bob.id}&today=${ANCHOR}`)
    ).body as ByTypeMetrics;

    const aliceTotal = aliceBody.weeks.reduce((s, w) => s + w.workout, 0);
    const bobTotal = bobBody.weeks.reduce((s, w) => s + w.workout, 0);

    expect(aliceTotal).toBe(1);
    expect(bobTotal).toBe(2);
  });
});

describe('GET /metrics/heatmap', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/metrics/heatmap');
    expect(res.status).toBe(400);
  });

  it('returns one entry per habit definition (sparse, sorted by date)', async () => {
    const user = await createUser('Alice');
    const reading = await createHabit('Reading', 'custom');
    const writing = await createHabit('Journal', 'writing');

    await logEntry(reading, user.id, '2026-05-04');
    await logEntry(reading, user.id, '2026-05-04'); // same day, +1
    await logEntry(reading, user.id, '2026-04-15');
    await logEntry(writing, user.id, '2026-05-09');

    const body = (
      await request(app).get(`/metrics/heatmap?userId=${user.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;

    const { rangeStart, rangeEnd } = heatmapRange(ANCHOR);
    expect(body.rangeStart).toBe(rangeStart);
    expect(body.rangeEnd).toBe(rangeEnd);

    const readingEntry = body.habits.find((h) => h.habitDefinitionId === reading.id)!;
    expect(readingEntry.days).toEqual([
      { date: '2026-04-15', count: 1 },
      { date: '2026-05-04', count: 2 },
    ]);

    const writingEntry = body.habits.find((h) => h.habitDefinitionId === writing.id)!;
    expect(writingEntry.days).toEqual([{ date: '2026-05-09', count: 1 }]);
  });

  it('includes habits with zero entries (empty days array)', async () => {
    const user = await createUser('Alice');
    const reading = await createHabit('Reading', 'custom');
    const _writing = await createHabit('Journal', 'writing');

    await logEntry(reading, user.id, '2026-05-04');

    const body = (
      await request(app).get(`/metrics/heatmap?userId=${user.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;

    expect(body.habits).toHaveLength(2);
    const empty = body.habits.find((h) => h.habitDefinitionId !== reading.id)!;
    expect(empty.days).toEqual([]);
  });

  it('excludes entries outside the 12-month range', async () => {
    const user = await createUser('Alice');
    const reading = await createHabit('Reading', 'custom');

    const { rangeStart, rangeEnd } = heatmapRange(ANCHOR);
    await logEntry(reading, user.id, subtractOneDay(rangeStart));
    await logEntry(reading, user.id, addOneDay(rangeEnd));
    await logEntry(reading, user.id, rangeStart);

    const body = (
      await request(app).get(`/metrics/heatmap?userId=${user.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;

    const total = body.habits.reduce(
      (s, h) => s + h.days.reduce((x, d) => x + d.count, 0),
      0,
    );
    expect(total).toBe(1);
  });

  it('isolates results per user', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const reading = await createHabit('Reading', 'custom');

    await logEntry(reading, alice.id, '2026-05-04');
    await logEntry(reading, bob.id, '2026-05-04');
    await logEntry(reading, bob.id, '2026-05-05');

    const aliceBody = (
      await request(app).get(`/metrics/heatmap?userId=${alice.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;
    const bobBody = (
      await request(app).get(`/metrics/heatmap?userId=${bob.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;

    const aliceDays = aliceBody.habits.find((h) => h.habitDefinitionId === reading.id)!.days;
    const bobDays = bobBody.habits.find((h) => h.habitDefinitionId === reading.id)!.days;

    expect(aliceDays).toHaveLength(1);
    expect(bobDays).toHaveLength(2);
  });
});

function addOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return toIso(dt);
}

function subtractOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return toIso(dt);
}

function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
