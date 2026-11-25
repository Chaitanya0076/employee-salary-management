import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/use-page-title';

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
