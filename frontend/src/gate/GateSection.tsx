import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { t } from '@/lib/i18n';
import { useGateLogout, useGateStatus } from './queries';

// Settings section that lets the user end their session. Only meaningful when
// the instance is gated — on an open instance there's nothing to log out of,
// so the section renders nothing.
export function GateSection() {
  const { data } = useGateStatus();
  const logout = useGateLogout();

  if (!data?.gated) return null;

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.gate.title')}</h2>
        <p className="text-sm text-ink-soft">{t('settings.gate.description')}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={logout.isPending}>
            {logout.isPending ? t('action.loading') : t('settings.gate.logout')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.gate.logoutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.gate.logoutConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => logout.mutate()}>
              {t('settings.gate.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
