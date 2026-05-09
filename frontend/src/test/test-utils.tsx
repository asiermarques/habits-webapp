import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider } from '@/users/UserContext';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type TestProvidersProps = {
  children: ReactNode;
  initialPath?: string;
  queryClient?: QueryClient;
};

export function TestProviders({
  children,
  initialPath = '/',
  queryClient = makeQueryClient(),
}: TestProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <UserProvider>{children}</UserProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
