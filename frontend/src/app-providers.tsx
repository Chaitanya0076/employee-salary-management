import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';

export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors closeButton />
    </QueryClientProvider>
  );
}
