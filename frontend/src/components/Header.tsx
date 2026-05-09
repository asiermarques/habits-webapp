import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, PlusCircle, Settings as SettingsIcon } from 'lucide-react';
import { UserSwitcher } from '@/users/UserSwitcher';
import { useUserContext } from '@/users/UserContext';
import { useHabitDefinitionsQuery } from '@/habits/queries';
import { useLogEntryDialog } from '@/entries/LogEntryDialog';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const { activeUser } = useUserContext();
  const { data: habits = [] } = useHabitDefinitionsQuery();
  const { openLog } = useLogEntryDialog();
  const canLog = !!activeUser && habits.length > 0;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4">
      {isHome ? (
        <Link to="/" className="text-lg font-semibold">
          Habits
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to home"
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-1">
        <UserSwitcher />
        {isHome && (
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={openLog}
              disabled={!canLog}
              aria-label="Log entry"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
            >
              <PlusCircle className="h-5 w-5" />
            </button>
            <Link
              to="/metrics"
              aria-label="Metrics"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
            >
              <BarChart3 className="h-5 w-5" />
            </Link>
            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
