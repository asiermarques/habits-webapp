import type { AppSettings, CurrencyCode, LocaleCode } from '@habitsapp/shared';

export interface SettingsRepository {
  get(): AppSettings;
  setCurrency(currency: CurrencyCode): AppSettings;
  setLocale(locale: LocaleCode): AppSettings;
}
