import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { GateLoginResponse, GateStatus } from '@habitsapp/shared';
import { validateBody } from '../middleware/validate.js';

const COOKIE_NAME = 'habits_gate';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // ~24h (ASM-001)

export type GateConfig = {
  /** Shared instance password. When undefined the gate is disabled (fail-open). */
  password: string | undefined;
  /** HMAC signing secret for the session cookie. Required when `password` is set. */
  secret: string | undefined;
  /** Marks the cookie `Secure` (production over HTTPS). */
  secure: boolean;
};

export function readGateConfig(): GateConfig {
  return {
    password: process.env.GATE_PASSWORD || undefined,
    secret: process.env.SESSION_SECRET || undefined,
    secure: process.env.NODE_ENV === 'production',
  };
}

/**
 * Guards against an instance that is gated but has no signing secret — without
 * it sessions couldn't be verified and a forged cookie might be trusted.
 * Throws so the process refuses to boot in that state (EDGE-001).
 */
export function assertGateConfig(config: GateConfig): void {
  if (config.password && !config.secret) {
    throw new Error(
      'GATE_PASSWORD is set but SESSION_SECRET is missing — refusing to start with an unsigned gate.',
    );
  }
}

// --- session token: base64url(payload) + "." + base64url(HMAC-SHA256) --------

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function issueToken(secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function verifyToken(token: string, secret: string, now = Date.now()): boolean {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number };
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

/** Constant-time password comparison via fixed-length digests (no length leak). */
function passwordMatches(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function isAuthenticated(req: Request, config: GateConfig): boolean {
  if (!config.password) return true; // fail-open: no gate configured
  if (!config.secret) return false;
  const token = readCookie(req, COOKIE_NAME);
  return token !== undefined && verifyToken(token, config.secret);
}

/**
 * Rejects requests without a valid session when the gate is enabled. Mount this
 * on the `/api` router group *after* the open auth router so `/api/auth/*`
 * stays reachable while locked. `/health` lives at the root and is never gated.
 */
export function createGateMiddleware(config: GateConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isAuthenticated(req, config)) return next();
    res.status(401).json({ error: 'Authentication required' });
  };
}

const loginSchema = z.object({ password: z.string() });

/** Open auth endpoints used to unlock the instance — never behind the gate. */
export function createAuthRouter(config: GateConfig): Router {
  const router = Router();

  router.get('/status', (req, res) => {
    const body: GateStatus = {
      gated: Boolean(config.password),
      authenticated: isAuthenticated(req, config),
    };
    res.json(body);
  });

  router.post('/login', (req, res) => {
    const { password } = validateBody(req, loginSchema);

    if (!config.password) {
      const body: GateLoginResponse = { authenticated: true };
      res.json(body);
      return;
    }
    if (!config.secret || !passwordMatches(password, config.password)) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    res.cookie(COOKIE_NAME, issueToken(config.secret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secure,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    const body: GateLoginResponse = { authenticated: true };
    res.json(body);
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    const body: GateLoginResponse = { authenticated: false };
    res.json(body);
  });

  return router;
}
