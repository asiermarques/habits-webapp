import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { seedHabitDefinitionsForUser } from '../seed.js';
import { POSITIVE_COLORS, NEGATIVE_COLOR } from '../domain/Color.js';
import type { HabitDefinition, User } from '@habitsapp/shared';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/users').send({ name });
  return res.body as User;
}

async function createHabit(
  userId: number,
  body: { name: string; type: string; positive?: boolean },
): Promise<HabitDefinition> {
  const res = await request(app).post('/habit-definitions').send({ userId, ...body });
  return res.body as HabitDefinition;
}

describe('Habit Definitions API', () => {
  describe('GET /habit-definitions', () => {
    it('rejects without userId', async () => {
      const res = await request(app).get('/habit-definitions');
      expect(res.status).toBe(400);
    });

    it('returns an empty list initially for a user', async () => {
      const user = await createUser('Alice');
      const res = await request(app).get(`/habit-definitions?userId=${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('scopes habits to the requested user', async () => {
      const alice = await createUser('Alice');
      const bob = await createUser('Bob');
      await createHabit(alice.id, { name: 'Running', type: 'workout' });
      await createHabit(bob.id, { name: 'Reading', type: 'custom' });

      const aliceList = (await request(app).get(`/habit-definitions?userId=${alice.id}`))
        .body as HabitDefinition[];
      const bobList = (await request(app).get(`/habit-definitions?userId=${bob.id}`))
        .body as HabitDefinition[];

      expect(aliceList.map((h) => h.name)).toEqual(['Running']);
      expect(bobList.map((h) => h.name)).toEqual(['Reading']);
    });
  });

  describe('POST /habit-definitions', () => {
    it('rejects without userId', async () => {
      const res = await request(app)
        .post('/habit-definitions')
        .send({ name: 'Running', type: 'workout' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when userId does not exist', async () => {
      const res = await request(app)
        .post('/habit-definitions')
        .send({ userId: 9999, name: 'Running', type: 'workout' });
      expect(res.status).toBe(404);
    });

    it('creates a workout habit forced to positive=true', async () => {
      const user = await createUser('Alice');
      const res = await request(app)
        .post('/habit-definitions')
        .send({ userId: user.id, name: 'Running', type: 'workout', positive: false });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe(user.id);
      expect(res.body.type).toBe('workout');
      expect(res.body.positive).toBe(true);
      expect(res.body.color).toBe(POSITIVE_COLORS[0]);
    });

    it('creates a writing habit always positive', async () => {
      const user = await createUser('Alice');
      const res = await createHabit(user.id, { name: 'Journal', type: 'writing' });
      expect(res.positive).toBe(true);
    });

    it('creates a custom habit honoring the positive flag', async () => {
      const user = await createUser('Alice');
      const positive = await createHabit(user.id, { name: 'Reading', type: 'custom', positive: true });
      const negative = await createHabit(user.id, { name: 'Junk food', type: 'custom', positive: false });

      expect(positive.positive).toBe(true);
      expect(positive.color).toBe(POSITIVE_COLORS[0]);
      expect(negative.positive).toBe(false);
      expect(negative.color).toBe(NEGATIVE_COLOR);
    });

    it('rotates positive colors per user (negatives never consume the palette)', async () => {
      const user = await createUser('Alice');
      const a = await createHabit(user.id, { name: 'A', type: 'custom', positive: true });
      await createHabit(user.id, { name: 'Bad', type: 'custom', positive: false });
      const c = await createHabit(user.id, { name: 'C', type: 'custom', positive: true });

      expect(a.color).toBe(POSITIVE_COLORS[0]);
      expect(c.color).toBe(POSITIVE_COLORS[1]);
    });

    it('rotates colors independently for each user', async () => {
      const alice = await createUser('Alice');
      const bob = await createUser('Bob');

      const a = await createHabit(alice.id, { name: 'A', type: 'custom', positive: true });
      const b = await createHabit(bob.id, { name: 'B', type: 'custom', positive: true });

      expect(a.color).toBe(POSITIVE_COLORS[0]);
      expect(b.color).toBe(POSITIVE_COLORS[0]);
    });

    it('rejects empty names', async () => {
      const user = await createUser('Alice');
      const r = await request(app)
        .post('/habit-definitions')
        .send({ userId: user.id, name: '   ', type: 'custom' });
      expect(r.status).toBe(400);
    });

    it('rejects unknown types', async () => {
      const user = await createUser('Alice');
      const r = await request(app)
        .post('/habit-definitions')
        .send({ userId: user.id, name: 'X', type: 'cardio' });
      expect(r.status).toBe(400);
    });

    it('rejects names longer than 100 characters', async () => {
      const user = await createUser('Alice');
      const r = await request(app)
        .post('/habit-definitions')
        .send({ userId: user.id, name: 'a'.repeat(101), type: 'custom' });
      expect(r.status).toBe(400);
    });
  });

  describe('PUT /habit-definitions/:id', () => {
    it('updates the name', async () => {
      const user = await createUser('Alice');
      const habit = await createHabit(user.id, { name: 'Reading', type: 'custom' });
      const res = await request(app).put(`/habit-definitions/${habit.id}`).send({ name: 'Books' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Books');
    });

    it('toggles positive on a custom habit (no entries yet, so type changes are allowed)', async () => {
      const user = await createUser('Alice');
      const habit = await createHabit(user.id, { name: 'Reading', type: 'custom', positive: true });
      const res = await request(app).put(`/habit-definitions/${habit.id}`).send({ positive: false });
      expect(res.body.positive).toBe(false);
    });

    it('forces positive back to true when changing type to workout/writing', async () => {
      const user = await createUser('Alice');
      const habit = await createHabit(user.id, { name: 'Reading', type: 'custom', positive: false });
      const res = await request(app).put(`/habit-definitions/${habit.id}`).send({ type: 'workout' });
      expect(res.body.type).toBe('workout');
      expect(res.body.positive).toBe(true);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/habit-definitions/9999').send({ name: 'Ghost' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /habit-definitions/:id', () => {
    it('deletes a habit definition', async () => {
      const user = await createUser('Alice');
      const habit = await createHabit(user.id, { name: 'Reading', type: 'custom' });
      const res = await request(app).delete(`/habit-definitions/${habit.id}`);
      expect(res.status).toBe(204);

      const list = await request(app).get(`/habit-definitions?userId=${user.id}`);
      expect(list.body).toEqual([]);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).delete('/habit-definitions/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('seed', () => {
    it('seeds the eight example habits for a user', async () => {
      const user = await createUser('Alice');
      seedHabitDefinitionsForUser(user.id);
      const res = await request(app).get(`/habit-definitions?userId=${user.id}`);

      const names = res.body.map((h: HabitDefinition) => h.name);
      expect(names).toEqual([
        'Running',
        'Rowing',
        'Writing',
        'Reading',
        'Meat consuming',
        'Fast food consuming',
        'Cooking',
        'Social interactions',
      ]);

      const meat = res.body.find((h: HabitDefinition) => h.name === 'Meat consuming');
      expect(meat.positive).toBe(false);
      expect(meat.color).toBe(NEGATIVE_COLOR);
    });

    it('seeds only the requested user', async () => {
      const alice = await createUser('Alice');
      const bob = await createUser('Bob');
      seedHabitDefinitionsForUser(alice.id);

      const aliceList = (await request(app).get(`/habit-definitions?userId=${alice.id}`))
        .body as HabitDefinition[];
      const bobList = (await request(app).get(`/habit-definitions?userId=${bob.id}`))
        .body as HabitDefinition[];

      expect(aliceList).toHaveLength(8);
      expect(bobList).toHaveLength(0);
    });
  });
});
