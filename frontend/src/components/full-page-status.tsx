import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FullPageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}
