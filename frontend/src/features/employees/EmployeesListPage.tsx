import { Download, Plus, RotateCw, UserX } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { exportCsvUrl, useEmployeeList } from './api';
import { EmployeeFilters } from './components/EmployeeFilters';
import { PaginationBar } from './components/PaginationBar';
import { SortableHead } from './components/SortableHead';
import { StatusBadge } from './components/StatusBadge';
import { hasActiveFilters, type SortDirection, type SortField } from './list-params';
import { useListParams } from './use-list-params';

const COLUMN_COUNT = 7;

function SkeletonRows({ rows }: { rows: number }) {
  return Array.from({ length: rows }, (_, i) => (
    <TableRow key={i}>
      {Array.from({ length: COLUMN_COUNT }, (_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-4 w-full max-w-32" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export function EmployeesListPage() {
  usePageTitle('Employees');
  const { params, update, reset } = useListParams();
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useEmployeeList(params);

  const onSort = (sort: SortField, direction: SortDirection) => update({ sort, direction });
  const sortProps = { sort: params.sort, direction: params.direction, onSort };

  return (
    <>
      <PageHeader
        title="Employees"
        description="Search, filter and manage employees and their pay."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href={exportCsvUrl(params)} download>
                <Download aria-hidden="true" />
                Export CSV
              </a>
            </Button>
            <Button asChild>
              <Link to="/employees/new">
                <Plus aria-hidden="true" />
                New employee
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="gap-4 p-4">
        <EmployeeFilters params={params} onChange={update} onReset={reset} />

        {isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-medium">Couldn't load employees</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <Button variant="outline" onClick={() => void refetch()}>
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : (
          <div
            className={cn('transition-opacity', isFetching && isPlaceholderData && 'opacity-60')}
            aria-busy={isFetching}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" label="Employee" {...sortProps} />
                  <TableHead>Department</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Level</TableHead>
                  <SortableHead field="hireDate" label="Hired" {...sortProps} />
                  <SortableHead
                    field="baseSalary"
                    label="Base salary"
                    className="text-right"
                    descFirst
                    {...sortProps}
                  />
                  <SortableHead
                    field="totalUsd"
                    label="Total (USD)"
                    className="text-right"
                    descFirst
                    {...sortProps}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <SkeletonRows rows={8} />
                ) : data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <UserX className="size-6 text-muted-foreground" aria-hidden="true" />
                        <p className="font-medium">No employees found</p>
                        <p className="text-sm text-muted-foreground">
                          {hasActiveFilters(params)
                            ? 'Try a different search or clear the filters.'
                            : 'Add your first employee to get started.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          to={`/employees/${e.id}`}
                          className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {e.firstName} {e.lastName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {e.employeeCode} · {e.jobTitle}
                        </div>
                      </TableCell>
                      <TableCell>{e.department.name}</TableCell>
                      <TableCell>{e.country.name}</TableCell>
                      <TableCell>
                        <span className="tabular-nums">{e.level}</span>
                        {e.status === 'INACTIVE' && (
                          <span className="ml-2">
                            <StatusBadge status={e.status} />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(e.hireDate)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {e.pay ? formatMoney(e.pay.base, e.pay.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {e.pay ? formatMoney(e.pay.totalUsd, 'USD') : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <PaginationBar
            meta={data.meta}
            onPage={(page) => update({ page })}
            onPageSize={(pageSize) => update({ pageSize })}
          />
        )}
      </Card>
    </>
  );
}
