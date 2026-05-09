import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Settings as SettingsIcon } from 'lucide-react';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

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

      {isHome && (
        <nav className="flex items-center gap-1">
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
    </header>
  );
}
