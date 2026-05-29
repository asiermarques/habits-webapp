import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import {
  isIosSafari,
  isStandalone,
  rememberInstallDismissed,
  wasInstallDismissed,
} from './install';

// The `beforeinstallprompt` event isn't in the DOM lib types yet. It carries the
// deferred native install flow we trigger from our own button.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// US-005: a tasteful, dismissible install affordance. On Android/Chrome we defer
// the browser's `beforeinstallprompt` and trigger it from our own button; on iOS
// Safari (which never fires that event) we show manual "Add to Home Screen"
// guidance instead. Hidden when already installed (standalone) or previously
// dismissed, so it never nags. Mounted inside the app shell next to
// [[PwaUpdatePrompt]]; renders nothing in dev/e2e where no worker exists.
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(() => wasInstallDismissed());

  useEffect(() => {
    // Already installed or previously dismissed: never wire anything up.
    if (isStandalone() || wasInstallDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's mini-infobar; we present our own affordance instead.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      // Installed via the native flow or the browser menu — stop offering it.
      setDeferredPrompt(null);
      setShowIos(false);
      setDismissed(true);
      rememberInstallDismissed();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    if (isIosSafari()) setShowIos(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;
  if (!deferredPrompt && !showIos) return null;

  const dismiss = () => {
    setDismissed(true);
    rememberInstallDismissed();
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The event is single-use; clear it either way. Persist dismissal only when
    // installed so a declined prompt can resurface on a later visit.
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setDismissed(true);
      rememberInstallDismissed();
    }
  };

  const isIos = !deferredPrompt && showIos;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-8">
      <div className="surface mx-auto flex max-w-md items-start gap-3 p-4">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss-tint text-moss-deep"
        >
          {isIos ? <Share className="h-[18px] w-[18px]" /> : <Download className="h-[18px] w-[18px]" />}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base tracking-tight">
            {isIos ? t('pwa.install.iosTitle') : t('pwa.install.title')}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {isIos ? t('pwa.install.iosDescription') : t('pwa.install.description')}
          </p>
          {!isIos && (
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={install}>
                {t('pwa.install.action')}
              </Button>
              <Button variant="ghost" size="sm" onClick={dismiss}>
                {t('pwa.install.dismiss')}
              </Button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t('pwa.install.close')}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-paper-deep hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
