import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@/lib/i18n';

// Drives the mocked platform-detection helpers per test.
const state = { standalone: false, iosSafari: false, dismissed: false };

vi.mock('../install', () => ({
  isStandalone: () => state.standalone,
  isIosSafari: () => state.iosSafari,
  wasInstallDismissed: () => state.dismissed,
  rememberInstallDismissed: vi.fn(),
}));

import { InstallPrompt } from '../InstallPrompt';
import { rememberInstallDismissed } from '../install';

type FakeInstallEvent = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as FakeInstallEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  state.standalone = false;
  state.iosSafari = false;
  state.dismissed = false;
  vi.mocked(rememberInstallDismissed).mockReset();
});

describe('InstallPrompt', () => {
  it('shows nothing until the browser signals installability', () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the native install flow once beforeinstallprompt fires', async () => {
    render(<InstallPrompt />);
    const event = fireBeforeInstallPrompt();

    const installButton = await screen.findByRole('button', { name: t('pwa.install.action') });
    await userEvent.click(installButton);

    expect(event.prompt).toHaveBeenCalledOnce();
  });

  it('shows manual Add-to-Home-Screen guidance on iOS Safari instead of an install button', () => {
    state.iosSafari = true;
    render(<InstallPrompt />);

    expect(screen.getByText(t('pwa.install.iosDescription'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t('pwa.install.action') }),
    ).not.toBeInTheDocument();
  });

  it('stays hidden when the app is already running standalone', () => {
    state.standalone = true;
    state.iosSafari = true;
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden when the prompt was previously dismissed', () => {
    state.dismissed = true;
    state.iosSafari = true;
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('remembers a dismissal and hides the affordance', async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();

    await userEvent.click(await screen.findByRole('button', { name: t('pwa.install.close') }));

    expect(rememberInstallDismissed).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('button', { name: t('pwa.install.action') }),
    ).not.toBeInTheDocument();
  });
});
