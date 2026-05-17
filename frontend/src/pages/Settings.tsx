import { UsersSection } from '@/users/UsersSection';
import { HabitsSection } from '@/habits/HabitsSection';
import { CurrencySection } from '@/settings/CurrencySection';

export function Settings() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8 rise">
      <header className="space-y-3">
        <p className="eyebrow">arrangements</p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          Settings<span className="text-moss">.</span>
        </h1>
      </header>
      <UsersSection />
      <CurrencySection />
      <HabitsSection />
    </div>
  );
}
