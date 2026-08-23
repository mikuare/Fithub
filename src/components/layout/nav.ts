import type { Role } from '@/types';
import { ROLE_RANK } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Minimum role required. Absent means every signed-in user. */
  minRole?: Role;
  exact?: boolean;
  mobile?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  minRole?: Role;
}

export const NAV: NavSection[] = [
  {
    title: 'Fitness',
    items: [
      { to: '/', label: 'Dashboard', icon: 'LayoutDashboard', exact: true, mobile: true },
      { to: '/workout', label: 'Workout', icon: 'Dumbbell', mobile: true },
      { to: '/walk', label: 'Walk Mode', icon: 'Footprints' },
      { to: '/program', label: 'My Program', icon: 'CalendarRange' },
      { to: '/goals', label: 'Goals', icon: 'Target' },
      { to: '/progress', label: 'Progress', icon: 'TrendingUp', mobile: true },
      { to: '/calendar', label: 'Calendar', icon: 'Calendar' },
    ],
  },
  {
    title: 'Health & Lifestyle',
    items: [
      { to: '/recovery', label: 'Recovery', icon: 'BatteryCharging' },
      { to: '/body', label: 'Body Map', icon: 'PersonStanding' },
      { to: '/nutrition', label: 'Nutrition', icon: 'Apple' },
      { to: '/habits', label: 'Healthy Habits', icon: 'CircleCheckBig' },
    ],
  },
  {
    title: 'Discover',
    items: [
      { to: '/exercises', label: 'Exercises', icon: 'BookOpen' },
      { to: '/equipment', label: 'My Equipment', icon: 'Wrench' },
      { to: '/practice', label: 'Practice Builder', icon: 'Sparkles' },
      { to: '/timers', label: 'Timers', icon: 'Timer' },
      { to: '/challenges', label: 'Challenges', icon: 'Flag' },
      { to: '/achievements', label: 'Achievements', icon: 'Award' },
      { to: '/records', label: 'Personal Records', icon: 'Trophy' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/coach', label: 'FitCoach', icon: 'Sparkles', mobile: true },
      { to: '/review', label: 'Weekly Review', icon: 'ClipboardList' },
      { to: '/report', label: 'Monthly Report', icon: 'FileBarChart' },
    ],
  },
  {
    title: 'Community',
    items: [{ to: '/friends', label: 'Friends', icon: 'Users' }],
  },
  {
    title: 'Coaching',
    minRole: 'trainer',
    items: [
      { to: '/trainer', label: 'Clients', icon: 'UserRoundCog', minRole: 'trainer' },
    ],
  },
  {
    title: 'Gym Management',
    minRole: 'staff',
    items: [
      { to: '/admin/attendance', label: 'Attendance', icon: 'ScanLine', minRole: 'staff' },
      { to: '/admin/members', label: 'Members', icon: 'IdCard', minRole: 'staff' },
      { to: '/admin/equipment', label: 'Equipment', icon: 'Wrench', minRole: 'manager' },
      { to: '/admin/analytics', label: 'Gym Analytics', icon: 'ChartNoAxesCombined', minRole: 'manager' },
      { to: '/admin/audit', label: 'Audit Log', icon: 'ScrollText', minRole: 'admin' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/pricing', label: 'Plan & Billing', icon: 'CreditCard' },
      { to: '/profile', label: 'Profile', icon: 'User' },
      { to: '/settings', label: 'Settings', icon: 'Settings' },
    ],
  },
];

export function canAccess(role: Role, minRole?: Role): boolean {
  if (!minRole) return true;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export function visibleSections(role: Role): NavSection[] {
  return NAV
    .filter((s) => canAccess(role, s.minRole))
    .map((s) => ({ ...s, items: s.items.filter((i) => canAccess(role, i.minRole)) }))
    .filter((s) => s.items.length > 0);
}

/** Routes and their required minimum role, for the route guard. */
export const ROUTE_GUARDS: Array<{ prefix: string; minRole: Role }> = [
  { prefix: '/trainer', minRole: 'trainer' },
  { prefix: '/admin/audit', minRole: 'admin' },
  { prefix: '/admin/equipment', minRole: 'manager' },
  { prefix: '/admin/analytics', minRole: 'manager' },
  { prefix: '/admin', minRole: 'staff' },
];

export function guardFor(pathname: string): Role | null {
  const match = ROUTE_GUARDS.find((g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`));
  return match?.minRole ?? null;
}
