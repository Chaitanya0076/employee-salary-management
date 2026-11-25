import { Lock, Pencil } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ChartCard } from '@/components/charts/chart-card';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFxRates, useUpdateFxRate, type FxRate } from '@/features/reference/api';
import { usePageTitle } from '@/hooks/use-page-title';
import { ApiError } from '@/lib/api-client';
import { DEFAULT_LOCALE } from '@/lib/format';
import { inverseRate, REPORTING_CURRENCY, trimRate, validateRate } from './fx-rate';

const formatUpdated = (iso: string) =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

function RateRow({ rate }: { rate: FxRate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(trimRate(rate.rateToUsd));
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateFxRate();
  const errorId = useId();
  const locked = rate.currency === REPORTING_CURRENCY;

  function cancel() {
    setEditing(false);
    setValue(trimRate(rate.rateToUsd));
    setError(null);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const problem = validateRate(value);
    if (problem) {
      setError(problem);
      return;
    }
    update.mutate(
      { currency: rate.currency, rateToUsd: value.trim() },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.currency} rate updated`, {
            description: `1 ${updated.currency} = ${trimRate(updated.rateToUsd)} USD. Insights now use the new rate.`,
          });
          setEditing(false);
          setError(null);
        },
        onError: (err) =>
          setError(
            err instanceof ApiError
              ? (Object.values(err.fieldErrors())[0] ?? err.message)
              : 'Could not save the rate',
          ),
      },
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {rate.currency}
        {locked && (
          <Badge variant="secondary" className="ml-2">
            <Lock aria-hidden="true" /> Reporting currency
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {editing ? (
          <form onSubmit={save} className="flex items-start justify-end gap-2" noValidate>
            <div className="grid gap-1 text-left">
              <Input
                aria-label={`Rate to USD for ${rate.currency}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                inputMode="decimal"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && cancel()}
                disabled={update.isPending}
                className="h-8 w-32 text-right"
              />
              {error && (
                <p id={errorId} className="text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={update.isPending}
            >
              Cancel
            </Button>
          </form>
        ) : (
          trimRate(rate.rateToUsd)
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground tabular-nums">
        {locked ? '—' : `${inverseRate(rate.rateToUsd)} ${rate.currency}`}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatUpdated(rate.updatedAt)}
      </TableCell>
      <TableCell className="text-right">
        {!locked && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${rate.currency} rate`}
          >
            <Pencil aria-hidden="true" /> Edit
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function FxRatesPage() {
  usePageTitle('FX rates');
  const rates = useFxRates();

  return (
    <>
      <PageHeader
        title="FX rates"
        description="Static exchange rates used only to compare pay in USD. Salaries stay stored in local currency."
      />
      <ChartCard
        title="Rates to USD"
        description="How many US dollars one unit of each currency is worth. Changes apply to all insights immediately."
        query={rates}
        isEmpty={rates.data?.length === 0}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">1 unit in USD</TableHead>
              <TableHead className="text-right">1 USD buys</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.data?.map((rate) => (
              <RateRow key={rate.currency} rate={rate} />
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </>
  );
}
