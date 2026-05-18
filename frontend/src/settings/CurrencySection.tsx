import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@habitsapp/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { useSettingsQuery, useUpdateCurrency } from './queries';

export function CurrencySection() {
  const { data, isLoading } = useSettingsQuery();
  const updateCurrency = useUpdateCurrency();
  const value = data?.currency ?? 'EUR';

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.currency.title')}</h2>
        <p className="text-sm text-ink-soft">{t('settings.currency.description')}</p>
      </div>
      <div className="space-y-1.5">
        <Select
          value={value}
          onValueChange={(v) => updateCurrency.mutate(v as CurrencyCode)}
          disabled={isLoading || updateCurrency.isPending}
        >
          <SelectTrigger id="settings-currency" className="w-40" aria-label="Currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
