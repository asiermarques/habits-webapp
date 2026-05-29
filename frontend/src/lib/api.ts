const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Thrown when the request never reached the server — the device is offline or
// the connection failed. Distinct from ApiError (which carries an HTTP status)
// so the global error handler can show an offline-aware message and callers can
// tell "the server said no" apart from "we never got there". See US-004: a
// mutation attempted offline must fail clearly, never look saved.
export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  // All backend endpoints are mounted under /api (see backend/src/app.ts).
  // Feature hooks pass bare paths like '/entries'; the prefix is added here.
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...rest,
      // Send/receive the session cookie cross-origin (Vite :5173 → API :3001).
      // Without this the gate's Set-Cookie is dropped and /auth/status stays unauthenticated.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch rejects with a TypeError on a network-level failure (offline, DNS,
    // connection refused). There's no response or body to recover — surface a
    // distinct OfflineError so the failure reads as "you're offline", not a
    // generic crash, and no mutation is left implying success.
    throw new OfflineError();
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      // body wasn't JSON; keep the default message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
