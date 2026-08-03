import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../shared/db/index.js';
import { appSettings } from '../../shared/db/schema.js';
import type { AppSettings, CurrencyCode, LocaleCode } from '@habitsapp/shared';
import type { SettingsRepository } from '../domain/SettingsRepository.js';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '../domain/Settings.js';
import { GLOBAL_SCOPE, bumpDataVersion } from '../../shared/db/dataVersion.js';

export class DrizzleSettingsRepository implements SettingsRepository {
  get(): AppSettings {
    const rows = db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, ['currency', 'locale']))
      .all();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      currency: (byKey.get('currency') as CurrencyCode | undefined) ?? DEFAULT_CURRENCY,
      locale: (byKey.get('locale') as LocaleCode | undefined) ?? DEFAULT_LOCALE,
    };
  }

  setCurrency(currency: CurrencyCode): AppSettings {
    this.upsert('currency', currency);
    return this.get();
  }

  setLocale(locale: LocaleCode): AppSettings {
    this.upsert('locale', locale);
    return this.get();
  }

  // Wrapped in a transaction purely so the data-version bump commits with the
  // setting itself: a bump visible without its write (or surviving its
  // rollback) would tell other devices to refetch a change that isn't there.
  private upsert(key: string, value: string): void {
    db.transaction((tx) => {
      tx.insert(appSettings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: sql`excluded.value` },
        })
        .run();

      // Settings are instance-wide, so every device is affected regardless of
      // which User it has selected.
      bumpDataVersion(tx, GLOBAL_SCOPE);
    });
  }
}
