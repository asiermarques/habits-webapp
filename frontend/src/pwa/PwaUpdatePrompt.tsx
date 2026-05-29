import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

// Registers the service worker (the hook calls registerSW on mount) and, when a
// newly deployed build is waiting, surfaces a persistent "refresh to update"
// toast. Activating it calls updateServiceWorker(true), which skips waiting and
// reloads onto the new version — so installed users never pin to a stale build.
// Renders nothing itself; in dev / e2e the virtual module is a no-op.
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    toast(t('pwa.updateAvailable'), {
      duration: Infinity,
      action: {
        label: t('pwa.refresh'),
        onClick: () => updateServiceWorker(true),
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
