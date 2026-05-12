import type { AppSettings, CurrencyCode } from '@habitsapp/shared';

export interface SettingsRepository {
  get(): AppSettings;
  setCurrency(currency: CurrencyCode): AppSettings;
}
