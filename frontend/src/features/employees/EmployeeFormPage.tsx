import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Field, FormAlert } from '@/components/form-field';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountries, useDepartments } from '@/features/reference/api';
import { usePageTitle } from '@/hooks/use-page-title';
import { ApiError } from '@/lib/api-client';
import { todayIso } from '@/lib/dates';
import { applyServerErrors } from '@/lib/form-errors';
import { NotFoundPage } from '@/pages';
import { useCreateEmployee, useEmployee, useUpdateEmployee } from './api';
import { ComponentsEditor } from './components/ComponentsEditor';
import {
  createEmployeeSchema,
  editEmployeeSchema,
  type CreateEmployeeForm,
  type EditEmployeeForm,
} from './schemas';
import { LEVEL_LABELS, LEVELS, type EmployeeDetail } from './types';

function DepartmentOptions() {
  const { data: departments = [] } = useDepartments();
  return (
    <>
      <option value="">Select a department</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </>
  );
}

function LevelOptions() {
  return (
    <>
      <option value="">Select a level</option>
      {LEVELS.map((l) => (
        <option key={l} value={l}>
          {LEVEL_LABELS[l]}
        </option>
      ))}
    </>
  );
}

const CREATE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'jobTitle',
  'level',
  'departmentId',
  'hireDate',
  'countryCode',
  'components',
] as const;

export function CreateEmployeeForm({ today = todayIso() }: { today?: string }) {
  const navigate = useNavigate();
  const { data: countries = [] } = useCountries();
  const schema = useMemo(() => createEmployeeSchema(today), [today]);
  const form = useForm<CreateEmployeeForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      jobTitle: '',
      level: '' as CreateEmployeeForm['level'],
      departmentId: '',
      hireDate: today,
      countryCode: '',
      components: [{ type: 'BASE', amount: '' }],
    },
  });
  const create = useCreateEmployee();
  const [formError, setFormError] = useState<string | null>(null);
  const countryCode = useWatch({ control: form.control, name: 'countryCode' });
  const currency = countries.find((c) => c.code === countryCode)?.currency;
  const { errors } = form.formState;
  const submitting = create.isPending;

  const onSubmit = form.handleSubmit(({ components, departmentId, ...values }) => {
    setFormError(null);
    create.mutate(
      {
        ...values,
        departmentId: Number(departmentId),
        compensation: {
          components: components.map((c) => ({ type: c.type, amount: c.amount.trim() })),
        },
      },
      {
        onSuccess: (employee) => {
          toast.success(`${employee.firstName} ${employee.lastName} added`, {
            description: employee.employeeCode,
          });
          navigate(`/employees/${employee.id}`);
        },
        onError: (error) =>
          setFormError(
            applyServerErrors(error, form.setError, CREATE_FIELDS, {
              'compensation.components': 'components',
            }),
          ),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6" aria-busy={submitting}>
      {formError && <FormAlert>{formError}</FormAlert>}
      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2" disabled={submitting}>
        <legend className="sr-only">Profile</legend>
        <Field label="First name" error={errors.firstName?.message}>
          <Input autoComplete="off" {...form.register('firstName')} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input autoComplete="off" {...form.register('lastName')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...form.register('email')} />
        </Field>
        <Field label="Job title" error={errors.jobTitle?.message}>
          <Input autoComplete="off" {...form.register('jobTitle')} />
        </Field>
        <Field label="Department" error={errors.departmentId?.message}>
          <NativeSelect {...form.register('departmentId')}>
            <DepartmentOptions />
          </NativeSelect>
        </Field>
        <Field label="Level" error={errors.level?.message}>
          <NativeSelect {...form.register('level')}>
            <LevelOptions />
          </NativeSelect>
        </Field>
        <Field
          label="Country"
          error={errors.countryCode?.message}
          hint="Sets the pay currency. It can't be changed later."
        >
          <NativeSelect {...form.register('countryCode')}>
            <option value="">Select a country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.currency})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Hire date"
          error={errors.hireDate?.message}
          hint="Starting pay takes effect on this date."
        >
          <Input type="date" max={today} {...form.register('hireDate')} />
        </Field>
      </fieldset>
      <ComponentsEditor
        control={form.control}
        register={form.register}
        errors={errors}
        currency={currency}
        disabled={submitting}
      />
      <FormActions submitting={submitting} submitLabel="Create employee" cancelTo="/employees" />
    </form>
  );
}

const EDIT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'jobTitle',
  'level',
  'departmentId',
] as const;

export function EditEmployeeForm({ employee }: { employee: EmployeeDetail }) {
  const navigate = useNavigate();
  const form = useForm<EditEmployeeForm>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      jobTitle: employee.jobTitle,
      level: employee.level,
      departmentId: String(employee.department.id),
    },
  });
  const update = useUpdateEmployee(employee.id);
  const [formError, setFormError] = useState<string | null>(null);
  const { errors, dirtyFields } = form.formState;
  const submitting = update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    // Send only what changed.
    const changes = Object.fromEntries(
      Object.entries(values).filter(([key]) => dirtyFields[key as keyof EditEmployeeForm]),
    ) as Partial<EditEmployeeForm>;
    if (Object.keys(changes).length === 0) {
      navigate(`/employees/${employee.id}`);
      return;
    }
    const { departmentId, ...rest } = changes;
    update.mutate(
      { ...rest, ...(departmentId !== undefined ? { departmentId: Number(departmentId) } : {}) },
      {
        onSuccess: () => {
          toast.success('Changes saved');
          navigate(`/employees/${employee.id}`);
        },
        onError: (error) => setFormError(applyServerErrors(error, form.setError, EDIT_FIELDS)),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6" aria-busy={submitting}>
      {formError && <FormAlert>{formError}</FormAlert>}
      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2" disabled={submitting}>
        <legend className="sr-only">Profile</legend>
        <Field label="First name" error={errors.firstName?.message}>
          <Input autoComplete="off" {...form.register('firstName')} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input autoComplete="off" {...form.register('lastName')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...form.register('email')} />
        </Field>
        <Field label="Job title" error={errors.jobTitle?.message}>
          <Input autoComplete="off" {...form.register('jobTitle')} />
        </Field>
        <Field label="Department" error={errors.departmentId?.message}>
          <NativeSelect {...form.register('departmentId')}>
            <DepartmentOptions />
          </NativeSelect>
        </Field>
        <Field label="Level" error={errors.level?.message}>
          <NativeSelect {...form.register('level')}>
            <LevelOptions />
          </NativeSelect>
        </Field>
        <Field label="Country" hint="Locked: pay history is recorded in this country's currency.">
          <Input
            value={`${employee.country.name} (${employee.country.currency})`}
            disabled
            readOnly
          />
        </Field>
        <Field label="Hire date" hint="Locked: starting pay is dated from it.">
          <Input value={employee.hireDate} disabled readOnly />
        </Field>
      </fieldset>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        Pay is changed from the employee page with “Record pay change”, so the history is kept.
      </p>
      <FormActions
        submitting={submitting}
        submitLabel="Save changes"
        cancelTo={`/employees/${employee.id}`}
      />
    </form>
  );
}

function FormActions({
  submitting,
  submitLabel,
  cancelTo,
}: {
  submitting: boolean;
  submitLabel: string;
  cancelTo: string;
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {submitting ? 'Saving…' : submitLabel}
      </Button>
      <Button asChild variant="outline">
        <Link to={cancelTo}>Cancel</Link>
      </Button>
    </div>
  );
}

export function NewEmployeePage() {
  usePageTitle('New employee');
  return (
    <>
      <BackLink to="/employees" label="All employees" />
      <PageHeader title="New employee" description="Add a person and their starting pay." />
      <Card>
        <CardContent>
          <CreateEmployeeForm />
        </CardContent>
      </Card>
    </>
  );
}

export function EditEmployeePage() {
  const id = Number(useParams().id);
  const { data: employee, isPending, error } = useEmployee(id);
  usePageTitle(employee ? `Edit ${employee.firstName} ${employee.lastName}` : 'Edit employee');

  if (!Number.isInteger(id) || id <= 0 || (error instanceof ApiError && error.status === 404))
    return <NotFoundPage />;
  if (error) return <FormAlert>{error.message}</FormAlert>;
  if (isPending) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      <BackLink
        to={`/employees/${employee.id}`}
        label={`${employee.firstName} ${employee.lastName}`}
      />
      <PageHeader
        title={`Edit ${employee.firstName} ${employee.lastName}`}
        description={employee.employeeCode}
      />
      <Card>
        <CardContent>
          <EditEmployeeForm employee={employee} />
        </CardContent>
      </Card>
    </>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link to={to}>
        <ArrowLeft aria-hidden="true" /> {label}
      </Link>
    </Button>
  );
}
