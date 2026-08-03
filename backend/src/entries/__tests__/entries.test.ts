import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { Entry, HabitDefinition, User, WorkoutData } from '@habitsapp/shared';

const app = createApp();

async function seedUserAndHabits() {
  const userRes = await request(app).post('/api/users').send({ name: 'Alice' });
  const user = userRes.body as User;

  const workoutRes = await request(app)
    .post('/api/habit-definitions')
    .send({ userId: user.id, name: 'Running', type: 'workout' });
  const writingRes = await request(app)
    .post('/api/habit-definitions')
    .send({ userId: user.id, name: 'Journal', type: 'writing' });
  const customRes = await request(app)
    .post('/api/habit-definitions')
    .send({ userId: user.id, name: 'Reading', type: 'custom', positive: true });

  return {
    user,
    workout: workoutRes.body as HabitDefinition,
    writing: writingRes.body as HabitDefinition,
    custom: customRes.body as HabitDefinition,
  };
}

async function logEntry(body: object) {
  const res = await request(app).post('/api/entries').send(body);
  return res;
}

describe('Entries API', () => {
  describe('POST /entries', () => {
    it('creates a workout entry with the expected payload', async () => {
      const { user, workout } = await seedUserAndHabits();

      const res = await logEntry({
        habitDefinitionId: workout.id,
        userId: user.id,
        date: '2026-05-09',
        data: { duration: 30, distance: 5.2, notes: 'Easy pace' },
      });

      expect(res.status).toBe(201);
      const entry = res.body as Entry;
      expect(entry.type).toBe('workout');
      expect(entry.data).toMatchObject({ duration: 30, distance: 5.2, notes: 'Easy pace' });
    });

    it('rejects a workout entry without duration', async () => {
      const { user, workout } = await seedUserAndHabits();
      const res = await logEntry({
        habitDefinitionId: workout.id,
        userId: user.id,
        date: '2026-05-09',
        data: {},
      });
      expect(res.status).toBe(400);
    });

    it('creates a writing entry', async () => {
      const { user, writing } = await seedUserAndHabits();
      const res = await logEntry({
        habitDefinitionId: writing.id,
        userId: user.id,
        date: '2026-05-09',
        data: { words: 500, time: 30 },
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ words: 500, time: 30 });
    });

    it('creates a custom entry with all-optional fields', async () => {
      const { user, custom } = await seedUserAndHabits();
      const res = await logEntry({
        habitDefinitionId: custom.id,
        userId: user.id,
        date: '2026-05-09',
        data: { number: 42, duration: 15 },
      });
      expect(res.status).toBe(201);
      expect(res.body.data.number).toBe(42);
      expect(res.body.data.duration).toBe(15);
    });

    it('returns 400 for an invalid date format', async () => {
      const { user, custom } = await seedUserAndHabits();
      const res = await logEntry({
        habitDefinitionId: custom.id,
        userId: user.id,
        date: '09/05/2026',
        data: {},
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown habit definition', async () => {
      const { user } = await seedUserAndHabits();
      const res = await logEntry({
        habitDefinitionId: 9999,
        userId: user.id,
        date: '2026-05-09',
        data: { duration: 30 },
      });
      expect(res.status).toBe(404);
    });

    it('returns 404 for an unknown user', async () => {
      const { workout } = await seedUserAndHabits();
      const res = await logEntry({
        habitDefinitionId: workout.id,
        userId: 9999,
        date: '2026-05-09',
        data: { duration: 30 },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /entries', () => {
    it('requires userId', async () => {
      const res = await request(app).get('/api/entries');
      expect(res.status).toBe(400);
    });

    it('returns entries newest-first by date then id', async () => {
      const { user, workout } = await seedUserAndHabits();
      await logEntry({ habitDefinitionId: workout.id, userId: user.id, date: '2026-05-07', data: { duration: 10 } });
      await logEntry({ habitDefinitionId: workout.id, userId: user.id, date: '2026-05-09', data: { duration: 20 } });
      await logEntry({ habitDefinitionId: workout.id, userId: user.id, date: '2026-05-09', data: { duration: 30 } });

      const res = await request(app).get(`/api/entries?userId=${user.id}`);
      expect(res.status).toBe(200);
      const items = res.body.items as Entry[];
      expect(items.map((e) => (e.data as WorkoutData).duration)).toEqual([30, 20, 10]);
    });

    it('filters by habitDefinitionId', async () => {
      const { user, workout, writing } = await seedUserAndHabits();
      await logEntry({ habitDefinitionId: workout.id, userId: user.id, date: '2026-05-09', data: { duration: 20 } });
      await logEntry({ habitDefinitionId: writing.id, userId: user.id, date: '2026-05-09', data: { words: 300 } });

      const res = await request(app).get(`/api/entries?userId=${user.id}&habitDefinitionId=${writing.id}`);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].type).toBe('writing');
    });

    it('paginates with a cursor', async () => {
      const { user, workout } = await seedUserAndHabits();
      for (let i = 1; i <= 5; i++) {
        await logEntry({
          habitDefinitionId: workout.id,
          userId: user.id,
          date: `2026-05-0${i}`,
          data: { duration: i },
        });
      }

      const first = await request(app).get(`/api/entries?userId=${user.id}&limit=2`);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toBeTruthy();
      expect(first.body.items[0].data.duration).toBe(5);
      expect(first.body.items[1].data.duration).toBe(4);

      const second = await request(app).get(
        `/api/entries?userId=${user.id}&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
      );
      expect(second.body.items).toHaveLength(2);
      expect(second.body.items[0].data.duration).toBe(3);
      expect(second.body.items[1].data.duration).toBe(2);
    });
  });

  describe('PUT /entries/:id', () => {
    it('updates the date and data of an entry', async () => {
      const { user, workout } = await seedUserAndHabits();
      const created = await logEntry({
        habitDefinitionId: workout.id,
        userId: user.id,
        date: '2026-05-09',
        data: { duration: 20 },
      });

      const res = await request(app)
        .put(`/api/entries/${created.body.id}`)
        .send({ date: '2026-05-08', data: { duration: 45, notes: 'Long run' } });

      expect(res.status).toBe(200);
      expect(res.body.date).toBe('2026-05-08');
      expect(res.body.data.duration).toBe(45);
      expect(res.body.data.notes).toBe('Long run');
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/api/entries/9999').send({ date: '2026-05-09' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /entries/:id', () => {
    it('deletes an entry and its child data', async () => {
      const { user, workout } = await seedUserAndHabits();
      const created = await logEntry({
        habitDefinitionId: workout.id,
        userId: user.id,
        date: '2026-05-09',
        data: { duration: 20 },
      });

      const res = await request(app).delete(`/api/entries/${created.body.id}`);
      expect(res.status).toBe(204);

      const list = await request(app).get(`/api/entries?userId=${user.id}`);
      expect(list.body.items).toEqual([]);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).delete('/api/entries/9999');
      expect(res.status).toBe(404);
    });
  });
});

describe('Idempotency Key (US-001)', () => {
  it('never duplicates an Entry when a create is pushed twice with the same key', async () => {
    const { user, workout } = await seedUserAndHabits();
    const body = {
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
      idempotencyKey: 'key-create-1',
    };

    const first = await logEntry(body);
    const second = await logEntry(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const list = await request(app).get(`/api/entries?userId=${user.id}`);
    expect(list.body.items).toHaveLength(1);
  });

  it('returns the recorded outcome, not the new payload, when the same key arrives with different data', async () => {
    const { user, workout } = await seedUserAndHabits();
    const first = await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
      idempotencyKey: 'key-create-2',
    });

    const second = await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-10',
      data: { duration: 99 },
      idempotencyKey: 'key-create-2',
    });

    expect(second.body).toEqual(first.body);

    const list = await request(app).get(`/api/entries?userId=${user.id}`);
    expect(list.body.items).toHaveLength(1);
    expect((list.body.items[0].data as WorkoutData).duration).toBe(20);
  });

  it('creates two separate Entries for the same Habit Definition and Date when pushed without a shared key', async () => {
    const { user, workout } = await seedUserAndHabits();
    const body = {
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    };

    await logEntry(body);
    await logEntry(body);

    const list = await request(app).get(`/api/entries?userId=${user.id}`);
    expect(list.body.items).toHaveLength(2);
  });

  it('still accepts and applies a create carrying no Idempotency Key (pre-upgrade backlog)', async () => {
    const { user, workout } = await seedUserAndHabits();
    const res = await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    });
    expect(res.status).toBe(201);
  });

  it('replays the original outcome for a retried update instead of re-applying it', async () => {
    const { user, workout } = await seedUserAndHabits();
    const created = await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    });

    const patch = { date: '2026-05-10', data: { duration: 45 }, idempotencyKey: 'key-update-1' };
    const first = await request(app).put(`/api/entries/${created.body.id}`).send(patch);
    const second = await request(app).put(`/api/entries/${created.body.id}`).send(patch);

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it('settles a retried delete without a 404 when the same key arrives again', async () => {
    const { user, workout } = await seedUserAndHabits();
    const created = await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    });

    const first = await request(app)
      .delete(`/api/entries/${created.body.id}`)
      .send({ idempotencyKey: 'key-delete-1' });
    const second = await request(app)
      .delete(`/api/entries/${created.body.id}`)
      .send({ idempotencyKey: 'key-delete-1' });

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });

  it('still 404s a delete for an unknown id when no Idempotency Key has ever been recorded', async () => {
    const res = await request(app).delete('/api/entries/9999').send({ idempotencyKey: 'never-seen' });
    expect(res.status).toBe(404);
  });
});

describe('Habit definition entry-protection (now wired)', () => {
  beforeEach(() => {});

  it('blocks deletion of a definition that has entries with 409', async () => {
    const { user, workout } = await seedUserAndHabits();
    await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    });

    const res = await request(app).delete(`/api/habit-definitions/${workout.id}`);
    expect(res.status).toBe(409);
  });

  it('blocks type change on a definition that has entries with 409', async () => {
    const { user, workout } = await seedUserAndHabits();
    await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    });

    const res = await request(app).put(`/api/habit-definitions/${workout.id}`).send({ type: 'custom' });
    expect(res.status).toBe(409);
  });

  it('reports hasEntries on GET /habit-definitions for definitions with entries', async () => {
    const { user, workout, writing } = await seedUserAndHabits();
    await logEntry({
      habitDefinitionId: workout.id,
      userId: user.id,
      date: '2026-05-09',
      data: { duration: 20 },
    });

    const res = await request(app).get(`/api/habit-definitions?userId=${user.id}`);
    expect(res.status).toBe(200);
    const list = res.body as HabitDefinition[];
    const workoutDef = list.find((d) => d.id === workout.id);
    const writingDef = list.find((d) => d.id === writing.id);
    expect(workoutDef?.hasEntries).toBe(true);
    expect(writingDef?.hasEntries).toBe(false);
  });
});
