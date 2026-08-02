import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, PlusCircle, Settings as SettingsIcon } from 'lucide-react';
import { UserSwitcher } from '@/users/UserSwitcher';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useLogEntryDialog } from '@/entries/LogEntryDialog';
import { usePendingChangesCount } from '@/entries/queries';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isMetrics = location.pathname === '/metrics';
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery(activeUser?.id ?? 0);
  const { openLog } = useLogEntryDialog();
  const canLog = !!activeUser && habits.length > 0;
  const pendingCount = usePendingChangesCount();

  // Lift the bar only once there's content scrolling beneath it — at the top of
  // the page the flat hairline + blur carry the separation, keeping the
  // editorial system flat (see docs/DESIGN.md §4–§5). The shadow earns its keep.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-moss-tint hover:text-moss-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

  return (
    <header
      className={cn(
        'sticky top-0 z-10 border-b border-hairline/80 bg-card/90 backdrop-blur-md transition-shadow duration-300',
        scrolled &&
          'shadow-[0_1px_2px_oklch(0.20_0.01_60/0.04),0_10px_28px_-20px_oklch(0.20_0.01_60/0.18)]',
      )}
    >
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
          {pendingCount > 0 && (
            <span
              role="status"
              className="mr-1 flex h-7 items-center gap-1.5 rounded-full border border-clay/40 bg-clay/10 px-2.5 text-xs font-medium text-ink-soft"
            >
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
              {t(pendingCount === 1 ? 'pendingChanges.one' : 'pendingChanges.other', {
                count: String(pendingCount),
              })}
            </span>
          )}
          <UserSwitcher />
          {(isHome || isMetrics) && (
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
              {!isMetrics && (
                <Link to="/metrics" aria-label={t('header.metrics')} className={iconBtn}>
                  <BarChart3 className="h-[18px] w-[18px]" />
                </Link>
              )}
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
