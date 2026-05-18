import { SUPPORTED_LOCALES, type LocaleCode } from '@habitsapp/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { useSettingsQuery, useUpdateLocale } from './queries';

export function LocaleSection() {
  const { data, isLoading } = useSettingsQuery();
  const updateLocale = useUpdateLocale();
  const value = data?.locale ?? 'en';

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.locale.title')}</h2>
        <p className="text-sm text-ink-soft">{t('settings.locale.description')}</p>
      </div>
      <div className="space-y-1.5">
        <Select
          value={value}
          onValueChange={(v) => updateLocale.mutate(v as LocaleCode)}
          disabled={isLoading || updateLocale.isPending}
        >
          <SelectTrigger id="settings-locale" className="w-40" aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((code) => (
              <SelectItem key={code} value={code}>
                {t(`settings.locale.${code}` as const)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
