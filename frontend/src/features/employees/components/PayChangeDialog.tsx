import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Field, FormAlert } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { todayIso } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/format';
import { applyServerErrors } from '@/lib/form-errors';
import { changeBetween, MONEY_PATTERN, sumAmounts } from '@/lib/money';
import { useChangePay } from '../api';
import { payChangeSchema, type PayChangeForm } from '../schemas';
import type { CompensationRecord, EmployeeDetail } from '../types';
import { ComponentsEditor } from './ComponentsEditor';

interface Props {
  employee: EmployeeDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Injected in tests; defaults to the user's local date. */
  today?: string;
}

const FIELDS = ['effectiveFrom', 'components', 'reason'] as const;

function defaultsFrom(current: CompensationRecord | null, today: string): PayChangeForm {
  return {
    effectiveFrom: today,
    components: current?.components.map((c) => ({ type: c.type, amount: c.amount })) ?? [
      { type: 'BASE', amount: '' },
    ],
    reason: '',
  };
}

function ChangeLine({
  label,
  before,
  after,
  currency,
}: {
  label: string;
  before: string;
  after: string;
  currency: string;
}) {
  const change = changeBetween(before, after);
  const tone = change.amount.startsWith('-')
    ? 'text-destructive'
    : change.amount === '0.00'
      ? 'text-muted-foreground'
      : 'text-emerald-600';
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {formatMoney(before, currency)} →{' '}
        <span className="font-medium">{formatMoney(after, currency)}</span>{' '}
        <span className={tone}>
          ({change.amount.startsWith('-') ? '' : '+'}
          {formatMoney(change.amount, currency)}
          {change.percent !== null && `, ${formatPercent(change.percent)}`})
        </span>
      </dd>
    </div>
  );
}

/** Records a pay change, previewing the difference from current pay before submitting. */
export function PayChangeDialog({ employee, open, onOpenChange, today = todayIso() }: Props) {
  const current = employee.currentCompensation;
  const currency = employee.country.currency;
  const schema = useMemo(
    () => payChangeSchema(today, current?.effectiveFrom ?? null),
    [today, current],
  );
  const form = useForm<PayChangeForm>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFrom(current, today),
  });
  const changePay = useChangePay(employee.id);
  const [formError, setFormError] = useState<string | null>(null);

  const components = useWatch({ control: form.control, name: 'components' });
  const preview = useMemo(() => {
    if (!current || !components?.every((c) => MONEY_PATTERN.test(c.amount?.trim() ?? '')))
      return null;
    const base = components.find((c) => c.type === 'BASE')?.amount.trim();
    if (!base) return null;
    return { base, total: sumAmounts(components.map((c) => c.amount.trim())) };
  }, [components, current]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(defaultsFrom(current, today));
      setFormError(null);
      changePay.reset();
    }
    onOpenChange(next);
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    changePay.mutate(
      {
        effectiveFrom: values.effectiveFrom,
        components: values.components.map((c) => ({ type: c.type, amount: c.amount.trim() })),
        ...(values.reason.trim() ? { reason: values.reason.trim() } : {}),
      },
      {
        onSuccess: ({ change }) => {
          const sign = change.total.amount.startsWith('-') ? '' : '+';
          const pct =
            change.total.percent !== null ? ` (${formatPercent(change.total.percent)})` : '';
          toast.success('Pay change recorded', {
            description: `${employee.firstName} ${employee.lastName}: total pay ${sign}${formatMoney(change.total.amount, currency)}${pct}`,
          });
          handleOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setFormError(error.message);
            return;
          }
          setFormError(applyServerErrors(error, form.setError, FIELDS));
        },
      },
    );
  });

  const { errors } = form.formState;
  const submitting = changePay.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record pay change</DialogTitle>
          <DialogDescription>
            {employee.firstName} {employee.lastName}'s new pay replaces the current pay from the
            effective date. Earlier pay is kept in the history.
          </DialogDescription>
        </DialogHeader>

        <form id="pay-change-form" className="grid gap-4" onSubmit={onSubmit} noValidate>
          {formError && <FormAlert>{formError}</FormAlert>}
          <Field
            label="Effective from"
            error={errors.effectiveFrom?.message}
            hint={current ? `After ${current.effectiveFrom}, and not in the future.` : undefined}
          >
            <Input
              type="date"
              max={today}
              disabled={submitting}
              {...form.register('effectiveFrom')}
            />
          </Field>
          <ComponentsEditor
            control={form.control}
            register={form.register}
            errors={errors}
            currency={currency}
            disabled={submitting}
          />
          <Field label="Reason (optional)" error={errors.reason?.message}>
            <Textarea
              rows={2}
              placeholder="e.g. Annual review"
              disabled={submitting}
              {...form.register('reason')}
            />
          </Field>

          {current && preview && (
            <section
              aria-label="Change from current pay"
              className="rounded-md border bg-muted/40 p-3"
            >
              <h3 className="mb-2 text-sm font-medium">Change from current pay</h3>
              <dl className="grid gap-1">
                <ChangeLine
                  label="Base salary"
                  before={current.base}
                  after={preview.base}
                  currency={currency}
                />
                <ChangeLine
                  label="Total pay"
                  before={current.total}
                  after={preview.total}
                  currency={currency}
                />
              </dl>
            </section>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="pay-change-form" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submitting ? 'Saving…' : 'Record change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
