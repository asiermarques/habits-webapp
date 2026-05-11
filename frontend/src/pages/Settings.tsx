import { UsersSection } from '@/users/UsersSection';
import { HabitsSection } from '@/habits/HabitsSection';
import { CurrencySection } from '@/settings/CurrencySection';

export function Settings() {
  return (
    <div className="space-y-8 p-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <UsersSection />
      <CurrencySection />
      <HabitsSection />
    </div>
  );
}
