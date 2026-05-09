import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from '@/components/Header';
import { Home } from '@/pages/Home';
import { Metrics } from '@/pages/Metrics';
import { Settings } from '@/pages/Settings';
import { UserProvider } from '@/users/UserContext';
import { LogEntryDialogProvider } from '@/entries/LogEntryDialog';

export function App() {
  return (
    <UserProvider>
      <LogEntryDialogProvider>
        <div className="min-h-full bg-neutral-50 text-neutral-900">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <Toaster richColors position="top-center" />
        </div>
      </LogEntryDialogProvider>
    </UserProvider>
  );
}
