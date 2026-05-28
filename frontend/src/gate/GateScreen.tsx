import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/lib/i18n';
import { useGateLogin } from './queries';

// The unlock screen shown by GateGuard when the instance is gated and locked.
// Follows the page-hero pattern (eyebrow → Fraunces wordmark → tagline).
export function GateScreen() {
  const login = useGateLogin();
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFailed(false);
    login.mutate(password, { onError: () => setFailed(true) });
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-16">
      <div className="rise">
        <p className="eyebrow">{t('gate.eyebrow')}</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">{t('app.title')}</h1>
        <p className="mt-3 text-ink-soft">{t('gate.subtitle')}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gate-password">{t('gate.password')}</Label>
            <Input
              id="gate-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFailed(false);
              }}
              aria-invalid={failed}
            />
            {failed && (
              <p role="alert" className="text-sm text-ember">
                {t('gate.error')}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? t('action.loading') : t('gate.submit')}
          </Button>
        </form>
      </div>
    </main>
  );
}
