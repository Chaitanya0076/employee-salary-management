import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/use-page-title';

/** Temporary page body until the feature is built in a later step. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  usePageTitle(title);
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This section is coming in a later step.
        </CardContent>
      </Card>
    </>
  );
}
