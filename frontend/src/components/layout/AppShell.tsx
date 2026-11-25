import { Menu } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useSession } from '@/features/auth/session';
import { MainNav } from './MainNav';
import { UserMenu } from './UserMenu';

function PageSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading page">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Brand() {
  return <span className="text-base font-semibold tracking-tight">ACME Salary</span>;
}

/**
 * Layout for signed-in pages: a sidebar on wide screens, a slide-out menu on
 * narrow ones, a header with the user menu, and the page content.
 */
export function AppShell() {
  const { data: user } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-svh bg-muted/30 md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>

      <aside className="hidden border-r bg-background md:flex md:flex-col md:gap-6 md:p-4">
        <div className="px-3 pt-2">
          <Brand />
        </div>
        <MainNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle>
                  <Brand />
                </SheetTitle>
                <SheetDescription className="sr-only">Main navigation</SheetDescription>
              </SheetHeader>
              <MainNav onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto">{user && <UserMenu user={user} />}</div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-8">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
