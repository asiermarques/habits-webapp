import type { LocaleCode } from '@habitsapp/shared';

// Single source of truth for date/number locale across the app. The active
// locale is set by `LocaleProvider` from the user's saved setting; the default
// is English. `VITE_LOCALE` still works as a build-time override for tests.

const FALLBACK_LOCALE = 'en-US';

const TAGS: Record<LocaleCode, string> = {
  en: 'en-US',
  es: 'es-ES',
};

let active: string = (import.meta.env?.VITE_LOCALE as string | undefined) ?? FALLBACK_LOCALE;

export function getLocale(): string {
  return active;
}

export function setActiveLocale(locale: LocaleCode): void {
  active = TAGS[locale] ?? FALLBACK_LOCALE;
}
