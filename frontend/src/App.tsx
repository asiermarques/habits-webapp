import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from '@/components/Header';
import { Home } from '@/pages/Home';
import { Metrics } from '@/pages/Metrics';
import { Settings } from '@/pages/Settings';
import { UserProvider } from '@/users/UserContext';
import { LogEntryDialogProvider } from '@/entries/LogEntryDialog';
import { LocaleProvider } from '@/settings/LocaleProvider';

export function App() {
  return (
    <LocaleProvider>
    <UserProvider>
      <LogEntryDialogProvider>
        <div className="min-h-full text-ink">
          <Header />
          <main className="px-5 pb-24 pt-2 sm:px-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <Toaster
            richColors
            position="top-center"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-sans)',
                border: '1px solid var(--hairline)',
                borderRadius: '12px',
              },
            }}
          />
        </div>
      </LogEntryDialogProvider>
    </UserProvider>
    </LocaleProvider>
  );
}
