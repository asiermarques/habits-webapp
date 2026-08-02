import { toast } from 'sonner';
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
import { discardAllPending } from './offlineStore';
import { usePendingChangesCount } from './queries';

// The one sanctioned exception to BR-005: an explicit, confirmed, all-or-nothing
// escape hatch for a backlog that will never sync (US-009, OQ-003). Lives in
// Settings > "Your data" alongside the other data-destructive/egress controls.
// Renders nothing when there's nothing pending — there's no action to offer.
export function DiscardPendingSection() {
  const pendingCount = usePendingChangesCount();

  if (pendingCount === 0) return null;

  function onConfirm() {
    discardAllPending();
    toast.success(t('data.discardPending.success'));
  }

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{t('data.discardPending.title')}</h2>
        <p className="text-sm text-ink-soft">{t('data.discardPending.description')}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">
            {t(pendingCount === 1 ? 'data.discardPending.button.one' : 'data.discardPending.button.other', {
              count: String(pendingCount),
            })}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('data.discardPending.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('data.discardPending.confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} className="bg-ember hover:bg-ember/90">
              {t('data.discardPending.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
