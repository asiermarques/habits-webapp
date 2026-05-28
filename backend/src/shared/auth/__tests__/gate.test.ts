import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import type { GateStatus } from '@habitsapp/shared';

const PASSWORD = 'open-sesame';
const SECRET = 'test-signing-secret';
const COOKIE_NAME = 'habits_gate';

// createApp() reads the gate env vars at construction time, so each test sets
// them, builds its own app, and restores the environment afterwards.
const savedEnv: Record<string, string | undefined> = {};
function setEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const key of Object.keys(savedEnv)) delete savedEnv[key];
});

function gatedApp() {
  setEnv('GATE_PASSWORD', PASSWORD);
  setEnv('SESSION_SECRET', SECRET);
  return createApp();
}

describe('Instance password gate', () => {
  it('blocks unauthenticated requests to data endpoints when the gate is enabled', async () => {
    const res = await request(gatedApp()).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('leaves the health check open when the gate is enabled', async () => {
    const res = await request(gatedApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('reports gated and unauthenticated via the status endpoint', async () => {
    const res = await request(gatedApp()).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body as GateStatus).toEqual({ gated: true, authenticated: false });
  });

  it('rejects an incorrect password and sets no session', async () => {
    const res = await request(gatedApp()).post('/api/auth/login').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('accepts the correct password and unlocks subsequent API access', async () => {
    const agent = request.agent(gatedApp());

    const login = await agent.post('/api/auth/login').send({ password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();

    const users = await agent.get('/api/users');
    expect(users.status).toBe(200);

    const status = await agent.get('/api/auth/status');
    expect(status.body as GateStatus).toEqual({ gated: true, authenticated: true });
  });

  it('rejects a malformed session cookie', async () => {
    const res = await request(gatedApp())
      .get('/api/users')
      .set('Cookie', `${COOKIE_NAME}=not-a-valid-token`);
    expect(res.status).toBe(401);
  });

  it('rejects a cookie with a tampered signature', async () => {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60_000 })).toString('base64url');
    const res = await request(gatedApp())
      .get('/api/users')
      .set('Cookie', `${COOKIE_NAME}=${payload}.tamperedsignature`);
    expect(res.status).toBe(401);
  });

  it('serves the app fully open when no gate password is configured', async () => {
    setEnv('GATE_PASSWORD', undefined);
    setEnv('SESSION_SECRET', undefined);
    const app = createApp();

    const users = await request(app).get('/api/users');
    expect(users.status).toBe(200);

    const status = await request(app).get('/api/auth/status');
    expect(status.body as GateStatus).toEqual({ gated: false, authenticated: true });
  });

  it('refuses to start gated without a session secret', () => {
    setEnv('GATE_PASSWORD', PASSWORD);
    setEnv('SESSION_SECRET', undefined);
    expect(() => createApp()).toThrow(/SESSION_SECRET/);
  });
});
