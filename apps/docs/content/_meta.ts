import type { MetaRecord } from 'nextra';

const meta: MetaRecord = {
  index: 'Introduction',
  '--- getting-started': {
    type: 'separator',
    title: 'Getting Started',
  },
  installation: 'Installation',
  cli: 'CLI',
  mcp: 'MCP',
  '--- architecture': {
    type: 'separator',
    title: 'Architecture',
  },
  architecture: 'Architecture',
  'design-system': 'Design System',
  distribution: 'Distribution',
  'promoting-changes-between-environments': 'Promoting Changes Between Environments',
  '--- reference': {
    type: 'separator',
    title: 'Reference',
  },

  components: 'Component Map',
  'app-shell': 'App Shell Recipe',
  files: 'Files Module Recipe',
  forms: 'Forms Module Recipe',
  users: 'Users Module Recipe',
  testing: 'Testing Guide',
};

export default meta;
