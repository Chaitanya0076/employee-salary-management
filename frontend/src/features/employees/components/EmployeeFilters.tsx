import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useCountries, useDepartments } from '@/features/reference/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { hasActiveFilters, type EmployeeListParams } from '../list-params';
import { LEVEL_LABELS, LEVELS, STATUSES } from '../types';

type FilterKey = 'country' | 'department' | 'level' | 'status';

interface Props {
  params: EmployeeListParams;
  onChange: (changes: Partial<EmployeeListParams>) => void;
  onReset: () => void;
}

export const SEARCH_DEBOUNCE_MS = 300;

export function EmployeeFilters({ params, onChange, onReset }: Props) {
  const { data: countries = [] } = useCountries();
  const { data: departments = [] } = useDepartments();

  // The input updates instantly; the URL (and the request) only after typing pauses.
  const [search, setSearch] = useState(params.q);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedSearch.trim() !== params.q.trim()) onChange({ q: debouncedSearch });
    // Only react to the debounced value; params.q changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  // Keep the input in sync when the URL changes from outside (reset, back button).
  // Adjusting state during render is React's recommended alternative to an effect here.
  const [syncedQ, setSyncedQ] = useState(params.q);
  if (params.q !== syncedQ) {
    setSyncedQ(params.q);
    if (search.trim() !== params.q.trim()) setSearch(params.q);
  }

  const select = (key: FilterKey, label: string, options: { value: string; label: string }[]) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`filter-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect
        id={`filter-${key}`}
        value={params[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        className="md:w-44"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter employees">
      <div className="grid min-w-56 flex-1 gap-1.5">
        <Label htmlFor="employee-search" className="text-xs text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="employee-search"
            type="search"
            placeholder="Name, email or employee code"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>
      {select(
        'country',
        'Country',
        countries.map((c) => ({ value: c.code, label: c.name })),
      )}
      {select(
        'department',
        'Department',
        departments.map((d) => ({ value: String(d.id), label: d.name })),
      )}
      {select(
        'level',
        'Level',
        LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] })),
      )}
      {select(
        'status',
        'Status',
        STATUSES.map((s) => ({ value: s, label: s === 'ACTIVE' ? 'Active' : 'Inactive' })),
      )}
      {hasActiveFilters(params) && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch('');
            onReset();
          }}
        >
          <X aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
