import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { DashboardPage, EmployeesPage, FxRatesPage, InsightsPage, NotFoundPage } from '@/pages';

/** Shared by the browser router and tests (memory router). */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'employees', element: <EmployeesPage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'settings/fx-rates', element: <FxRatesPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
