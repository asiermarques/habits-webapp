import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLocale } from '@/lib/locale';

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  'aria-labelledby'?: string;
};

const WEEK_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function formatTrigger(iso: string): string {
  const parsed = parseIso(iso);
  if (!parsed) return '';
  const date = new Date(parsed.y, parsed.m, parsed.d);
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatHeader(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

// Days, Monday-first, with leading nulls for the offset and trailing nulls to fill the last row.
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): Sun=0..Sat=6 → Mon-first: (getDay()+6)%7
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoToday(): string {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedValue = parseIso(value);
  const initialAnchor = parsedValue ?? parseIso(isoToday()) ?? { y: 2026, m: 0, d: 1 };
  const [view, setView] = useState({ year: initialAnchor.y, month: initialAnchor.m });

  // Re-anchor the visible month when the controlled value jumps.
  useEffect(() => {
    if (parsedValue) setView({ year: parsedValue.y, month: parsedValue.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);
  const todayIso = isoToday();

  const pick = (day: number) => {
    const iso = toIso(view.year, view.month, day);
    if (min && iso < min) return;
    if (max && iso > max) return;
    onChange(iso);
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        data-testid="date-picker-trigger"
        data-value={value}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...aria}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-hairline bg-card px-3 text-left text-sm tabular-nums',
          'transition-colors hover:border-moss/40 focus:outline-none focus:ring-[3px] focus:ring-ring/50',
          !parsedValue && 'text-ink-faint',
        )}
      >
        <span>{parsedValue ? formatTrigger(value) : placeholder}</span>
        <CalendarIcon className="h-4 w-4 text-ink-soft" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-hairline bg-card p-3 shadow-lg sm:right-auto sm:w-[20rem]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-moss-tint hover:text-moss-deep"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <div className="font-display text-base tracking-tight">
              {formatHeader(view.year, view.month)}
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-moss-tint hover:text-moss-deep"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] uppercase tracking-[0.18em] text-ink-faint font-mono">
            {WEEK_HEADERS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div role="grid" className="grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              if (day == null) return <span key={i} aria-hidden />;
              const iso = toIso(view.year, view.month, day);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              const disabled = (min && iso < min) || (max && iso > max) || false;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={cn(
                    'flex h-10 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                    'hover:bg-moss-tint hover:text-moss-deep',
                    'disabled:cursor-not-allowed disabled:text-ink-faint disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-faint',
                    isSelected && 'bg-moss text-card hover:bg-moss-deep hover:text-card',
                    !isSelected && isToday && 'ring-1 ring-inset ring-moss/40 text-moss-deep',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const t = isoToday();
                if ((min && t < min) || (max && t > max)) return;
                onChange(t);
                setOpen(false);
              }}
              className="text-xs font-medium uppercase tracking-[0.18em] text-moss-deep hover:text-moss"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
