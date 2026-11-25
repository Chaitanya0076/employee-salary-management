import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ChartCard } from '@/components/charts/chart-card';
import { RankedBarChart } from '@/components/charts/ranked-bar-chart';
import { TrendChart } from '@/components/charts/trend-chart';
import { PageHeader } from '@/components/page-header';
import { StatTile } from '@/components/stat-tile';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/use-page-title';
import { formatMoney, formatNumber } from '@/lib/format';
import { useByCountry, useByDepartment, useHeadcountTrend, useSummary } from './api';
import { compactUsdTick, countryBars, departmentBars } from './chart-data';
import { CountryTable, DepartmentTable, TrendTable } from './tables';

export function KpiRow({ country, department }: { country?: string; department?: string }) {
  const summary = useSummary({ country, department });
  const s = summary.data;
  const scope = new URLSearchParams({
    ...(country ? { country } : {}),
    ...(department ? { department } : {}),
  }).toString();
  const employeesLink = `/employees?${scope ? `${scope}&` : ''}status=ACTIVE`;
  return (
    <section
      aria-label="Key figures"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatTile
        label="Active employees"
        value={s && formatNumber(s.headcount)}
        loading={summary.isPending}
        to={employeesLink}
      />
      <StatTile
        label="Total annual pay"
        value={s && formatMoney(s.totalPay, 'USD', { compact: true })}
        hint={s ? `${formatMoney(s.totalPay, 'USD')} · USD equivalent` : undefined}
        loading={summary.isPending}
      />
      <StatTile
        label="Average total pay"
        value={s && formatMoney(s.averagePay, 'USD', { compact: true })}
        hint="Per employee, USD equivalent"
        loading={summary.isPending}
      />
      <StatTile
        label="Median total pay"
        value={s && formatMoney(s.medianPay, 'USD', { compact: true })}
        hint="Half earn more, half less"
        loading={summary.isPending}
      />
    </section>
  );
}

export function DashboardPage() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const byCountry = useByCountry();
  const byDepartment = useByDepartment();
  const trend = useHeadcountTrend();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How ACME pays its active employees. Amounts are annual; other currencies are converted to USD with the FX rates."
        actions={
          <Button asChild variant="outline">
            <Link to="/insights">
              All insights <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <KpiRow />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Total pay by country"
            description="Annual total compensation in USD. Select a bar to explore that country."
            query={byCountry}
            isEmpty={byCountry.data?.data.length === 0}
            table={byCountry.data && <CountryTable rows={byCountry.data.data} />}
          >
            {byCountry.data && (
              <RankedBarChart
                data={countryBars(byCountry.data.data)}
                formatTick={compactUsdTick}
                categoryWidth={136}
                onSelect={(bar) => navigate(`/insights?country=${bar.key}`)}
              />
            )}
          </ChartCard>
          <ChartCard
            title="Total pay by department"
            description="Annual total compensation in USD. Select a bar to see the department's employees."
            query={byDepartment}
            isEmpty={byDepartment.data?.data.length === 0}
            table={byDepartment.data && <DepartmentTable rows={byDepartment.data.data} />}
          >
            {byDepartment.data && (
              <RankedBarChart
                data={departmentBars(byDepartment.data.data)}
                formatTick={compactUsdTick}
                categoryWidth={140}
                onSelect={(bar) => navigate(`/employees?department=${bar.key}&status=ACTIVE`)}
              />
            )}
          </ChartCard>
        </div>
        <ChartCard
          title="Headcount growth"
          description="Today's active employees by the year they joined (cumulative)."
          query={trend}
          isEmpty={trend.data?.data.length === 0}
          table={trend.data && <TrendTable rows={trend.data.data} />}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/insights">Details</Link>
            </Button>
          }
        >
          {trend.data && <TrendChart data={trend.data.data} />}
        </ChartCard>
      </div>
    </>
  );
}
