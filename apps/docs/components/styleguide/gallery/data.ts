/**
 * Shared mock data for the styleguide demos and templates.
 *
 * Every template renders the same fictional internal app — "Northwind Ops",
 * an operations workspace built with Buildpad — so the pages read as one
 * product. Reuse these records instead of inventing new ones per page.
 */
import {
  IconBuildingStore,
  IconChartBar,
  IconChecklist,
  IconClock,
  IconFiles,
  IconGitBranch,
  IconHome,
  IconKey,
  IconLayoutGrid,
  IconShieldLock,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react';

export const APP = {
  name: 'Northwind Ops',
  initial: 'N',
  workspace: 'Operations workspace',
} as const;

export type Status = 'active' | 'invited' | 'suspended';
export type Role = 'Administrator' | 'Editor' | 'Viewer' | 'Approver';

export interface MockUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  status: Status;
  lastActive: string;
  team: string;
}

export const USERS: MockUser[] = [
  { id: 'u1', name: 'Amelia Hart', initials: 'AH', email: 'amelia.hart@northwind.io', role: 'Administrator', status: 'active', lastActive: '2 min ago', team: 'Platform' },
  { id: 'u2', name: 'Daniel Osei', initials: 'DO', email: 'daniel.osei@northwind.io', role: 'Editor', status: 'active', lastActive: '18 min ago', team: 'Fulfilment' },
  { id: 'u3', name: 'Priya Raman', initials: 'PR', email: 'priya.raman@northwind.io', role: 'Approver', status: 'active', lastActive: '1 hour ago', team: 'Finance' },
  { id: 'u4', name: 'Marco Silva', initials: 'MS', email: 'marco.silva@northwind.io', role: 'Editor', status: 'invited', lastActive: '—', team: 'Procurement' },
  { id: 'u5', name: 'Hana Kobayashi', initials: 'HK', email: 'hana.k@northwind.io', role: 'Viewer', status: 'active', lastActive: 'Yesterday', team: 'Support' },
  { id: 'u6', name: 'Tom Becker', initials: 'TB', email: 'tom.becker@northwind.io', role: 'Viewer', status: 'suspended', lastActive: '3 weeks ago', team: 'Fulfilment' },
];

/** The signed-in user shown in shells, menus and comments. */
export const CURRENT_USER = USERS[0];

export type OrderStatus = 'draft' | 'pending' | 'approved' | 'shipped' | 'cancelled';

export interface MockOrder {
  id: string;
  number: string;
  supplier: string;
  category: string;
  owner: MockUser;
  amount: number;
  status: OrderStatus;
  updated: string;
  due: string;
}

export const ORDERS: MockOrder[] = [
  { id: 'o1', number: 'PO-2041', supplier: 'Atlas Packaging', category: 'Packaging', owner: USERS[1], amount: 12840, status: 'pending', updated: 'Today, 09:42', due: '04 Nov' },
  { id: 'o2', number: 'PO-2040', supplier: 'Keystone Logistics', category: 'Freight', owner: USERS[2], amount: 48200, status: 'approved', updated: 'Today, 08:15', due: '31 Oct' },
  { id: 'o3', number: 'PO-2039', supplier: 'Brightline Electrical', category: 'Facilities', owner: USERS[3], amount: 3150, status: 'draft', updated: 'Yesterday', due: '12 Nov' },
  { id: 'o4', number: 'PO-2038', supplier: 'Meridian Foods', category: 'Catering', owner: USERS[1], amount: 7425, status: 'shipped', updated: '26 Oct', due: '28 Oct' },
  { id: 'o5', number: 'PO-2037', supplier: 'Cobalt IT Services', category: 'Software', owner: USERS[0], amount: 21600, status: 'approved', updated: '25 Oct', due: '30 Oct' },
  { id: 'o6', number: 'PO-2036', supplier: 'Harbor Office Supply', category: 'Office', owner: USERS[4], amount: 980, status: 'cancelled', updated: '24 Oct', due: '—' },
  { id: 'o7', number: 'PO-2035', supplier: 'Atlas Packaging', category: 'Packaging', owner: USERS[1], amount: 15300, status: 'shipped', updated: '22 Oct', due: '23 Oct' },
];

/** Three older orders, so list views can fill a first page of 10. */
export const EXTRA_ORDERS: MockOrder[] = [
  { id: 'o8', number: 'PO-2034', supplier: 'Harbor Office Supply', category: 'Office', owner: USERS[4], amount: 1240, status: 'approved', updated: '21 Oct', due: '25 Oct' },
  { id: 'o9', number: 'PO-2033', supplier: 'Keystone Logistics', category: 'Freight', owner: USERS[2], amount: 36900, status: 'shipped', updated: '20 Oct', due: '21 Oct' },
  { id: 'o10', number: 'PO-2032', supplier: 'Northgate Workwear', category: 'Uniforms', owner: USERS[3], amount: 5480, status: 'pending', updated: '19 Oct', due: '06 Nov' },
];

/** The first page of the orders list: every mock order, newest first. */
export const PAGE_ORDERS: MockOrder[] = [...ORDERS, ...EXTRA_ORDERS];

/** Mantine colour (aliased to the semantic scales by theme.ts) per status. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  pending: { label: 'Pending approval', color: 'yellow' },
  approved: { label: 'Approved', color: 'blue' },
  shipped: { label: 'Shipped', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};

export const USER_STATUS: Record<Status, { label: string; color: string }> = {
  active: { label: 'Active', color: 'green' },
  invited: { label: 'Invited', color: 'blue' },
  suspended: { label: 'Suspended', color: 'red' },
};

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export interface MockActivity {
  id: string;
  user: MockUser;
  action: string;
  target: string;
  time: string;
}

export const ACTIVITY: MockActivity[] = [
  { id: 'a1', user: USERS[2], action: 'approved', target: 'PO-2040 · Keystone Logistics', time: '12 min ago' },
  { id: 'a2', user: USERS[1], action: 'submitted', target: 'PO-2041 · Atlas Packaging', time: '1 hour ago' },
  { id: 'a3', user: USERS[0], action: 'invited', target: 'Marco Silva to Procurement', time: '3 hours ago' },
  { id: 'a4', user: USERS[4], action: 'commented on', target: 'PO-2038 · Meridian Foods', time: 'Yesterday' },
];

export const KPIS = [
  { label: 'Open purchase orders', value: '128', delta: '+12', trend: 'up' as const, hint: 'vs. last week' },
  { label: 'Spend this month', value: '$412,380', delta: '+4.1%', trend: 'up' as const, hint: 'of $520k budget' },
  { label: 'Avg. approval time', value: '6.4 h', delta: '-1.2 h', trend: 'down' as const, hint: 'faster than target' },
  { label: 'Overdue deliveries', value: '7', delta: '+2', trend: 'up' as const, hint: 'needs attention' },
];

/** Monthly spend for simple bar/sparkline renderings (thousands of USD). */
export const MONTHLY_SPEND = [
  { month: 'May', value: 318 },
  { month: 'Jun', value: 352 },
  { month: 'Jul', value: 336 },
  { month: 'Aug', value: 389 },
  { month: 'Sep', value: 396 },
  { month: 'Oct', value: 412 },
];

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  section?: string;
  badge?: string;
}

/** Sidebar navigation, shaped like the CLI's components/layout/navigation.ts. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconHome },
  { label: 'Purchase orders', href: '/orders', icon: IconChecklist, badge: '12' },
  { label: 'Suppliers', href: '/suppliers', icon: IconBuildingStore },
  { label: 'Content', href: '/content', icon: IconLayoutGrid },
  { label: 'Files', href: '/files', icon: IconFiles },
  { label: 'Reports', href: '/reports', icon: IconChartBar },
  { label: 'Users', href: '/users', icon: IconUsers, section: 'Administration' },
  { label: 'Roles', href: '/roles', icon: IconUsersGroup, section: 'Administration' },
  { label: 'Policies', href: '/policies', icon: IconShieldLock, section: 'Administration' },
  { label: 'Workflows', href: '/workflows', icon: IconGitBranch, section: 'Administration' },
  { label: 'Cron jobs', href: '/cron', icon: IconClock, section: 'Administration' },
  { label: 'Access keys', href: '/module-access-keys', icon: IconKey, section: 'Administration' },
];
