import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Unknown API routes', () => {
  const app = createApp();

  it('returns 404 with a JSON error for an unknown /api path', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 404 for an unknown method on a known resource', async () => {
    const res = await request(app).delete('/api/metrics');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});
