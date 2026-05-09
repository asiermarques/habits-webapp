import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@habitsapp/shared';
import { useUsersQuery } from './queries';

type UserContextValue = {
  users: User[];
  activeUser: User | undefined;
  setActiveUserId: (id: number) => void;
  isLoading: boolean;
};

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = 'habitsapp.activeUserId';

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: users = [], isLoading } = useUsersQuery();
  const [activeUserId, setActiveUserIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    if (users.length === 0) return;

    const storedExists = activeUserId !== null && users.some((u) => u.id === activeUserId);
    if (storedExists) return;

    const fallback = users.find((u) => u.isDefault) ?? users[0];
    setActiveUserIdState(fallback.id);
  }, [users, activeUserId]);

  const setActiveUserId = (id: number) => {
    setActiveUserIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const value = useMemo<UserContextValue>(
    () => ({
      users,
      activeUser: users.find((u) => u.id === activeUserId),
      setActiveUserId,
      isLoading,
    }),
    [users, activeUserId, isLoading],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within a UserProvider');
  return ctx;
}
