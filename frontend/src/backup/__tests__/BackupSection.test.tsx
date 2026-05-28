import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BackupBundle } from '@habitsapp/shared';
import { BackupSection } from '../BackupSection';
import { apiFetch } from '@/lib/api';
import { TestProviders } from '@/test/test-utils';

// Mock at the module boundary (per test conventions) so we can assert the
// import call without touching TanStack Query internals.
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === '/users') return [{ id: 1, name: 'Alice', isDefault: true, createdAt: 'now' }];
    if (path === '/backup/import')
      return { habitsCreated: 1, habitsSkipped: 0, entriesCreated: 2, entriesSkipped: 0 };
    return {};
  }),
  ApiError: class ApiError extends Error {},
}));

const apiFetchMock = vi.mocked(apiFetch);

const bundle: BackupBundle = {
  version: 1,
  exportedAt: '2026-05-28',
  habitDefinitions: [{ name: 'Run', type: 'workout', positive: true, color: '#3b82f6' }],
  entries: [
    { habitName: 'Run', date: '2026-05-20', data: { duration: 30 } },
    { habitName: 'Run', date: '2026-05-21', data: { duration: 40 } },
  ],
};

describe('BackupSection', () => {
  beforeEach(() => {
    apiFetchMock.mockClear();
    localStorage.clear();
  });

  it('starts collapsed and reveals export and import actions when expanded', async () => {
    render(
      <TestProviders>
        <BackupSection />
      </TestProviders>,
    );

    const toggle = await screen.findByRole('button', { name: 'Backup & restore' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.setup().click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /export backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import backup/i })).toBeInTheDocument();
  });

  it('posts the parsed bundle and active user id when a backup file is chosen', async () => {
    const { container } = render(
      <TestProviders>
        <BackupSection />
      </TestProviders>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Backup & restore' }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const json = JSON.stringify(bundle);
    const file = new File([json], 'backup.json', { type: 'application/json' });
    // jsdom doesn't implement Blob.prototype.text(); provide it for the component.
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(json) });
    await user.upload(fileInput, file);

    await vi.waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/backup/import', {
        method: 'POST',
        body: { ...bundle, userId: 1 },
      }),
    );
  });
});
