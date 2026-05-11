import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { HabitDefinition, User, WeeklyMetrics } from '@habitsapp/shared';
import { currentWeekRange } from '../repository.js';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/users').send({ name });
  return res.body as User;
}

async function createHabit(
  userId: number,
  name: string,
  type: 'workout' | 'writing' | 'custom',
): Promise<HabitDefinition> {
  const res = await request(app).post('/habit-definitions').send({ userId, name, type });
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

async function getWeekly(
  userId: number,
  today: string,
  habitDefinitionId?: number,
) {
  const params = new URLSearchParams({ userId: String(userId), today });
  if (habitDefinitionId !== undefined) {
    params.set('habitDefinitionId', String(habitDefinitionId));
  }
  return request(app).get(`/metrics/weekly?${params.toString()}`);
}

const ANCHOR = '2026-05-09'; // Saturday → week 2026-05-04 (Mon) .. 2026-05-10 (Sun)

describe('GET /metrics/weekly', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).get('/metrics/weekly');
    expect(res.status).toBe(400);
  });

  it('returns 400 when today is malformed', async () => {
    const user = await createUser('Alice');
    const res = await request(app).get(
      `/metrics/weekly?userId=${user.id}&today=09-05-2026`,
    );
    expect(res.status).toBe(400);
  });

  it('returns the Mon..Sun range with 7 empty day buckets when no entries exist', async () => {
    const user = await createUser('Alice');
    await createHabit(user.id, 'Reading', 'custom');

    const res = await getWeekly(user.id, ANCHOR);
    expect(res.status).toBe(200);
    const body = res.body as WeeklyMetrics;

    const { weekStart, weekEnd } = currentWeekRange(ANCHOR);
    expect(body.weekStart).toBe(weekStart);
    expect(body.weekEnd).toBe(weekEnd);
    expect(body.days).toHaveLength(7);
    expect(body.days.map((d) => d.date)).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ]);
    expect(body.days.every((d) => d.counts.length === 0)).toBe(true);
  });

  it('aggregates counts per habit per day inside the week', async () => {
    const user = await createUser('Alice');
    const reading = await createHabit(user.id, 'Reading', 'custom');
    const writing = await createHabit(user.id, 'Journal', 'writing');

    await logEntry(reading, user.id, '2026-05-04'); // Mon
    await logEntry(reading, user.id, '2026-05-04'); // Mon (×2)
    await logEntry(writing, user.id, '2026-05-04'); // Mon, different habit
    await logEntry(reading, user.id, '2026-05-09'); // Sat

    const body = (await getWeekly(user.id, ANCHOR)).body as WeeklyMetrics;

    const monday = body.days.find((d) => d.date === '2026-05-04')!;
    expect(monday.counts).toEqual(
      expect.arrayContaining([
        { habitDefinitionId: reading.id, count: 2 },
        { habitDefinitionId: writing.id, count: 1 },
      ]),
    );

    const saturday = body.days.find((d) => d.date === '2026-05-09')!;
    expect(saturday.counts).toEqual([{ habitDefinitionId: reading.id, count: 1 }]);

    // Other days are empty.
    expect(body.days.find((d) => d.date === '2026-05-05')!.counts).toEqual([]);
  });

  it('excludes entries outside the anchor week', async () => {
    const user = await createUser('Alice');
    const reading = await createHabit(user.id, 'Reading', 'custom');

    await logEntry(reading, user.id, '2026-05-03'); // Sun before
    await logEntry(reading, user.id, '2026-05-11'); // Mon after
    await logEntry(reading, user.id, '2026-05-09'); // inside

    const body = (await getWeekly(user.id, ANCHOR)).body as WeeklyMetrics;
    const total = body.days.reduce(
      (sum, d) => sum + d.counts.reduce((s, c) => s + c.count, 0),
      0,
    );
    expect(total).toBe(1);
  });

  it('filters by habitDefinitionId when provided', async () => {
    const user = await createUser('Alice');
    const reading = await createHabit(user.id, 'Reading', 'custom');
    const writing = await createHabit(user.id, 'Journal', 'writing');

    await logEntry(reading, user.id, '2026-05-04');
    await logEntry(writing, user.id, '2026-05-04');
    await logEntry(writing, user.id, '2026-05-05');

    const body = (await getWeekly(user.id, ANCHOR, writing.id)).body as WeeklyMetrics;
    const allCounts = body.days.flatMap((d) => d.counts);

    expect(allCounts.every((c) => c.habitDefinitionId === writing.id)).toBe(true);
    expect(allCounts).toHaveLength(2);
  });

  it('sums repetitions instead of entries for workout and custom habits', async () => {
    const user = await createUser('Alice');
    const running = await createHabit(user.id, 'Running', 'workout');
    const pushups = await createHabit(user.id, 'Pushups', 'custom');
    const journal = await createHabit(user.id, 'Journal', 'writing');

    await request(app).post('/entries').send({
      habitDefinitionId: running.id,
      userId: user.id,
      date: '2026-05-04',
      data: { duration: 30, number: 10 },
    });
    await request(app).post('/entries').send({
      habitDefinitionId: pushups.id,
      userId: user.id,
      date: '2026-05-04',
      data: { number: 25 },
    });
    // Writing has no repetitions field → still counts as 1.
    await request(app).post('/entries').send({
      habitDefinitionId: journal.id,
      userId: user.id,
      date: '2026-05-04',
      data: { words: 200 },
    });
    // Workout with no `number` falls back to 1.
    await request(app).post('/entries').send({
      habitDefinitionId: running.id,
      userId: user.id,
      date: '2026-05-05',
      data: { duration: 20 },
    });

    const body = (await getWeekly(user.id, ANCHOR)).body as WeeklyMetrics;
    const monday = body.days.find((d) => d.date === '2026-05-04')!;
    expect(monday.counts).toEqual(
      expect.arrayContaining([
        { habitDefinitionId: running.id, count: 10 },
        { habitDefinitionId: pushups.id, count: 25 },
        { habitDefinitionId: journal.id, count: 1 },
      ]),
    );
    const tuesday = body.days.find((d) => d.date === '2026-05-05')!;
    expect(tuesday.counts).toEqual([{ habitDefinitionId: running.id, count: 1 }]);
  });

  it('isolates results per user', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const aliceReading = await createHabit(alice.id, 'Reading', 'custom');
    const bobReading = await createHabit(bob.id, 'Reading', 'custom');

    await logEntry(aliceReading, alice.id, '2026-05-04');
    await logEntry(bobReading, bob.id, '2026-05-04');
    await logEntry(bobReading, bob.id, '2026-05-05');

    const aliceBody = (await getWeekly(alice.id, ANCHOR)).body as WeeklyMetrics;
    const bobBody = (await getWeekly(bob.id, ANCHOR)).body as WeeklyMetrics;

    const aliceTotal = aliceBody.days.reduce(
      (s, d) => s + d.counts.reduce((x, c) => x + c.count, 0),
      0,
    );
    const bobTotal = bobBody.days.reduce(
      (s, d) => s + d.counts.reduce((x, c) => x + c.count, 0),
      0,
    );

    expect(aliceTotal).toBe(1);
    expect(bobTotal).toBe(2);
  });
});
