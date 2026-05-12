import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { appSettings } from '../../db/schema.js';
import type { AppSettings, CurrencyCode } from '@habitsapp/shared';
import type { SettingsRepository } from '../domain/SettingsRepository.js';
import { DEFAULT_CURRENCY } from '../domain/Settings.js';

export class DrizzleSettingsRepository implements SettingsRepository {
  get(): AppSettings {
    const row = db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'currency'))
      .get();
    return { currency: (row?.value as CurrencyCode | undefined) ?? DEFAULT_CURRENCY };
  }

  setCurrency(currency: CurrencyCode): AppSettings {
    db.insert(appSettings)
      .values({ key: 'currency', value: currency })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: sql`excluded.value` },
      })
      .run();
    return { currency };
  }
}
