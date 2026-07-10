import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button, Code, Stack, Text } from '@mantine/core';
import { PermissionDetailModal } from './PermissionDetailModal';
import type { RelationInfo } from './PermissionFilterTypes';
import type { Field, Permission, PermissionAction } from '@buildpad/types';

const MOCK_FIELDS: Field[] = [
  {
    collection: 'articles',
    field: 'id',
    type: 'uuid',
    schema: { name: 'id', table: 'articles', data_type: 'uuid', is_nullable: false, is_unique: true, is_primary_key: true, has_auto_increment: false },
  },
  { collection: 'articles', field: 'title', type: 'string' },
  { collection: 'articles', field: 'body', type: 'text' },
  { collection: 'articles', field: 'status', type: 'string' },
  { collection: 'articles', field: 'publish_date', type: 'timestamp' },
  { collection: 'articles', field: 'author', type: 'uuid' },
  { collection: 'articles', field: 'comments', type: 'alias' },
];

const MOCK_RELATIONS: RelationInfo[] = [
  { field: 'comments', relationType: 'o2m', relatedCollection: 'comments' },
  { field: 'author', relationType: 'm2o', relatedCollection: 'daas_users' },
];

interface PlaygroundProps {
  action: PermissionAction;
  permission?: Partial<Permission> | null;
  appMinimal?: Partial<Permission>;
}

/** Opens the modal from a button and echoes the last saved payload. */
function Playground({ action, permission = null, appMinimal }: PlaygroundProps) {
  const [opened, setOpened] = useState(true);
  const [lastSaved, setLastSaved] = useState<Partial<Permission> | null>(null);
  const [deleted, setDeleted] = useState(false);

  return (
    <Stack>
      <Button onClick={() => setOpened(true)} w={220}>
        Edit {action} permission
      </Button>
      {lastSaved && (
        <>
          <Text size="sm" fw={500}>Last saved payload:</Text>
          <Code block fz="xs">{JSON.stringify(lastSaved, null, 2)}</Code>
        </>
      )}
      {deleted && <Text size="sm" c="red">Permission deleted.</Text>}
      <PermissionDetailModal
        opened={opened}
        onClose={() => setOpened(false)}
        permission={permission}
        collection="articles"
        action={action}
        policyName="Editors Policy"
        appMinimal={appMinimal}
        fields={MOCK_FIELDS}
        relations={MOCK_RELATIONS}
        onSave={(edited) => setLastSaved(edited)}
        onDelete={permission ? () => setDeleted(true) : undefined}
        data-testid="pdm"
      />
    </Stack>
  );
}

const meta: Meta<typeof PermissionDetailModal> = {
  title: 'System/PermissionDetailModal',
  component: PermissionDetailModal,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `Tabbed editor for a single permission's custom rules — the "Use Custom" target in \`SystemPermissions\`.

## Tabs (action-dependent)
- **Item Permissions** (read/update/delete/share): Directus-filter rules limiting which items the action applies to
- **Field Permissions** (create/read/update): which fields are accessible (\`['*']\` = all)
- **Field Validation** (create/update): rules checked before the operation
- **Field Presets** (create/update): default values applied automatically

Edits stay local — \`onSave\` emits only \`{ fields, permissions, validation, presets }\` into the caller's alterations model; nothing is written to the API by this component.`,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PermissionDetailModal>;

/** New read permission — Item Permissions + Field Permissions tabs. */
export const CreateRead: Story = {
  render: () => <Playground action="read" />,
};

/** New create permission — no Item Permissions tab, shows Validation/Presets. */
export const CreateCreate: Story = {
  render: () => <Playground action="create" />,
};

/** Existing update permission with all four tabs and value badges. */
export const EditUpdate: Story = {
  render: () => (
    <Playground
      action="update"
      permission={{
        id: 'perm-1',
        collection: 'articles',
        action: 'update',
        fields: ['title', 'body'],
        permissions: { user_created: { _eq: '$CURRENT_USER' } } as any,
        validation: { title: { _nnull: true } } as any,
        presets: { status: 'draft' },
      }}
    />
  ),
};

/** Delete action — Item Permissions only. */
export const EditDelete: Story = {
  render: () => (
    <Playground
      action="delete"
      permission={{
        id: 'perm-2',
        collection: 'articles',
        action: 'delete',
        fields: null,
        permissions: { status: { _eq: 'draft' } } as any,
      }}
    />
  ),
};

/** Share action — single Item Permissions tab. */
export const EditShare: Story = {
  render: () => <Playground action="share" />,
};

/** App-access minimal fields locked in the Field Permissions tab. */
export const WithAppMinimal: Story = {
  render: () => (
    <Playground
      action="read"
      permission={{
        id: 'perm-3',
        collection: 'articles',
        action: 'read',
        fields: ['title'],
      }}
      appMinimal={{ collection: 'articles', action: 'read', fields: ['id', 'status'] }}
    />
  ),
};
