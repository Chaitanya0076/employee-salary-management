import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageMessage, FullPageSpinner } from '@/components/full-page-status';
import { Button } from '@/components/ui/button';
import { useSession } from './session';

/** Renders child routes for a signed-in user; otherwise sends them to /login and back afterwards. */
export function RequireAuth() {
  const location = useLocation();
  const { data: user, isPending, isError, error, refetch } = useSession();

  if (isPending) return <FullPageSpinner label="Checking your session…" />;

  if (isError) {
    return (
      <FullPageMessage title="Something went wrong">
        <p className="text-muted-foreground">{error.message}</p>
        <Button onClick={() => void refetch()}>Try again</Button>
      </FullPageMessage>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
