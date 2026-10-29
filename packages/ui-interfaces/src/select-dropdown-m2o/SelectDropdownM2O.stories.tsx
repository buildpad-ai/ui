import React, { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SelectDropdownM2O } from './SelectDropdownM2O';

/**
 * Example data so every story renders without a DaaS instance. The component
 * still runs its real data path (relation lookup, selected-item load, option
 * list and search); a fetch interceptor answers those requests from the
 * fixtures below while one of these stories is mounted. Any other request
 * passes through untouched.
 */
type DemoItem = { id: string } & Record<string, string>;

const DEMO_COLLECTIONS: Record<string, { template: string; items: DemoItem[] }> = {
  categories: {
    template: '{{name}}',
    items: [
      { id: 'cat-1', name: 'Tutorials' },
      { id: 'cat-2', name: 'Product updates' },
      { id: 'cat-3', name: 'Engineering' },
      { id: 'cat-4', name: 'Design' },
      { id: 'cat-5', name: 'Company news' },
    ],
  },
  authors: {
    template: '{{name}}',
    items: [
      { id: 'author-1', name: 'Maya Chen' },
      { id: 'author-2', name: 'Liam Okafor' },
      { id: 'author-3', name: 'Sofia Rossi' },
      { id: 'author-4', name: 'Noah Tanaka' },
    ],
  },
  departments: {
    template: '{{name}}',
    items: [
      { id: 'dept-1', name: 'Engineering' },
      { id: 'dept-2', name: 'Design' },
      { id: 'dept-3', name: 'Sales' },
      { id: 'dept-4', name: 'Finance' },
      { id: 'dept-5', name: 'People' },
    ],
  },
  employees: {
    template: '{{first_name}} {{last_name}}',
    items: [
      { id: 'emp-1', first_name: 'Amara', last_name: 'Osei', title: 'VP Engineering' },
      { id: 'emp-2', first_name: 'Daniel', last_name: 'Kim', title: 'Head of Design' },
      { id: 'emp-3', first_name: 'Elena', last_name: 'Petrova', title: 'Engineering Manager' },
      { id: 'emp-4', first_name: 'Rahul', last_name: 'Mehta', title: 'Sales Director' },
    ],
  },
  customers: {
    template: '{{name}}',
    items: [
      { id: 'cust-1', name: 'Northwind Traders' },
      { id: 'cust-2', name: 'Blue Harbor Foods' },
      { id: 'cust-3', name: 'Summit Outdoor Co.' },
      { id: 'cust-4', name: 'Lumen Analytics' },
      { id: 'cust-5', name: 'Riverside Clinic' },
    ],
  },
  brands: {
    template: '{{name}}',
    items: [
      { id: 'brand-1', name: 'Aster' },
      { id: 'brand-2', name: 'Kettle & Co.' },
      { id: 'brand-3', name: 'Northfield' },
      { id: 'brand-4', name: 'Vela' },
    ],
  },
  organizations: {
    template: '{{name}}',
    items: [
      { id: 'org-1', name: 'Harbor Health' },
      { id: 'org-2', name: 'Civic Works' },
      { id: 'org-3', name: 'Greenline Logistics' },
    ],
  },
  teams: {
    template: '{{name}}',
    items: [
      { id: 'team-1', name: 'Platform' },
      { id: 'team-2', name: 'Growth' },
      { id: 'team-3', name: 'Support' },
      { id: 'team-4', name: 'Data' },
    ],
  },
  order_statuses: {
    template: '{{name}}',
    items: [
      { id: 'status-1', name: 'Pending' },
      { id: 'status-2', name: 'Paid' },
      { id: 'status-3', name: 'Shipped' },
      { id: 'status-4', name: 'Delivered' },
    ],
  },
  users: {
    template: '{{name}}',
    items: [
      { id: 'user-123', name: 'Priya Nair', email: 'priya@example.com' },
      { id: 'user-124', name: 'Tom Becker', email: 'tom@example.com' },
      { id: 'user-125', name: 'Grace Lim', email: 'grace@example.com' },
      { id: 'user-126', name: 'Omar Haddad', email: 'omar@example.com' },
    ],
  },
};

/** `<collection>.<field>` used by a story → the collection it points to. */
const DEMO_RELATIONS: Record<string, string> = {
  'posts.category_id': 'categories',
  'articles.author_id': 'authors',
  'employees.department_id': 'departments',
  'employees.manager_id': 'employees',
  'orders.customer_id': 'customers',
  'products.brand_id': 'brands',
  'categories.parent_id': 'categories',
  'employees.supervisor_id': 'employees',
  'users.organization_id': 'organizations',
  'members.team_id': 'teams',
  'orders.status_id': 'order_statuses',
  'documents.created_by': 'users',
  'tasks.assigned_to': 'users',
  'products.category_id': 'categories',
};

/** Every `_icontains` term in a DaaS filter (the component's search). */
function searchTerms(filter: unknown): string[] {
  if (!filter || typeof filter !== 'object') return [];
  return Object.entries(filter as Record<string, unknown>).flatMap(([key, value]) =>
    key === '_icontains' && typeof value === 'string' ? [value.toLowerCase()] : searchTerms(value),
  );
}

/** The fixture response for a request, or undefined to pass it through. */
function demoResponse(url: URL): { status: number; body: unknown } | undefined {
  const path = url.pathname;
  if (path === '/api/relations') {
    return {
      status: 200,
      body: {
        data: Object.entries(DEMO_RELATIONS).map(([key, oneCollection]) => {
          const [manyCollection, manyField] = key.split('.');
          return {
            many_collection: manyCollection,
            many_field: manyField,
            one_collection: oneCollection,
            one_primary: 'id',
            schema: { data_type: 'string' },
            meta: null,
          };
        }),
      },
    };
  }
  const collectionMatch = /^\/api\/collections\/([^/]+)$/.exec(path);
  if (collectionMatch && DEMO_COLLECTIONS[collectionMatch[1]]) {
    const name = collectionMatch[1];
    return {
      status: 200,
      body: { data: { collection: name, meta: { display_template: DEMO_COLLECTIONS[name].template } } },
    };
  }
  const itemMatch = /^\/api\/items\/([^/]+)\/([^/]+)$/.exec(path);
  if (itemMatch && DEMO_COLLECTIONS[itemMatch[1]]) {
    const item = DEMO_COLLECTIONS[itemMatch[1]].items.find((i) => i.id === decodeURIComponent(itemMatch[2]));
    return item
      ? { status: 200, body: { data: item } }
      : { status: 404, body: { errors: [{ message: 'Item not found' }] } };
  }
  const listMatch = /^\/api\/items\/([^/]+)$/.exec(path);
  if (listMatch && DEMO_COLLECTIONS[listMatch[1]]) {
    const filter = url.searchParams.get('filter');
    const terms = filter ? searchTerms(JSON.parse(filter)) : [];
    const items = DEMO_COLLECTIONS[listMatch[1]].items.filter(
      (item) =>
        terms.length === 0 ||
        terms.some((term) => Object.values(item).some((value) => value.toLowerCase().includes(term))),
    );
    return { status: 200, body: { data: items } };
  }
  return undefined;
}

// Installed once; answers only while a story from this file is mounted, so
// live-data stories elsewhere in the Storybook still reach the host proxy.
let mountedDemoStories = 0;
const passthroughFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (mountedDemoStories > 0) {
    const raw = input instanceof Request ? input.url : String(input);
    const demo = demoResponse(new URL(raw, window.location.origin));
    if (demo) {
      return Promise.resolve(
        new Response(JSON.stringify(demo.body), {
          status: demo.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
  }
  return passthroughFetch(input, init);
};

function WithDemoData({ children }: { children: React.ReactNode }) {
  // Counted during the first render, before the component's effects send
  // their requests; released when the story unmounts.
  useState(() => {
    mountedDemoStories += 1;
    return null;
  });
  useEffect(
    () => () => {
      mountedDemoStories -= 1;
    },
    [],
  );
  return <>{children}</>;
}

const meta: Meta<typeof SelectDropdownM2O> = {
  title: 'Interfaces/SelectDropdownM2O',
  component: SelectDropdownM2O,
  decorators: [
    (Story) => (
      <WithDemoData>
        <Story />
      </WithDemoData>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `Many-to-One (M2O) relationship interface - allows selecting ONE item from a related collection.

## Features
- Dropdown or modal layout modes
- Search/filter functionality
- Create new related items
- Link to related items
- Template display customization

## Use Case
Example: A "post" belongs to ONE "category". The post has a \`category_id\` foreign key.

## Usage
\`\`\`tsx
import { SelectDropdownM2O } from '@buildpad/ui-interfaces';

<SelectDropdownM2O
  collection="posts"
  field="category_id"
  value={categoryId}
  onChange={(value) => setCategoryId(value)}
  layout="dropdown"
/>
\`\`\`

**Note:** The stories below answer the component's DaaS requests with example data, so they need no backend. In an app, SelectDropdownM2O loads the relation, the selected item and the options from DaaS.`,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Current value - the foreign key (ID of the related item)',
    },
    collection: {
      control: 'text',
      description: 'Current collection name',
    },
    field: {
      control: 'text',
      description: 'Field name for this M2O relationship',
    },
    layout: {
      control: 'select',
      options: ['dropdown', 'modal'],
      description: 'Layout mode',
    },
    template: {
      control: 'text',
      description: 'Template string for display',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the interface is disabled',
    },
    enableCreate: {
      control: 'boolean',
      description: 'Enable create new items button',
    },
    enableLink: {
      control: 'boolean',
      description: 'Enable link to related items',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    searchable: {
      control: 'boolean',
      description: 'Enable search/filter',
    },
    label: {
      control: 'text',
      description: 'Field label',
    },
    description: {
      control: 'text',
      description: 'Field description',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
    required: {
      control: 'boolean',
      description: 'Whether the field is required',
    },
    readOnly: {
      control: 'boolean',
      description: 'Whether the field is read-only',
    },
    allowNone: {
      control: 'boolean',
      description: 'Allow clearing the selection',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Category',
    collection: 'posts',
    field: 'category_id',
    placeholder: 'Select a category...',
  },
};

export const DropdownLayout: Story = {
  args: {
    label: 'Author',
    collection: 'articles',
    field: 'author_id',
    layout: 'dropdown',
    placeholder: 'Select an author...',
    description: 'Compact dropdown selector',
  },
};

export const ModalLayout: Story = {
  args: {
    label: 'Department',
    collection: 'employees',
    field: 'department_id',
    layout: 'modal',
    placeholder: 'Choose department...',
    description: 'Opens a modal for selection',
  },
};

export const WithTemplate: Story = {
  args: {
    label: 'Manager',
    collection: 'employees',
    field: 'manager_id',
    template: '{{first_name}} {{last_name}} - {{title}}',
    placeholder: 'Select manager...',
  },
};

export const Searchable: Story = {
  args: {
    label: 'Customer',
    collection: 'orders',
    field: 'customer_id',
    searchable: true,
    placeholder: 'Search customers...',
  },
};

export const WithCreateEnabled: Story = {
  args: {
    label: 'Brand',
    collection: 'products',
    field: 'brand_id',
    enableCreate: true,
    placeholder: 'Select or create brand...',
  },
};

export const WithLinkEnabled: Story = {
  args: {
    label: 'Parent Category',
    collection: 'categories',
    field: 'parent_id',
    enableLink: true,
    placeholder: 'Select parent...',
    description: 'Can link to view the selected item',
  },
};

export const AllowNone: Story = {
  args: {
    label: 'Supervisor (Optional)',
    collection: 'employees',
    field: 'supervisor_id',
    allowNone: true,
    placeholder: 'None selected',
    description: 'Selection can be cleared',
  },
};

export const Required: Story = {
  args: {
    label: 'Organization',
    collection: 'users',
    field: 'organization_id',
    required: true,
    placeholder: 'Select organization...',
  },
};

export const WithError: Story = {
  args: {
    label: 'Team',
    collection: 'members',
    field: 'team_id',
    error: 'Please select a team',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Status',
    collection: 'orders',
    field: 'status_id',
    disabled: true,
    value: 'status-1',
  },
};

export const ReadOnly: Story = {
  args: {
    label: 'Created By',
    collection: 'documents',
    field: 'created_by',
    readOnly: true,
    value: 'user-123',
  },
};

export const FullFeatured: Story = {
  args: {
    label: 'Assigned To',
    collection: 'tasks',
    field: 'assigned_to',
    layout: 'dropdown',
    searchable: true,
    enableCreate: true,
    enableLink: true,
    allowNone: true,
    template: '{{name}} ({{email}})',
    placeholder: 'Select assignee...',
    description: 'Assign this task to a team member',
  },
  parameters: {
    docs: {
      description: {
        story: 'Full-featured M2O selector with all options enabled.',
      },
    },
  },
};

export const ProductCategory: Story = {
  args: {
    label: 'Product Category',
    collection: 'products',
    field: 'category_id',
    layout: 'dropdown',
    searchable: true,
    enableLink: true,
    placeholder: 'Choose category...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Common e-commerce use case.',
      },
    },
  },
};
