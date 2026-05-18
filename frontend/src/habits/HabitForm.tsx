import { useEffect, useState, type FormEvent } from 'react';
import {
  HABIT_TYPES,
  type HabitDefinition,
  type HabitType,
} from '@habitsapp/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/lib/i18n';

type HabitFormValues = {
  name: string;
  type: HabitType;
  positive: boolean;
};

type HabitFormProps = {
  initial?: HabitDefinition;
  submitLabel: string;
  pending?: boolean;
  typeLocked?: boolean;
  onSubmit: (values: HabitFormValues) => void;
  onCancel?: () => void;
};

export function HabitForm({
  initial,
  submitLabel,
  pending = false,
  typeLocked = false,
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<HabitType>(initial?.type ?? 'custom');
  const [positive, setPositive] = useState(initial?.positive ?? true);

  // When type changes to workout/writing, force positive=true (UI mirrors the API rule).
  useEffect(() => {
    if (type !== 'custom') setPositive(true);
  }, [type]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, type, positive });
  };

  const TYPE_LABELS: Record<HabitType, string> = {
    workout: t('habitType.workout'),
    writing: t('habitType.writing'),
    custom: t('habitType.custom'),
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="habit-name">{t('habitForm.name')}</Label>
        <Input
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('habitForm.namePlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="habit-type">{t('habitForm.type')}</Label>
        <Select value={type} onValueChange={(v) => setType(v as HabitType)} disabled={typeLocked}>
          <SelectTrigger id="habit-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HABIT_TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {TYPE_LABELS[tp]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeLocked && (
          <p className="text-xs text-ink-soft">{t('habitForm.typeLocked')}</p>
        )}
      </div>

      {type === 'custom' && (
        <div className="flex items-center justify-between rounded-md border border-hairline bg-paper-deep px-3 py-2">
          <div>
            <Label htmlFor="habit-positive" className="font-medium">
              {t('habitForm.positive')}
            </Label>
            <p className="text-xs text-ink-soft">{t('habitForm.positiveHelp')}</p>
          </div>
          <Switch id="habit-positive" checked={positive} onCheckedChange={setPositive} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={pending || !name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
