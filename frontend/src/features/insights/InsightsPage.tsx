import { X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ChartCard } from '@/components/charts/chart-card';
import { HistogramChart } from '@/components/charts/histogram-chart';
import { RankedBarChart } from '@/components/charts/ranked-bar-chart';
import { TrendChart } from '@/components/charts/trend-chart';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useCountries, useDepartments } from '@/features/reference/api';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  useByCountry,
  useByDepartment,
  useByLevel,
  useDistribution,
  useHeadcountTrend,
} from './api';
import { compactUsdTick, departmentBars, histogramBins } from './chart-data';
import { KpiRow } from './DashboardPage';
import { BUCKET_OPTIONS, useInsightParams } from './insight-params';
import { CountryTable, DepartmentTable, DistributionTable, LevelTable, TrendTable } from './tables';

export function InsightsPage() {
  usePageTitle('Insights');
  const navigate = useNavigate();
  const { params, update } = useInsightParams();
  const { data: countries = [] } = useCountries();
  const { data: departments = [] } = useDepartments();
  const filters = {
    country: params.country || undefined,
    department: params.department || undefined,
  };

  const byCountry = useByCountry({ department: filters.department });
  const byDepartment = useByDepartment({ country: filters.country });
  const byLevel = useByLevel(filters);
  const distribution = useDistribution(filters, params.buckets);
  const trend = useHeadcountTrend(filters);

  const countryName = countries.find((c) => c.code === params.country)?.name;
  // The country endpoint can't filter by country itself; narrow the rows here.
  const countryRows =
    byCountry.data?.data.filter((r) => !params.country || r.country.code === params.country) ?? [];
  const levelCurrency = byLevel.data?.currency ?? (params.country ? '' : 'USD');
  const distributionCurrency = distribution.data?.currency ?? 'USD';
  const currencyNote = (currency: string) =>
    params.country
      ? `in ${countryName ?? params.country}'s currency (${currency})`
      : 'as USD equivalents, so countries are comparable';

  return (
    <>
      <PageHeader
        title="Insights"
        description="How ACME pays active employees, by country, department and level."
      />

      <div
        className="mb-6 flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter insights"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="insights-country" className="text-xs text-muted-foreground">
            Country
          </Label>
          <NativeSelect
            id="insights-country"
            value={params.country}
            onChange={(e) => update({ country: e.target.value })}
            className="w-48"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insights-department" className="text-xs text-muted-foreground">
            Department
          </Label>
          <NativeSelect
            id="insights-department"
            value={params.department}
            onChange={(e) => update({ department: e.target.value })}
            className="w-48"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {(params.country || params.department) && (
          <Button variant="ghost" onClick={() => update({ country: '', department: '' })}>
            <X aria-hidden="true" /> Clear filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <KpiRow country={filters.country} department={filters.department} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Pay by country"
            description="Headcount and annual total pay in local currency and USD."
            query={byCountry}
            isEmpty={countryRows.length === 0}
          >
            <CountryTable rows={countryRows} />
          </ChartCard>
          <ChartCard
            title="Total pay by department"
            description="Annual total compensation in USD."
            query={byDepartment}
            isEmpty={byDepartment.data?.data.length === 0}
            table={byDepartment.data && <DepartmentTable rows={byDepartment.data.data} />}
          >
            {byDepartment.data && (
              <RankedBarChart
                data={departmentBars(byDepartment.data.data)}
                formatTick={compactUsdTick}
                categoryWidth={140}
                onSelect={(bar) =>
                  navigate(
                    `/employees?department=${bar.key}&status=ACTIVE${params.country ? `&country=${params.country}` : ''}`,
                  )
                }
              />
            )}
          </ChartCard>
        </div>

        <ChartCard
          title={`Base pay by level${levelCurrency ? ` (${levelCurrency})` : ''}`}
          description={`Base salary ranges per level, ${currencyNote(levelCurrency)}.`}
          query={byLevel}
          isEmpty={byLevel.data?.data.length === 0}
        >
          {byLevel.data && <LevelTable rows={byLevel.data.data} currency={byLevel.data.currency} />}
        </ChartCard>

        <ChartCard
          title={`Base pay distribution (${distributionCurrency})`}
          description={`How many employees earn each base salary range, ${currencyNote(distributionCurrency)}.`}
          query={distribution}
          isEmpty={distribution.data?.data.length === 0}
          action={
            <div className="flex items-center gap-2">
              <Label htmlFor="insights-buckets" className="text-xs text-muted-foreground">
                Ranges
              </Label>
              <NativeSelect
                id="insights-buckets"
                value={params.buckets}
                onChange={(e) => update({ buckets: Number(e.target.value) })}
                className="w-20"
              >
                {BUCKET_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </div>
          }
          table={
            distribution.data && (
              <DistributionTable
                rows={distribution.data.data}
                currency={distribution.data.currency}
              />
            )
          }
        >
          {distribution.data && (
            <HistogramChart
              data={histogramBins(distribution.data.data, distribution.data.currency)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Headcount growth"
          description="Today's active employees by the year they joined. There's no leave date in the data, so this shows how the current workforce built up rather than historical headcount."
          query={trend}
          isEmpty={trend.data?.data.length === 0}
          table={trend.data && <TrendTable rows={trend.data.data} />}
        >
          {trend.data && <TrendChart data={trend.data.data} />}
        </ChartCard>
      </div>
    </>
  );
}
