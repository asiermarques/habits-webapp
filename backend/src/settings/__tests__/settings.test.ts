import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { AppSettings } from '@habitsapp/shared';

const app = createApp();

describe('Settings API', () => {
  it('GET /settings returns the default currency (EUR)', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect((res.body as AppSettings).currency).toBe('EUR');
  });

  it('PUT /settings/currency updates the currency', async () => {
    const put = await request(app).put('/settings/currency').send({ currency: 'USD' });
    expect(put.status).toBe(200);
    expect((put.body as AppSettings).currency).toBe('USD');

    const get = await request(app).get('/settings');
    expect((get.body as AppSettings).currency).toBe('USD');
  });

  it('PUT /settings/currency rejects unsupported codes', async () => {
    const res = await request(app).put('/settings/currency').send({ currency: 'XYZ' });
    expect(res.status).toBe(400);
  });

  it('PUT /settings/currency rejects missing body', async () => {
    const res = await request(app).put('/settings/currency').send({});
    expect(res.status).toBe(400);
  });

  it('GET /settings returns the default locale (en)', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect((res.body as AppSettings).locale).toBe('en');
  });

  it('PUT /settings/locale updates the locale', async () => {
    const put = await request(app).put('/settings/locale').send({ locale: 'es' });
    expect(put.status).toBe(200);
    expect((put.body as AppSettings).locale).toBe('es');

    const get = await request(app).get('/settings');
    expect((get.body as AppSettings).locale).toBe('es');
  });

  it('PUT /settings/locale rejects unsupported codes', async () => {
    const res = await request(app).put('/settings/locale').send({ locale: 'fr' });
    expect(res.status).toBe(400);
  });

  it('PUT /settings/locale rejects missing body', async () => {
    const res = await request(app).put('/settings/locale').send({});
    expect(res.status).toBe(400);
  });
});
