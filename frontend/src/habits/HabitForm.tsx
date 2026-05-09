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

const TYPE_LABELS: Record<HabitType, string> = {
  workout: 'Workout',
  writing: 'Writing',
  custom: 'Custom',
};

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

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="habit-name">Name</Label>
        <Input
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Running"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="habit-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as HabitType)} disabled={typeLocked}>
          <SelectTrigger id="habit-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HABIT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeLocked && (
          <p className="text-xs text-neutral-500">
            Type is locked because entries already exist for this habit.
          </p>
        )}
      </div>

      {type === 'custom' && (
        <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
          <div>
            <Label htmlFor="habit-positive" className="font-medium">
              Positive habit
            </Label>
            <p className="text-xs text-neutral-500">
              Off = something you want less of (e.g. fast food).
            </p>
          </div>
          <Switch id="habit-positive" checked={positive} onCheckedChange={setPositive} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending || !name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
