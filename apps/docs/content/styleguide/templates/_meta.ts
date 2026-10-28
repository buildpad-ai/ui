import type { MetaRecord } from 'nextra';

const meta: MetaRecord = {
  // Whole screens need the full content width; the frames carry their own nav.
  '*': { theme: { layout: 'full', toc: false } },
  'sign-in': 'Sign in',
  'app-shell': 'App shell',
  dashboard: 'Dashboard',
  'list-page': 'List page',
  'record-detail': 'Record detail',
  settings: 'Settings',
  'user-management': 'Users & roles',
};

export default meta;
