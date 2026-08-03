import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { checkDataVersion, forgetDataVersion } from '../dataVersion';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function versionFetch(...versions: string[]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const version = versions[Math.min(i, versions.length - 1)];
    i += 1;
    return Promise.resolve(jsonResponse({ version }));
  });
}

function makeClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());
  return { qc, invalidate };
}

describe('checkDataVersion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    forgetDataVersion();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  it('does not invalidate on the first check, which only records a baseline', async () => {
    vi.stubGlobal('fetch', versionFetch('1.0'));
    const { qc, invalidate } = makeClient();

    await checkDataVersion(qc, 1);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does not invalidate while the version is unchanged', async () => {
    vi.stubGlobal('fetch', versionFetch('1.0', '1.0'));
    const { qc, invalidate } = makeClient();

    await checkDataVersion(qc, 1);
    await checkDataVersion(qc, 1);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates every versioned read once the version moves', async () => {
    vi.stubGlobal('fetch', versionFetch('1.0', '1.1'));
    const { qc, invalidate } = makeClient();

    await checkDataVersion(qc, 1);
    await checkDataVersion(qc, 1);

    const roots = invalidate.mock.calls.map((c) => (c[0]?.queryKey as string[])[0]);
    expect(roots).toEqual(['users', 'settings', 'habit-definitions', 'entries', 'metrics']);
  });

  // The gate isn't data: re-checking it here would add a request to every
  // foreground, and login/logout/401 already invalidate it.
  it('never invalidates the gate status', async () => {
    vi.stubGlobal('fetch', versionFetch('1.0', '1.1'));
    const { qc, invalidate } = makeClient();

    await checkDataVersion(qc, 1);
    await checkDataVersion(qc, 1);

    const roots = invalidate.mock.calls.map((c) => (c[0]?.queryKey as string[])[0]);
    expect(roots).not.toContain('gate');
  });

  it('sends the active user so the token is scoped to their data', async () => {
    const fetchMock = versionFetch('1.0');
    vi.stubGlobal('fetch', fetchMock);
    const { qc } = makeClient();

    await checkDataVersion(qc, 7);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/sync/version?userId=7');
  });

  it('treats a different user as a fresh baseline rather than a change', async () => {
    vi.stubGlobal('fetch', versionFetch('1.0', '5.9'));
    const { qc, invalidate } = makeClient();

    await checkDataVersion(qc, 1);
    await checkDataVersion(qc, 2);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('makes no request while the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchMock = versionFetch('1.0');
    vi.stubGlobal('fetch', fetchMock);
    const { qc } = makeClient();

    await checkDataVersion(qc, 1);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes no request before a user is selected', async () => {
    const fetchMock = versionFetch('1.0');
    vi.stubGlobal('fetch', fetchMock);
    const { qc } = makeClient();

    await checkDataVersion(qc, 0);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A background signal must never surface an error to the user, and must not
  // poison the baseline — the next check compares against the last good token.
  it('stays silent when the check fails and keeps the previous baseline', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ version: '1.0' }))
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(jsonResponse({ version: '1.0' }));
    vi.stubGlobal('fetch', fetchMock);
    const { qc, invalidate } = makeClient();

    await checkDataVersion(qc, 1);
    await expect(checkDataVersion(qc, 1)).resolves.toBeUndefined();
    await checkDataVersion(qc, 1);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
