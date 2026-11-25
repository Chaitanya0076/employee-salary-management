import { Badge } from '@/components/ui/badge';
import type { EmployeeStatus } from '../types';

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return status === 'ACTIVE' ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}
