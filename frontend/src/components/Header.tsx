import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, PlusCircle, Settings as SettingsIcon } from 'lucide-react';
import { UserSwitcher } from '@/users/UserSwitcher';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useLogEntryDialog } from '@/entries/LogEntryDialog';
import { t } from '@/lib/i18n';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { openLog } = useLogEntryDialog();
  const canLog = !!activeUser && habits.length > 0;

  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-moss-tint hover:text-moss-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

  return (
    <header className="sticky top-0 z-10 border-b border-hairline/80 bg-paper/75 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        {isHome ? (
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-2xl tracking-tight">{t('app.title')}</span>
            <span
              aria-hidden
              className="ml-0.5 h-1.5 w-1.5 rounded-full bg-moss transition group-hover:scale-125"
            />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label={t('header.backToHome')}
            className={iconBtn}
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
        )}

        <div className="flex items-center gap-1">
          <UserSwitcher />
          {isHome && (
            <nav className="ml-1 flex items-center gap-0.5 border-l border-hairline pl-1">
              <button
                type="button"
                onClick={openLog}
                disabled={!canLog}
                aria-label={t('header.logEntry')}
                className={`${iconBtn} disabled:cursor-not-allowed disabled:text-ink-faint/50 disabled:hover:bg-transparent disabled:hover:text-ink-faint/50`}
              >
                <PlusCircle className="h-[18px] w-[18px]" />
              </button>
              <Link to="/metrics" aria-label={t('header.metrics')} className={iconBtn}>
                <BarChart3 className="h-[18px] w-[18px]" />
              </Link>
              <Link to="/settings" aria-label={t('header.settings')} className={iconBtn}>
                <SettingsIcon className="h-[18px] w-[18px]" />
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
