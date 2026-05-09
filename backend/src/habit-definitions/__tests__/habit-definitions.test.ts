import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { seedHabitDefinitions } from '../seed.js';
import { POSITIVE_COLORS, NEGATIVE_COLOR } from '../colors.js';
import type { HabitDefinition } from '@habitsapp/shared';

const app = createApp();

async function createHabit(body: { name: string; type: string; positive?: boolean }): Promise<HabitDefinition> {
  const res = await request(app).post('/habit-definitions').send(body);
  return res.body as HabitDefinition;
}

describe('Habit Definitions API', () => {
  describe('GET /habit-definitions', () => {
    it('returns an empty list initially', async () => {
      const res = await request(app).get('/habit-definitions');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /habit-definitions', () => {
    it('creates a workout habit forced to positive=true', async () => {
      const res = await request(app)
        .post('/habit-definitions')
        .send({ name: 'Running', type: 'workout', positive: false });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('workout');
      expect(res.body.positive).toBe(true);
      expect(res.body.color).toBe(POSITIVE_COLORS[0]);
    });

    it('creates a writing habit always positive', async () => {
      const res = await createHabit({ name: 'Journal', type: 'writing' });
      expect(res.positive).toBe(true);
    });

    it('creates a custom habit honoring the positive flag', async () => {
      const positive = await createHabit({ name: 'Reading', type: 'custom', positive: true });
      const negative = await createHabit({ name: 'Junk food', type: 'custom', positive: false });

      expect(positive.positive).toBe(true);
      expect(positive.color).toBe(POSITIVE_COLORS[0]);
      expect(negative.positive).toBe(false);
      expect(negative.color).toBe(NEGATIVE_COLOR);
    });

    it('rotates positive colors per insertion (negatives never consume the palette)', async () => {
      const a = await createHabit({ name: 'A', type: 'custom', positive: true });
      await createHabit({ name: 'Bad', type: 'custom', positive: false });
      const c = await createHabit({ name: 'C', type: 'custom', positive: true });

      expect(a.color).toBe(POSITIVE_COLORS[0]);
      expect(c.color).toBe(POSITIVE_COLORS[1]);
    });

    it('rejects empty names', async () => {
      const r = await request(app).post('/habit-definitions').send({ name: '   ', type: 'custom' });
      expect(r.status).toBe(400);
    });

    it('rejects unknown types', async () => {
      const r = await request(app).post('/habit-definitions').send({ name: 'X', type: 'cardio' });
      expect(r.status).toBe(400);
    });
  });

  describe('PUT /habit-definitions/:id', () => {
    it('updates the name', async () => {
      const habit = await createHabit({ name: 'Reading', type: 'custom' });
      const res = await request(app).put(`/habit-definitions/${habit.id}`).send({ name: 'Books' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Books');
    });

    it('toggles positive on a custom habit (no entries yet, so type changes are allowed)', async () => {
      const habit = await createHabit({ name: 'Reading', type: 'custom', positive: true });
      const res = await request(app).put(`/habit-definitions/${habit.id}`).send({ positive: false });
      expect(res.body.positive).toBe(false);
    });

    it('forces positive back to true when changing type to workout/writing', async () => {
      const habit = await createHabit({ name: 'Reading', type: 'custom', positive: false });
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
      const habit = await createHabit({ name: 'Reading', type: 'custom' });
      const res = await request(app).delete(`/habit-definitions/${habit.id}`);
      expect(res.status).toBe(204);

      const list = await request(app).get('/habit-definitions');
      expect(list.body).toEqual([]);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).delete('/habit-definitions/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('seed', () => {
    it('seeds the eight example habits when the table is empty', async () => {
      seedHabitDefinitions();
      const res = await request(app).get('/habit-definitions');

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

    it('does not re-seed when habits already exist', async () => {
      await createHabit({ name: 'Pre-existing', type: 'custom' });
      seedHabitDefinitions();
      const res = await request(app).get('/habit-definitions');
      expect(res.body).toHaveLength(1);
    });
  });
});
