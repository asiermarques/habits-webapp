import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { User } from '@habitsapp/shared';

const app = createApp();

async function createUser(name: string): Promise<User> {
  const res = await request(app).post('/users').send({ name });
  return res.body as User;
}

describe('Users API', () => {
  describe('GET /users', () => {
    it('returns an empty array when no users exist', async () => {
      const res = await request(app).get('/users');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns the list of users sorted by id', async () => {
      await createUser('Alice');
      await createUser('Bob');

      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alice');
      expect(res.body[1].name).toBe('Bob');
    });
  });

  describe('POST /users', () => {
    it('creates a user and marks the first one as default', async () => {
      const res = await request(app).post('/users').send({ name: 'Alice' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Alice');
      expect(res.body.isDefault).toBe(true);
    });

    it('does not mark subsequent users as default', async () => {
      await createUser('Alice');
      const res = await request(app).post('/users').send({ name: 'Bob' });
      expect(res.body.isDefault).toBe(false);
    });

    it('rejects empty or missing names', async () => {
      const r1 = await request(app).post('/users').send({});
      const r2 = await request(app).post('/users').send({ name: '   ' });
      expect(r1.status).toBe(400);
      expect(r2.status).toBe(400);
    });

    it('rejects names longer than 100 characters', async () => {
      const res = await request(app).post('/users').send({ name: 'a'.repeat(101) });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('updates the user name', async () => {
      const alice = await createUser('Alice');
      const res = await request(app)
        .put(`/users/${alice.id}`)
        .send({ name: 'Alicia' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alicia');
    });

    it('setting isDefault=true unsets the previous default', async () => {
      const alice = await createUser('Alice');
      const bob = await createUser('Bob');

      const res = await request(app)
        .put(`/users/${bob.id}`)
        .send({ isDefault: true });

      expect(res.status).toBe(200);
      expect(res.body.isDefault).toBe(true);

      const list = await request(app).get('/users');
      const updatedAlice = list.body.find((u: User) => u.id === alice.id);
      expect(updatedAlice.isDefault).toBe(false);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/users/9999').send({ name: 'Ghost' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes the user and returns 204 when more than one exists', async () => {
      const alice = await createUser('Alice');
      await createUser('Bob');

      const res = await request(app).delete(`/users/${alice.id}`);
      expect(res.status).toBe(204);

      const list = await request(app).get('/users');
      expect(list.body).toHaveLength(1);
      expect(list.body[0].name).toBe('Bob');
    });

    it('promotes another user to default if the deleted one was default', async () => {
      const alice = await createUser('Alice');
      const bob = await createUser('Bob');

      await request(app).delete(`/users/${alice.id}`);
      const list = await request(app).get('/users');
      const onlyUser = list.body.find((u: User) => u.id === bob.id);
      expect(onlyUser.isDefault).toBe(true);
    });

    it('refuses to delete the only remaining user with 409', async () => {
      const alice = await createUser('Alice');
      const res = await request(app).delete(`/users/${alice.id}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/only user/);

      const list = await request(app).get('/users');
      expect(list.body).toHaveLength(1);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).delete('/users/9999');
      expect(res.status).toBe(404);
    });
  });
});
