import type { ReactNode } from 'react';
import { setActiveLocale, getActiveLocale } from '@/lib/i18n';
import { useSettingsQuery } from './queries';

// Reads the saved locale from the settings query and mirrors it into the
// module-level state used by `t()` and `getLocale()`. We sync **during render**
// (not in an effect) so the very first paint after the settings query resolves
// already returns translated strings. The `key` on the wrapper forces a
// subtree remount when the locale changes, so static `t(...)` calls re-evaluate.

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { data } = useSettingsQuery();
  const locale = data?.locale ?? 'en';
  if (getActiveLocale() !== locale) {
    setActiveLocale(locale);
  }
  return <div key={locale}>{children}</div>;
}
