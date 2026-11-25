import { BarChart3, LayoutDashboard, Settings, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only match the exact path (for "/"). */
  end?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/settings/fx-rates', label: 'FX rates', icon: Settings },
];
