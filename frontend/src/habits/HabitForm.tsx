import { useEffect, useState, type FormEvent } from 'react';
import {
  HABIT_TYPES,
  HABIT_CURATED_COLORS,
  HABIT_NEGATIVE_COLOR,
  type HabitDefinition,
  type HabitType,
} from '@habitsapp/shared';
import { cn } from '@/lib/utils';
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
  color: string;
};

type HabitFormProps = {
  initial?: HabitDefinition;
  submitLabel: string;
  pending?: boolean;
  typeLocked?: boolean;
  onSubmit: (values: HabitFormValues) => void;
  onCancel?: () => void;
};

function swatchesFor(positive: boolean): readonly string[] {
  return positive
    ? HABIT_CURATED_COLORS
    : [...HABIT_CURATED_COLORS, HABIT_NEGATIVE_COLOR];
}

function defaultColorFor(positive: boolean): string {
  return positive ? HABIT_CURATED_COLORS[0] : HABIT_NEGATIVE_COLOR;
}

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
  const [selectedColor, setSelectedColor] = useState<string>(
    initial?.color ?? defaultColorFor(initial?.positive ?? true),
  );

  // When type changes to workout/writing, force positive=true (UI mirrors the API rule).
  useEffect(() => {
    if (type !== 'custom') setPositive(true);
  }, [type]);

  // When toggling to positive, reset any now-invalid red selection.
  useEffect(() => {
    if (positive && selectedColor === HABIT_NEGATIVE_COLOR) {
      setSelectedColor(HABIT_CURATED_COLORS[0]);
    }
  }, [positive, selectedColor]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, type, positive, color: selectedColor });
  };

  const TYPE_LABELS: Record<HabitType, string> = {
    workout: t('habitType.workout'),
    writing: t('habitType.writing'),
    custom: t('habitType.custom'),
  };

  const swatches = swatchesFor(positive);

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

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {t('habitForm.color')}
        </legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {swatches.map((hex) => (
            <label key={hex} className="cursor-pointer">
              <input
                type="radio"
                name="habit-color"
                value={hex}
                aria-label={hex}
                checked={selectedColor === hex}
                onChange={() => setSelectedColor(hex)}
                className="sr-only"
              />
              <span
                className={cn(
                  'block h-6 w-6 rounded-full ring-offset-1 transition-shadow',
                  selectedColor === hex
                    ? 'ring-2 ring-moss'
                    : 'ring-1 ring-hairline hover:ring-ink-faint',
                )}
                style={{ backgroundColor: hex }}
              />
            </label>
          ))}
        </div>
      </fieldset>

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
