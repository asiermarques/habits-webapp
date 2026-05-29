// Browser-detection and persistence helpers for the in-app install affordance
// (US-005). Kept apart from the component so the platform quirks are unit-tested
// in isolation. See [[InstallPrompt]].

// Whether the user already dismissed the install affordance on this device. We
// persist it so the prompt doesn't nag on every load.
const DISMISSED_KEY = 'habits.pwa.installDismissed';

export function wasInstallDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    // Storage unavailable (private mode / quota): treat as not-dismissed. Worst
    // case the affordance shows once more — harmless and still dismissible.
    return false;
  }
}

export function rememberInstallDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // See wasInstallDismissed: failing to remember is acceptable.
  }
}

// True when the app is already running as an installed PWA (Android/Chrome
// standalone display mode or the legacy iOS Safari `navigator.standalone`).
// In that case there's nothing to install, so the affordance stays hidden.
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

// iOS Safari never fires `beforeinstallprompt`, so we detect it to offer manual
// "Add to Home Screen" guidance instead. iPadOS 13+ reports a desktop-Mac UA,
// so we also treat a touch-capable "Macintosh" as iOS. Chrome/Firefox/Edge on
// iOS (CriOS/FxiOS/EdgiOS) can't install to the home screen, so they're excluded.
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}
