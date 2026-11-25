import { Plus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldErrors,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { Field } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { COMPONENT_LABELS, COMPONENT_TYPES, type ComponentType } from '../types';

type ComponentsForm = { components: { type: ComponentType; amount: string }[] };

interface Props<T extends ComponentsForm> {
  control: Control<T, unknown, T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  currency: string | undefined;
  disabled?: boolean;
}

/**
 * Pay components: base salary is always present and can't be removed; bonus
 * and allowance can each be added once. Amounts are annual, in local currency.
 */
export function ComponentsEditor<T extends ComponentsForm>({
  control,
  register,
  errors: formErrors,
  currency,
  disabled,
}: Props<T>) {
  const { fields, append, remove } = useFieldArray<T>({
    control,
    name: 'components' as ArrayPath<T>,
  });
  const errors = formErrors as FieldErrors<ComponentsForm>;
  const items = fields as unknown as ({ id: string } & ComponentsForm['components'][number])[];
  const used = new Set(items.map((f) => f.type));
  const available = COMPONENT_TYPES.filter((t) => !used.has(t));
  const listError = errors.components?.root?.message ?? errors.components?.message;

  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">
        Annual pay{currency ? ` (${currency})` : ''}
      </legend>
      {items.map((field, index) => (
        <div key={field.id} className="flex items-end gap-2">
          <input type="hidden" {...register(`components.${index}.type` as Path<T>)} />
          <Field
            label={COMPONENT_LABELS[field.type]}
            error={
              errors.components?.[index]?.amount?.message ??
              errors.components?.[index]?.type?.message
            }
            className="flex-1"
          >
            <Input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              {...register(`components.${index}.amount` as Path<T>)}
            />
          </Field>
          {field.type !== 'BASE' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${COMPONENT_LABELS[field.type].toLowerCase()}`}
              onClick={() => remove(index)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
      ))}
      {listError && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {listError}
        </p>
      )}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ type, amount: '' } as FieldArray<T, ArrayPath<T>>)}
            >
              <Plus aria-hidden="true" />
              Add {COMPONENT_LABELS[type].toLowerCase()}
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
