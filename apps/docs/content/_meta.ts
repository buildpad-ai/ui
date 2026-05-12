import type { MetaRecord } from 'nextra';

const meta: MetaRecord = {
  index: 'Introduction',
  '--- getting-started': {
    type: 'separator',
    title: 'Getting Started',
  },
  installation: 'Installation',
  cli: 'CLI',
  mcp: 'MCP Server',
  '--- architecture': {
    type: 'separator',
    title: 'Architecture',
  },
  architecture: 'Architecture',
  'design-system': 'Design System',
  distribution: 'Distribution',
  '--- reference': {
    type: 'separator',
    title: 'Reference',
  },
  components: 'Component Map',
  testing: 'Testing Guide',
};

export default meta;
