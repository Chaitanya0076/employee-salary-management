import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { FullPageSpinner } from '@/components/full-page-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/hooks/use-page-title';
import { ApiError } from '@/lib/api-client';
import { safeRedirectPath, useLogin, useSession } from './session';

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // 401 is deliberately generic on the server too: it never says which field was wrong.
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 429) return error.message;
    if (error.status === 400) return 'Enter a valid email address and your password.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function LoginPage() {
  usePageTitle('Sign in');
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectTo = safeRedirectPath((location.state as { from?: unknown } | null)?.from);

  if (session.isPending) return <FullPageSpinner />;
  if (session.data) return <Navigate to={redirectTo} replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => navigate(redirectTo, { replace: true }) },
    );
  }

  const submitting = login.isPending;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">ACME Salary Management</h1>
          </CardTitle>
          <CardDescription>Sign in with your HR account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            {login.isError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{loginErrorMessage(login.error)}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <Button type="submit" disabled={submitting || !email || !password}>
              {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
