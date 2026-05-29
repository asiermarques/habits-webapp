import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

// Drives the mocked service-worker registration hook per test.
const state = {
  needRefresh: false,
  updateServiceWorker: vi.fn(),
};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [state.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: state.updateServiceWorker,
  }),
}));

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

// Imported after the mocks are registered.
import { PwaUpdatePrompt } from '../PwaUpdatePrompt';

beforeEach(() => {
  state.needRefresh = false;
  state.updateServiceWorker = vi.fn();
  vi.mocked(toast).mockReset();
});

describe('PwaUpdatePrompt', () => {
  it('shows no toast while no new version is waiting', () => {
    render(<PwaUpdatePrompt />);
    expect(toast).not.toHaveBeenCalled();
  });

  it('prompts to refresh when a new version is waiting and applies the update on click', () => {
    state.needRefresh = true;
    render(<PwaUpdatePrompt />);

    expect(toast).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast).mock.calls[0];
    expect(message).toBe(t('pwa.updateAvailable'));
    expect(options?.action).toMatchObject({ label: t('pwa.refresh') });

    // Activating the action reloads onto the new service worker.
    const action = options?.action as { onClick: (e?: unknown) => void };
    action.onClick();
    expect(state.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
