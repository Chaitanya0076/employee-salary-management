import { UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useUpdateEmployee } from '../api';
import type { EmployeeDetail } from '../types';

/** Deactivate (soft delete) or reactivate an employee, after confirmation. */
export function StatusToggle({ employee }: { employee: EmployeeDetail }) {
  const update = useUpdateEmployee(employee.id);
  const deactivating = employee.status === 'ACTIVE';
  const name = `${employee.firstName} ${employee.lastName}`;

  const confirm = () =>
    update.mutate(
      { status: deactivating ? 'INACTIVE' : 'ACTIVE' },
      {
        onSuccess: () =>
          toast.success(deactivating ? `${name} deactivated` : `${name} reactivated`),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={update.isPending}>
          {deactivating ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
          {deactivating ? 'Deactivate' : 'Reactivate'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `Deactivate ${name}?` : `Reactivate ${name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating
              ? 'They will be excluded from insights and pay changes. Their record and pay history are kept, and you can reactivate them at any time.'
              : 'They will be included in insights again and their pay can be changed.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>
            {deactivating ? 'Deactivate' : 'Reactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
