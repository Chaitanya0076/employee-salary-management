import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

/** Primary navigation; NavLink sets aria-current="page" on the active item. */
export function MainNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      <ul className="grid gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
