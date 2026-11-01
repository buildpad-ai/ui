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
  'app-shell': 'App Shell',
  '--- architecture': {
    type: 'separator',
    title: 'Architecture',
  },
  architecture: 'Architecture',
  'design-system': 'Design System',
  styleguide: 'Styleguide',
  distribution: 'Distribution',
  '--- modules': {
    type: 'separator',
    title: 'Modules',
  },
  content: 'Content',
  files: 'Files',
  forms: 'Forms',
  users: 'Users',
  workflows: 'Workflows',
  cron: 'Cron Jobs',
  '--- reference': {
    type: 'separator',
    title: 'Reference',
  },
  components: 'Component Map',
  '--- contributing': {
    type: 'separator',
    title: 'Contributing',
  },
  testing: 'Testing Guide',
};

export default meta;
