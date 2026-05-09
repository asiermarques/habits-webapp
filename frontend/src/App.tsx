import { Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Home } from '@/pages/Home';
import { Metrics } from '@/pages/Metrics';
import { Settings } from '@/pages/Settings';
import { UserProvider } from '@/users/UserContext';

export function App() {
  return (
    <UserProvider>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </UserProvider>
  );
}
