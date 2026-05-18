import { UsersSection } from '@/users/UsersSection';
import { HabitsSection } from '@/habits/HabitsSection';
import { CurrencySection } from '@/settings/CurrencySection';
import { LocaleSection } from '@/settings/LocaleSection';
import { t } from '@/lib/i18n';

export function Settings() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8 rise">
      <header className="space-y-3">
        <p className="eyebrow">{t('settings.eyebrow')}</p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {t('settings.title')}<span className="text-moss">.</span>
        </h1>
      </header>
      <UsersSection />
      <div className="grid gap-8 md:grid-cols-2">
        <LocaleSection />
        <CurrencySection />
      </div>
      <HabitsSection />
    </div>
  );
}
