import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { DataVersionResponse, Entry, HabitDefinition, User } from '@habitsapp/shared';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/api/users').send({ name });
  expect(res.status).toBe(201);
  return res.body as User;
}

async function createHabit(userId: number, name: string): Promise<HabitDefinition> {
  const res = await request(app)
    .post('/api/habit-definitions')
    .send({ userId, name, type: 'custom' });
  expect(res.status).toBe(201);
  return res.body as HabitDefinition;
}

async function version(userId: number): Promise<string> {
  const res = await request(app).get('/api/sync/version').query({ userId });
  expect(res.status).toBe(200);
  return (res.body as DataVersionResponse).version;
}

describe('Sync version API', () => {
  it('returns a version for a user with no data yet', async () => {
    const user = await createUser('Ada');
    expect(typeof (await version(user.id))).toBe('string');
  });

  it('requires a userId', async () => {
    const res = await request(app).get('/api/sync/version');
    expect(res.status).toBe(400);
  });

  it('is unchanged when nothing has been written', async () => {
    const user = await createUser('Ada');
    expect(await version(user.id)).toBe(await version(user.id));
  });

  it('changes when an entry is created', async () => {
    const user = await createUser('Ada');
    const habit = await createHabit(user.id, 'Reading');
    const before = await version(user.id);

    await request(app)
      .post('/api/entries')
      .send({ userId: user.id, habitDefinitionId: habit.id, date: '2026-05-06', data: {} })
      .expect(201);

    expect(await version(user.id)).not.toBe(before);
  });

  it('changes when an entry is edited', async () => {
    const user = await createUser('Ada');
    const habit = await createHabit(user.id, 'Reading');
    const created = await request(app)
      .post('/api/entries')
      .send({ userId: user.id, habitDefinitionId: habit.id, date: '2026-05-06', data: {} });
    const entry = created.body as Entry;
    const before = await version(user.id);

    await request(app).put(`/api/entries/${entry.id}`).send({ date: '2026-05-07' }).expect(200);

    expect(await version(user.id)).not.toBe(before);
  });

  // The case a max(created_at) token would miss: nothing is left behind to
  // read, so only a counter bumped by the delete itself can report it.
  it('changes when an entry is deleted', async () => {
    const user = await createUser('Ada');
    const habit = await createHabit(user.id, 'Reading');
    const created = await request(app)
      .post('/api/entries')
      .send({ userId: user.id, habitDefinitionId: habit.id, date: '2026-05-06', data: {} });
    const before = await version(user.id);

    await request(app).delete(`/api/entries/${(created.body as Entry).id}`).expect(204);

    expect(await version(user.id)).not.toBe(before);
  });

  it('changes when a habit definition is created', async () => {
    const user = await createUser('Ada');
    const before = await version(user.id);

    await createHabit(user.id, 'Reading');

    expect(await version(user.id)).not.toBe(before);
  });

  it('changes for every user when the instance settings change', async () => {
    const user = await createUser('Ada');
    const before = await version(user.id);

    await request(app).put('/api/settings/currency').send({ currency: 'USD' }).expect(200);

    expect(await version(user.id)).not.toBe(before);
  });

  it('changes for every user when the user list changes', async () => {
    const ada = await createUser('Ada');
    const before = await version(ada.id);

    await createUser('Grace');

    expect(await version(ada.id)).not.toBe(before);
  });

  // The whole point of the per-user scope: on a shared instance, one person
  // logging must not make everyone else's devices refetch.
  it("is unchanged for one user when another user's entry is created", async () => {
    const ada = await createUser('Ada');
    const grace = await createUser('Grace');
    const habit = await createHabit(grace.id, 'Running');
    const before = await version(ada.id);

    await request(app)
      .post('/api/entries')
      .send({ userId: grace.id, habitDefinitionId: habit.id, date: '2026-05-06', data: {} })
      .expect(201);

    expect(await version(ada.id)).toBe(before);
  });

  // A replayed push applies nothing, so it must announce nothing — otherwise
  // an offline drain retrying its backlog would make every device refetch.
  it('is unchanged when a create is replayed under the same idempotency key', async () => {
    const user = await createUser('Ada');
    const habit = await createHabit(user.id, 'Reading');
    const body = {
      userId: user.id,
      habitDefinitionId: habit.id,
      date: '2026-05-06',
      data: {},
      idempotencyKey: 'key-1',
    };
    await request(app).post('/api/entries').send(body).expect(201);
    const after = await version(user.id);

    await request(app).post('/api/entries').send(body);

    expect(await version(user.id)).toBe(after);
  });

  // A PUT that patches nothing writes nothing.
  it('is unchanged by a no-op user update', async () => {
    const user = await createUser('Ada');
    const before = await version(user.id);

    await request(app).put(`/api/users/${user.id}`).send({}).expect(200);

    expect(await version(user.id)).toBe(before);
  });
});
