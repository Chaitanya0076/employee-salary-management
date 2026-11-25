import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/use-page-title';
import { PlaceholderPage } from './placeholder';

export const DashboardPage = () => (
  <PlaceholderPage
    title="Dashboard"
    description="Headcount and pay across the organisation at a glance."
  />
);

export const EmployeesPage = () => (
  <PlaceholderPage
    title="Employees"
    description="Search, filter and manage employees and their pay."
  />
);

export const InsightsPage = () => (
  <PlaceholderPage
    title="Insights"
    description="How ACME pays people, by country, department and level."
  />
);

export const FxRatesPage = () => (
  <PlaceholderPage title="FX rates" description="Exchange rates used to compare pay in USD." />
);

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <>
      <PageHeader
        title="Page not found"
        description="The page you were looking for doesn't exist."
      />
      <Button asChild variant="outline">
        <Link to="/">Back to the dashboard</Link>
      </Button>
    </>
  );
}
