import { UsersSection } from '@/users/UsersSection';
import { HabitsSection } from '@/habits/HabitsSection';
import { CurrencySection } from '@/settings/CurrencySection';
import { LocaleSection } from '@/settings/LocaleSection';
import { BackupSection } from '@/backup/BackupSection';
import { ExportSection } from '@/export/ExportSection';
import { DiscardPendingSection } from '@/entries/DiscardPendingSection';
import { GateSection } from '@/gate/GateSection';
import { useUserContext } from '@/users/UserContext';
import { t } from '@/lib/i18n';

export function Settings() {
  const { activeUser } = useUserContext();

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
      {activeUser && (
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="eyebrow">{t('data.eyebrow')}</p>
            <h2 className="font-display text-2xl leading-tight tracking-tight">
              {t('data.title')}<span className="text-moss">.</span>
            </h2>
          </div>
          <ExportSection />
          <BackupSection />
          <DiscardPendingSection />
        </section>
      )}
      <GateSection />
    </div>
  );
}
