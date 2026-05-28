import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { BackupBundle, HabitDefinition, ImportResult, User } from '@habitsapp/shared';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/api/users').send({ name });
  return res.body as User;
}

async function createHabit(
  userId: number,
  body: { name: string; type: 'workout' | 'writing' | 'custom'; positive?: boolean },
): Promise<HabitDefinition> {
  const res = await request(app).post('/api/habit-definitions').send({ userId, ...body });
  return res.body as HabitDefinition;
}

function logEntry(habitDefinitionId: number, userId: number, date: string, data: object) {
  return request(app).post('/api/entries').send({ habitDefinitionId, userId, date, data });
}

async function getBackup(userId: number): Promise<BackupBundle> {
  const res = await request(app).get('/api/backup').query({ userId: String(userId) });
  expect(res.status).toBe(200);
  return res.body as BackupBundle;
}

function importBundle(userId: number, bundle: Partial<BackupBundle>) {
  return request(app)
    .post('/api/backup/import')
    .send({ version: 1, habitDefinitions: [], entries: [], ...bundle, userId });
}

describe('backup export', () => {
  it('exports the active user definitions and entries as a versioned bundle', async () => {
    const user = await createUser('Exporter');
    const run = await createHabit(user.id, { name: 'Run', type: 'workout' });
    await logEntry(run.id, user.id, '2026-05-20', { duration: 30, distance: 5 });

    const bundle = await getBackup(user.id);

    expect(bundle.version).toBe(1);
    expect(bundle.habitDefinitions).toContainEqual(
      expect.objectContaining({ name: 'Run', type: 'workout', positive: true }),
    );
    expect(bundle.entries).toContainEqual(
      expect.objectContaining({ habitName: 'Run', date: '2026-05-20', data: { duration: 30, distance: 5 } }),
    );
  });
});

describe('backup import (merge, skip duplicates)', () => {
  it('round-trips into a fresh user, preserving colors and entry data', async () => {
    const src = await createUser('Source');
    const run = await createHabit(src.id, { name: 'Marathon training', type: 'workout' });
    await logEntry(run.id, src.id, '2026-05-21', { duration: 45, distance: 8, notes: 'long run' });
    const srcBundle = await getBackup(src.id);

    const dest = await createUser('Dest'); // seeded with the 8 defaults
    const res = await importBundle(dest.id, srcBundle);
    expect(res.status).toBe(200);
    const result = res.body as ImportResult;

    // The 8 seeded defaults exist by name in dest → skipped; only the custom one is new.
    expect(result.habitsCreated).toBe(1);
    expect(result.habitsSkipped).toBe(srcBundle.habitDefinitions.length - 1);
    expect(result.entriesCreated).toBe(srcBundle.entries.length);

    const destBundle = await getBackup(dest.id);
    const imported = destBundle.habitDefinitions.find((d) => d.name === 'Marathon training');
    expect(imported).toEqual(
      srcBundle.habitDefinitions.find((d) => d.name === 'Marathon training'),
    );
    expect(destBundle.entries).toContainEqual(
      expect.objectContaining({
        habitName: 'Marathon training',
        date: '2026-05-21',
        data: { duration: 45, distance: 8, notes: 'long run' },
      }),
    );
  });

  it('is idempotent — re-importing the same bundle skips everything', async () => {
    const user = await createUser('Idempotent');
    const habit = await createHabit(user.id, { name: 'Pushups', type: 'custom', positive: true });
    await logEntry(habit.id, user.id, '2026-05-22', { number: 50 });
    const bundle = await getBackup(user.id);

    const res = await importBundle(user.id, bundle);
    const result = res.body as ImportResult;
    expect(result.habitsCreated).toBe(0);
    expect(result.entriesCreated).toBe(0);
    expect(result.entriesSkipped).toBe(bundle.entries.length);
  });

  it('rejects an entry referencing an unknown habit', async () => {
    const user = await createUser('BadRef');
    const res = await importBundle(user.id, {
      habitDefinitions: [{ name: 'Run', type: 'workout', positive: true, color: '#3b82f6' }],
      entries: [{ habitName: 'Ghost', date: '2026-05-20', data: { duration: 30 } }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown habit/i);
  });

  it('rejects invalid entry data (non-positive workout duration)', async () => {
    const user = await createUser('BadData');
    const res = await importBundle(user.id, {
      habitDefinitions: [{ name: 'Run', type: 'workout', positive: true, color: '#3b82f6' }],
      entries: [{ habitName: 'Run', date: '2026-05-20', data: { duration: 0 } }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duration/i);
  });

  it('keeps users isolated — importing into one user does not leak into another', async () => {
    const a = await createUser('IsoA');
    const b = await createUser('IsoB');
    await importBundle(a.id, {
      habitDefinitions: [{ name: 'Secret habit', type: 'custom', positive: true, color: '#10b981' }],
      entries: [{ habitName: 'Secret habit', date: '2026-05-20', data: { number: 1 } }],
    });

    const bBundle = await getBackup(b.id);
    expect(bBundle.habitDefinitions.some((d) => d.name === 'Secret habit')).toBe(false);
    expect(bBundle.entries.some((e) => e.habitName === 'Secret habit')).toBe(false);
  });
});
