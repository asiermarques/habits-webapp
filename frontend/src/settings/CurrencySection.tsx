import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@habitsapp/shared';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsQuery, useUpdateCurrency } from './queries';

export function CurrencySection() {
  const { data, isLoading } = useSettingsQuery();
  const updateCurrency = useUpdateCurrency();
  const value = data?.currency ?? 'EUR';

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">Currency</h2>
        <p className="text-sm text-ink-soft">
          Used for displaying the "Cost spent" amount on bad habits. Shared across all users.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-currency">Currency code</Label>
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
