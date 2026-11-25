import { ArrowLeft, Pencil, RotateCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageTitle } from '@/hooks/use-page-title';
import { ApiError } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';
import { NotFoundPage } from '@/pages';
import { useCompensationHistory, useEmployee } from './api';
import { PayChangeDialog } from './components/PayChangeDialog';
import { StatusBadge } from './components/StatusBadge';
import { StatusToggle } from './components/StatusToggle';
import {
  COMPONENT_LABELS,
  LEVEL_LABELS,
  type CompensationRecord,
  type EmployeeDetail,
} from './types';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CurrentPay({ employee }: { employee: EmployeeDetail }) {
  const pay = employee.currentCompensation;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current pay</CardTitle>
        <CardDescription>
          {pay ? `Annual, effective from ${formatDate(pay.effectiveFrom)}` : 'No pay recorded'}
        </CardDescription>
      </CardHeader>
      {pay && (
        <CardContent>
          <dl className="divide-y">
            {pay.components.map((c) => (
              <div key={c.type} className="flex justify-between py-2 text-sm">
                <dt>{COMPONENT_LABELS[c.type]}</dt>
                <dd className="tabular-nums">{formatMoney(c.amount, pay.currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2 font-medium">
              <dt>Total</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(pay.total, pay.currency)}
                {pay.currency !== 'USD' && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    ≈ {formatMoney(pay.totalUsd, 'USD')}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

function HistoryTable({ employeeId }: { employeeId: number }) {
  const { data, isPending, isError, refetch } = useCompensationHistory(employeeId);
  const componentAmount = (record: CompensationRecord, type: 'BONUS' | 'ALLOWANCE') => {
    const c = record.components.find((x) => x.type === type);
    return c ? formatMoney(c.amount, record.currency) : '—';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary history</CardTitle>
        <CardDescription>Every pay record, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div role="alert" className="flex items-center gap-3 text-sm">
            Couldn't load the history.
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RotateCw aria-hidden="true" /> Try again
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Allowance</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending
                ? Array.from({ length: 2 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(record.effectiveFrom)} –{' '}
                        {record.effectiveTo ? formatDate(record.effectiveTo) : 'Current'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(record.base, record.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {componentAmount(record, 'BONUS')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {componentAmount(record, 'ALLOWANCE')}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(record.total, record.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.reason ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function EmployeeDetailPage() {
  const id = Number(useParams().id);
  const { data: employee, isPending, isError, error, refetch } = useEmployee(id);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  usePageTitle(employee ? `${employee.firstName} ${employee.lastName}` : 'Employee');

  if (!Number.isInteger(id) || id <= 0 || (error instanceof ApiError && error.status === 404)) {
    return <NotFoundPage />;
  }
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-medium">Couldn't load this employee</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          <RotateCw aria-hidden="true" /> Try again
        </Button>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isActive = employee.status === 'ACTIVE';

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/employees">
          <ArrowLeft aria-hidden="true" /> All employees
        </Link>
      </Button>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={`${employee.employeeCode} · ${employee.jobTitle}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusToggle employee={employee} />
            <Button asChild variant="outline">
              <Link to={`/employees/${employee.id}/edit`}>
                <Pencil aria-hidden="true" /> Edit
              </Link>
            </Button>
            <Button
              onClick={() => setPayDialogOpen(true)}
              disabled={!isActive}
              title={isActive ? undefined : 'Reactivate the employee to change their pay'}
            >
              <TrendingUp aria-hidden="true" /> Record pay change
            </Button>
          </div>
        }
      />

      {/* grid-cols-1 = minmax(0, 1fr): wide tables scroll inside their card instead of widening the page. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label="Status">
                <StatusBadge status={employee.status} />
              </DetailRow>
              <DetailRow label="Email">
                <a href={`mailto:${employee.email}`} className="hover:underline">
                  {employee.email}
                </a>
              </DetailRow>
              <DetailRow label="Department">{employee.department.name}</DetailRow>
              <DetailRow label="Level">{LEVEL_LABELS[employee.level]}</DetailRow>
              <DetailRow label="Country">
                {employee.country.name} ({employee.country.currency})
              </DetailRow>
              <DetailRow label="Hired">{formatDate(employee.hireDate)}</DetailRow>
            </dl>
          </CardContent>
        </Card>
        <CurrentPay employee={employee} />
        <div className="lg:col-span-2">
          <HistoryTable employeeId={employee.id} />
        </div>
      </div>

      {payDialogOpen && (
        <PayChangeDialog employee={employee} open={payDialogOpen} onOpenChange={setPayDialogOpen} />
      )}
    </>
  );
}
