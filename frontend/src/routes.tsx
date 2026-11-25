import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { NotFoundPage } from '@/pages';

// Route-level code splitting: each page is its own chunk, loaded on first visit.
const DashboardPage = lazy(() =>
  import('@/features/insights/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const InsightsPage = lazy(() =>
  import('@/features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })),
);
const FxRatesPage = lazy(() =>
  import('@/features/settings/FxRatesPage').then((m) => ({ default: m.FxRatesPage })),
);
const EmployeesListPage = lazy(() =>
  import('@/features/employees/EmployeesListPage').then((m) => ({ default: m.EmployeesListPage })),
);
const EmployeeDetailPage = lazy(() =>
  import('@/features/employees/EmployeeDetailPage').then((m) => ({
    default: m.EmployeeDetailPage,
  })),
);
const NewEmployeePage = lazy(() =>
  import('@/features/employees/EmployeeFormPage').then((m) => ({ default: m.NewEmployeePage })),
);
const EditEmployeePage = lazy(() =>
  import('@/features/employees/EmployeeFormPage').then((m) => ({ default: m.EditEmployeePage })),
);

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
          { path: 'employees', element: <EmployeesListPage /> },
          { path: 'employees/new', element: <NewEmployeePage /> },
          { path: 'employees/:id', element: <EmployeeDetailPage /> },
          { path: 'employees/:id/edit', element: <EditEmployeePage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'settings/fx-rates', element: <FxRatesPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
