import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type {
  ByHabitMetrics,
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

  it('sums repetitions across workout and custom entries', async () => {
    const user = await createUser('Alice');
    const running = await createHabit('Running', 'workout');
    const pushups = await createHabit('Pushups', 'custom');
    const journal = await createHabit('Journal', 'writing');

    await request(app).post('/entries').send({
      habitDefinitionId: running.id,
      userId: user.id,
      date: '2026-05-04',
      data: { duration: 30, number: 7 },
    });
    await request(app).post('/entries').send({
      habitDefinitionId: pushups.id,
      userId: user.id,
      date: '2026-05-05',
      data: { number: 50 },
    });
    await request(app).post('/entries').send({
      habitDefinitionId: journal.id,
      userId: user.id,
      date: '2026-05-06',
      data: { words: 300 },
    });

    const body = (
      await request(app).get(`/metrics/by-type?userId=${user.id}&today=${ANCHOR}`)
    ).body as ByTypeMetrics;
    const current = body.weeks.find((w) => w.weekStart === '2026-05-04')!;
    expect(current).toMatchObject({ workout: 7, writing: 1, custom: 50 });
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

  it('sums repetitions per day for workout and custom heatmaps', async () => {
    const user = await createUser('Alice');
    const running = await createHabit('Running', 'workout');
    const pushups = await createHabit('Pushups', 'custom');

    await request(app).post('/entries').send({
      habitDefinitionId: running.id,
      userId: user.id,
      date: '2026-05-04',
      data: { duration: 30, number: 5 },
    });
    await request(app).post('/entries').send({
      habitDefinitionId: running.id,
      userId: user.id,
      date: '2026-05-04',
      data: { duration: 20, number: 3 },
    });
    await request(app).post('/entries').send({
      habitDefinitionId: pushups.id,
      userId: user.id,
      date: '2026-05-04',
      data: { number: 40 },
    });

    const body = (
      await request(app).get(`/metrics/heatmap?userId=${user.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;

    const runningEntry = body.habits.find((h) => h.habitDefinitionId === running.id)!;
    expect(runningEntry.days).toEqual([{ date: '2026-05-04', count: 8 }]);
    const pushupsEntry = body.habits.find((h) => h.habitDefinitionId === pushups.id)!;
    expect(pushupsEntry.days).toEqual([{ date: '2026-05-04', count: 40 }]);
  });

  it('orders habits by most recent entry first; empty habits last', async () => {
    const user = await createUser('Alice');
    const oldest = await createHabit('Oldest', 'custom');
    const newest = await createHabit('Newest', 'custom');
    const middle = await createHabit('Middle', 'custom');
    const empty = await createHabit('Empty', 'custom');

    await logEntry(oldest, user.id, '2026-03-01');
    await logEntry(middle, user.id, '2026-04-15');
    await logEntry(newest, user.id, '2026-05-09');

    const body = (
      await request(app).get(`/metrics/heatmap?userId=${user.id}&today=${ANCHOR}`)
    ).body as HeatmapMetrics;

    expect(body.habits.map((h) => h.habitDefinitionId)).toEqual([
      newest.id,
      middle.id,
      oldest.id,
      empty.id,
    ]);
  });
});

describe('GET /metrics/by-habit', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/metrics/by-habit');
    expect(res.status).toBe(400);
  });

  it(`emits ${BY_TYPE_WEEKS} weeks with sparse habit counts`, async () => {
    const user = await createUser('Alice');
    const running = await createHabit('Running', 'workout');
    const journal = await createHabit('Journal', 'writing');

    await logEntry(running, user.id, '2026-05-04');
    await logEntry(running, user.id, '2026-05-05');
    await logEntry(journal, user.id, '2026-05-06');
    // previous week
    await logEntry(running, user.id, '2026-04-27');

    const body = (
      await request(app).get(`/metrics/by-habit?userId=${user.id}&today=${ANCHOR}`)
    ).body as ByHabitMetrics;

    const { rangeStart, rangeEnd } = byTypeRange(ANCHOR);
    expect(body.rangeStart).toBe(rangeStart);
    expect(body.rangeEnd).toBe(rangeEnd);
    expect(body.weeks).toHaveLength(BY_TYPE_WEEKS);

    const current = body.weeks.find((w) => w.weekStart === '2026-05-04')!;
    const runningCount = current.habits.find((h) => h.habitDefinitionId === running.id)?.count;
    const journalCount = current.habits.find((h) => h.habitDefinitionId === journal.id)?.count;
    expect(runningCount).toBe(2);
    expect(journalCount).toBe(1);

    const previous = body.weeks.find((w) => w.weekStart === '2026-04-27')!;
    expect(previous.habits).toHaveLength(1);
    expect(previous.habits[0]).toMatchObject({ habitDefinitionId: running.id, count: 1 });
  });

  it('sums repetitions per week', async () => {
    const user = await createUser('Alice');
    const pushups = await createHabit('Pushups', 'custom');

    await request(app).post('/entries').send({
      habitDefinitionId: pushups.id, userId: user.id,
      date: '2026-05-04', data: { number: 30 },
    });
    await request(app).post('/entries').send({
      habitDefinitionId: pushups.id, userId: user.id,
      date: '2026-05-06', data: { number: 20 },
    });

    const body = (
      await request(app).get(`/metrics/by-habit?userId=${user.id}&today=${ANCHOR}`)
    ).body as ByHabitMetrics;

    const current = body.weeks.find((w) => w.weekStart === '2026-05-04')!;
    expect(current.habits.find((h) => h.habitDefinitionId === pushups.id)?.count).toBe(50);
  });

  it('isolates results per user', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const running = await createHabit('Running', 'workout');

    await logEntry(running, alice.id, '2026-05-04');
    await logEntry(running, bob.id, '2026-05-04');
    await logEntry(running, bob.id, '2026-05-05');

    const aliceBody = (
      await request(app).get(`/metrics/by-habit?userId=${alice.id}&today=${ANCHOR}`)
    ).body as ByHabitMetrics;
    const bobBody = (
      await request(app).get(`/metrics/by-habit?userId=${bob.id}&today=${ANCHOR}`)
    ).body as ByHabitMetrics;

    const aliceTotal = aliceBody.weeks.reduce(
      (s, w) => s + w.habits.reduce((x, h) => x + h.count, 0), 0,
    );
    const bobTotal = bobBody.weeks.reduce(
      (s, w) => s + w.habits.reduce((x, h) => x + h.count, 0), 0,
    );

    expect(aliceTotal).toBe(1);
    expect(bobTotal).toBe(2);
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
