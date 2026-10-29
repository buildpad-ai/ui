import type { Meta, StoryObj } from '@storybook/react';
import { ListM2M } from '../';

const meta: Meta<typeof ListM2M> = {
  title: 'Interfaces/ListM2M',
  component: ListM2M,
  tags: ['!autodocs'],
  parameters: {
    // Every story here loads xtr_app_interfaces from DaaS; the preview shows a
    // connect notice instead until the host has an instance connected.
    liveDaaS: true,
    layout: 'padded',
    docs: {
      description: {
        component: `
# ListM2M with Real DaaS Data

This story demonstrates the ListM2M component using actual data structure from DaaS 9.

**Real Relationship Structure:**
- **Collection**: \`xtr_app_interfaces\`
- **Field**: \`m2m\` (interface: list-m2m)
- **Junction Collection**: \`xtr_app_interfaces_xtr_app_tickets\`
- **Related Collection**: \`xtr_app_tickets\`
- **Junction Field**: \`xtr_app_tickets_id\` (points to tickets)
- **Reverse Junction Field**: \`xtr_app_interfaces_id\` (points to interfaces)

This matches the exact structure found in the production DaaS instance.
        `,
      },
    },
  },
  argTypes: {
    collection: {
      control: false,
      description: 'The collection containing the M2M field',
    },
    field: {
      control: false,
      description: 'The M2M field name in the collection',
    },
    primaryKey: {
      control: 'text',
      description: 'Primary key of the current item',
    },
    layout: {
      control: 'select',
      options: ['list', 'table'],
      description: 'Display layout mode',
    },
    fields: {
      control: 'object',
      description: 'Fields to display in table mode',
    },
    template: {
      control: 'text',
      description: 'Template for list mode display',
    },
    enableCreate: {
      control: 'boolean',
      description: 'Allow creating new related items',
    },
    enableSelect: {
      control: 'boolean',
      description: 'Allow selecting existing related items',
    },
    enableSearchFilter: {
      control: 'boolean',
      description: 'Enable search functionality',
    },
    enableLink: {
      control: 'boolean',
      description: 'Show link to related items',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the interface',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const RealDaaSData: Story = {
  args: {
    collection: 'xtr_app_interfaces',
    field: 'm2m',
    primaryKey: 'test-uuid-12345',
    layout: 'table',
    fields: ['id', 'title', 'status', 'priority', 'created_at'],
    enableCreate: true,
    enableSelect: true,
    enableSearchFilter: true,
    enableLink: true,
    label: 'Related Tickets',
    description: 'Many-to-many relationship between app interfaces and tickets',
  },
  parameters: {
    docs: {
      description: {
        story: 'Table layout showing related tickets with full CRUD capabilities.',
      },
    },
  },
};

export const ListLayout: Story = {
  args: {
    collection: 'xtr_app_interfaces',
    field: 'm2m',
    primaryKey: 'test-uuid-12345',
    layout: 'list',
    template: '{{title}} - {{status}} ({{priority}})',
    enableCreate: true,
    enableSelect: true,
    label: 'Related Tickets',
    description: 'List layout with custom template for ticket display',
  },
  parameters: {
    docs: {
      description: {
        story: 'List layout with custom template showing ticket information.',
      },
    },
  },
};

export const ReadOnly: Story = {
  args: {
    collection: 'xtr_app_interfaces',
    field: 'm2m',
    primaryKey: 'test-uuid-12345',
    layout: 'table',
    fields: ['title', 'status', 'created_at'],
    enableCreate: false,
    enableSelect: false,
    disabled: true,
    label: 'Related Tickets (Read Only)',
    description: 'Read-only view of the M2M relationship',
  },
  parameters: {
    docs: {
      description: {
        story: 'Read-only version of the interface for viewing purposes only.',
      },
    },
  },
};

export const SearchEnabled: Story = {
  args: {
    collection: 'xtr_app_interfaces',
    field: 'm2m',
    primaryKey: 'test-uuid-12345',
    layout: 'table',
    fields: ['title', 'status', 'assignee', 'due_date'],
    enableCreate: true,
    enableSelect: true,
    enableSearchFilter: true,
    enableLink: true,
    limit: 10,
    label: 'Searchable Tickets',
    description: 'Interface with search functionality enabled',
  },
  parameters: {
    docs: {
      description: {
        story: 'Interface with search functionality to filter related items.',
      },
    },
  },
};
