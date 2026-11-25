import { Link } from 'react-router';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LEVEL_LABELS } from '@/features/employees/types';
import { formatMoney, formatNumber } from '@/lib/format';
import type {
  CountryBreakdown,
  DepartmentBreakdown,
  HeadcountYear,
  HistogramBucket,
  LevelBreakdown,
} from './api';

const num = 'text-right tabular-nums whitespace-nowrap';

export function CountryTable({ rows }: { rows: CountryBreakdown[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Country</TableHead>
          <TableHead className="text-right">Headcount</TableHead>
          <TableHead className="text-right">Total pay (local)</TableHead>
          <TableHead className="text-right">Total pay (USD)</TableHead>
          <TableHead className="text-right">Median base (local)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.country.code}>
            <TableCell>
              <Link
                to={`/employees?country=${r.country.code}&status=ACTIVE`}
                className="font-medium hover:underline"
              >
                {r.country.name}
              </Link>
            </TableCell>
            <TableCell className={num}>{formatNumber(r.headcount)}</TableCell>
            <TableCell className={num}>{formatMoney(r.totalPay, r.currency)}</TableCell>
            <TableCell className={num}>{formatMoney(r.totalPayUsd, 'USD')}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.median, r.currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DepartmentTable({ rows }: { rows: DepartmentBreakdown[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Department</TableHead>
          <TableHead className="text-right">Headcount</TableHead>
          <TableHead className="text-right">Total pay (USD)</TableHead>
          <TableHead className="text-right">Average base (USD)</TableHead>
          <TableHead className="text-right">Median base (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.department.id}>
            <TableCell>
              <Link
                to={`/employees?department=${r.department.id}&status=ACTIVE`}
                className="font-medium hover:underline"
              >
                {r.department.name}
              </Link>
            </TableCell>
            <TableCell className={num}>{formatNumber(r.headcount)}</TableCell>
            <TableCell className={num}>{formatMoney(r.totalPayUsd, 'USD')}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.average, 'USD')}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.median, 'USD')}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LevelTable({ rows, currency }: { rows: LevelBreakdown[]; currency: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Level</TableHead>
          <TableHead className="text-right">Headcount</TableHead>
          <TableHead className="text-right">Minimum</TableHead>
          <TableHead className="text-right">Median</TableHead>
          <TableHead className="text-right">Average</TableHead>
          <TableHead className="text-right">Maximum</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.level}>
            <TableCell className="font-medium">{LEVEL_LABELS[r.level]}</TableCell>
            <TableCell className={num}>{formatNumber(r.headcount)}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.min, currency)}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.median, currency)}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.average, currency)}</TableCell>
            <TableCell className={num}>{formatMoney(r.base.max, currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DistributionTable({
  rows,
  currency,
}: {
  rows: HistogramBucket[];
  currency: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Base pay range ({currency})</TableHead>
          <TableHead className="text-right">Employees</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.from}>
            <TableCell className="tabular-nums">
              {formatMoney(r.from, currency)} – {formatMoney(r.to, currency)}
            </TableCell>
            <TableCell className={num}>{formatNumber(r.count)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TrendTable({ rows }: { rows: HeadcountYear[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Year joined</TableHead>
          <TableHead className="text-right">Hired</TableHead>
          <TableHead className="text-right">Cumulative headcount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.year}>
            <TableCell>{r.year}</TableCell>
            <TableCell className={num}>{formatNumber(r.hires)}</TableCell>
            <TableCell className={num}>{formatNumber(r.cumulative)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
