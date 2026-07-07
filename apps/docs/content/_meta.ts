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
  styleguide: 'Styleguide',
  distribution: 'Distribution',
  '--- reference': {
    type: 'separator',
    title: 'Reference',
  },
  components: 'Component Map',
  'app-shell': 'App Shell Recipe',
  files: 'Files Module Recipe',
  forms: 'Forms Module Recipe',
  testing: 'Testing Guide',
};

export default meta;
