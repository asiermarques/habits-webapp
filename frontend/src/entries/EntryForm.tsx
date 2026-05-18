import { useMemo, useState, type FormEvent } from 'react';
import type {
  CurrencyCode,
  CustomData,
  Entry,
  EntryData,
  HabitDefinition,
  WorkoutData,
  WritingData,
} from '@habitsapp/shared';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { todayIso } from './date';

type FormValues = {
  habitDefinitionId: number;
  date: string;
  data: EntryData;
};

type EntryFormProps = {
  habits: HabitDefinition[];
  initial?: Entry;
  pending?: boolean;
  currency?: CurrencyCode;
  onSubmit: (values: FormValues) => void;
  onCancel?: () => void;
};

function emptyDataFor(type: HabitDefinition['type']): EntryData {
  if (type === 'workout') return { duration: NaN } as WorkoutData;
  if (type === 'writing') return { words: 0 } as WritingData;
  return {} as CustomData;
}

function isDataValid(type: HabitDefinition['type'], data: EntryData): boolean {
  if (type === 'workout') {
    const d = data as WorkoutData;
    return Number.isFinite(d.duration) && d.duration > 0;
  }
  if (type === 'writing') {
    const d = data as WritingData;
    return Number.isFinite(d.words) && d.words >= 0;
  }
  return true;
}

export function EntryForm({ habits, initial, pending = false, currency = 'EUR', onSubmit, onCancel }: EntryFormProps) {
  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.name.localeCompare(b.name)),
    [habits],
  );

  const [habitId, setHabitId] = useState<number>(
    initial?.habitDefinitionId ?? sortedHabits[0]?.id ?? 0,
  );
  const [date, setDate] = useState<string>(initial?.date ?? todayIso());
  const selectedHabit = sortedHabits.find((h) => h.id === habitId);

  const [data, setData] = useState<EntryData>(
    initial?.data ?? (selectedHabit ? emptyDataFor(selectedHabit.type) : ({} as EntryData)),
  );

  const onHabitChange = (newId: number) => {
    setHabitId(newId);
    const next = sortedHabits.find((h) => h.id === newId);
    if (next && next.type !== selectedHabit?.type) {
      setData(emptyDataFor(next.type));
    }
  };

  const valid = !!selectedHabit && isDataValid(selectedHabit.type, data);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({ habitDefinitionId: habitId, date, data });
  };

  if (sortedHabits.length === 0) {
    return (
      <p className="text-sm text-ink-soft">{t('entryForm.noHabits')}</p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="entry-habit">{t('entryForm.habit')}</Label>
        <Select
          value={String(habitId)}
          onValueChange={(v) => onHabitChange(Number(v))}
          disabled={!!initial}
        >
          <SelectTrigger id="entry-habit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortedHabits.map((h) => (
              <SelectItem key={h.id} value={String(h.id)}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-date">{t('entryForm.date')}</Label>
        <DatePicker id="entry-date" value={date} onChange={setDate} max={todayIso()} />
      </div>

      {selectedHabit && (
        <DataFields type={selectedHabit.type} data={data} onChange={setData} currency={currency} />
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('action.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={pending || !valid}>
          {initial ? t('action.save') : t('entryForm.submit')}
        </Button>
      </div>
    </form>
  );
}

type DataFieldsProps = {
  type: HabitDefinition['type'];
  data: EntryData;
  onChange: (data: EntryData) => void;
  currency: CurrencyCode;
};

function NumField({
  id,
  label,
  value,
  onChange,
  step,
  min,
  required,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-ember">*</span>}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value == null || Number.isNaN(value) ? '' : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </div>
  );
}

function DataFields({ type, data, onChange, currency }: DataFieldsProps) {
  if (type === 'workout') {
    const d = data as WorkoutData;
    return (
      <div className="space-y-3">
        <NumField
          id="duration"
          label={t('entryForm.duration')}
          required
          min="1"
          value={d.duration}
          onChange={(v) => onChange({ ...d, duration: v ?? NaN })}
        />
        <NumField id="distance" label={t('entryForm.distance')} step="0.01" value={d.distance} onChange={(v) => onChange({ ...d, distance: v })} />
        <NumField id="weight" label={t('entryForm.weight')} step="0.1" value={d.weight} onChange={(v) => onChange({ ...d, weight: v })} />
        <NumField id="number" label={t('entryForm.repetitions')} min="0" step="1" value={d.number} onChange={(v) => onChange({ ...d, number: v })} />
        <div className="space-y-1.5">
          <Label htmlFor="notes">{t('entryForm.notes')}</Label>
          <Input id="notes" value={d.notes ?? ''} onChange={(e) => onChange({ ...d, notes: e.target.value || null })} />
        </div>
      </div>
    );
  }
  if (type === 'writing') {
    const d = data as WritingData;
    return (
      <div className="space-y-3">
        <NumField id="words" label={t('entryForm.words')} required min="0" value={d.words} onChange={(v) => onChange({ ...d, words: v ?? 0 })} />
        <NumField id="time" label={t('entryForm.time')} min="0" value={d.time} onChange={(v) => onChange({ ...d, time: v })} />
      </div>
    );
  }
  const d = data as CustomData;
  return (
    <div className="space-y-3">
      <NumField id="number" label={t('entryForm.repetitions')} min="0" step="1" value={d.number} onChange={(v) => onChange({ ...d, number: v })} />
      <NumField id="custom-amount" label={`${t('entryForm.costSpent')} (${currency})`} step="0.01" value={d.amount} onChange={(v) => onChange({ ...d, amount: v })} />
      <NumField id="custom-duration" label={t('entryForm.duration')} min="0" value={d.duration} onChange={(v) => onChange({ ...d, duration: v })} />
    </div>
  );
}
