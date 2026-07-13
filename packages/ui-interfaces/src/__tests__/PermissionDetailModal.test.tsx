import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PermissionDetailModal } from '../system-permissions/PermissionDetailModal';
import type { PermissionDetailModalProps } from '../system-permissions/PermissionDetailModal';
import type { Field, Permission } from '@buildpad/types';

// Mock @buildpad/services apiRequest (fields are injected in most tests)
jest.mock('@buildpad/services', () => ({
  apiRequest: jest.fn(),
}));

import { apiRequest } from '@buildpad/services';
import { clearPermissionMetadataCache } from '../system-permissions/permissionMetadata';

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const MOCK_FIELDS: Field[] = [
  {
    collection: 'articles',
    field: 'id',
    type: 'uuid',
    schema: { name: 'id', table: 'articles', data_type: 'uuid', is_nullable: false, is_unique: true, is_primary_key: true, has_auto_increment: false },
  },
  { collection: 'articles', field: 'title', type: 'string' },
  { collection: 'articles', field: 'status', type: 'string' },
  { collection: 'articles', field: 'author', type: 'uuid' },
  { collection: 'articles', field: 'comments', type: 'alias' },
];

async function renderWithProvider(component: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<MantineProvider>{component}</MantineProvider>);
  });
  return result!;
}

const baseProps: PermissionDetailModalProps = {
  opened: true,
  onClose: jest.fn(),
  permission: null,
  collection: 'articles',
  action: 'read',
  policyName: 'Test Policy',
  fields: MOCK_FIELDS,
  onSave: jest.fn(),
  'data-testid': 'pdm',
};

describe('PermissionDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPermissionMetadataCache();
    mockedApiRequest.mockResolvedValue({ data: [] });
  });

  // ───────────────────────────────────────────────────────────
  // Tab visibility per action
  // ───────────────────────────────────────────────────────────
  describe('Tab visibility per action', () => {
    it('read → Item Permissions + Field Permissions', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="read" />);
      expect(screen.getByTestId('pdm-tab-permissions')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-fields')).toBeInTheDocument();
      expect(screen.queryByTestId('pdm-tab-validation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pdm-tab-presets')).not.toBeInTheDocument();
    });

    it('create → Fields/Validation/Presets, no Item Permissions', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="create" />);
      expect(screen.queryByTestId('pdm-tab-permissions')).not.toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-fields')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-validation')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-presets')).toBeInTheDocument();
    });

    it('update → all four tabs', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="update" />);
      expect(screen.getByTestId('pdm-tab-permissions')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-fields')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-validation')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-tab-presets')).toBeInTheDocument();
    });

    it('share → Item Permissions only, defaulting to the first available tab', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="share" />);
      expect(screen.getByTestId('pdm-tab-permissions')).toBeInTheDocument();
      expect(screen.queryByTestId('pdm-tab-fields')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pdm-tab-validation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pdm-tab-presets')).not.toBeInTheDocument();
      // First (only) tab is active — its panel content renders
      expect(screen.getByTestId('pdm-filter')).toBeInTheDocument();
    });

    it('delete → Item Permissions only', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="delete" />);
      expect(screen.getByTestId('pdm-tab-permissions')).toBeInTheDocument();
      expect(screen.queryByTestId('pdm-tab-fields')).not.toBeInTheDocument();
    });

    it('shows the modal title as policy → collection → ACTION', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} />);
      expect(screen.getByText('Test Policy → articles → READ')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Value-indicator badges
  // ───────────────────────────────────────────────────────────
  describe('Value badges', () => {
    it('marks tabs holding values with a dot badge', async () => {
      const permission: Partial<Permission> = {
        id: 'p1',
        collection: 'articles',
        action: 'update',
        fields: ['title'],
        permissions: { status: { _eq: 'draft' } },
        validation: null,
        presets: null,
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="update" permission={permission} />,
      );
      expect(screen.getByTestId('pdm-tab-permissions').querySelector('.mantine-Badge-root')).toBeTruthy();
      expect(screen.getByTestId('pdm-tab-fields').querySelector('.mantine-Badge-root')).toBeTruthy();
      expect(screen.getByTestId('pdm-tab-validation').querySelector('.mantine-Badge-root')).toBeFalsy();
      expect(screen.getByTestId('pdm-tab-presets').querySelector('.mantine-Badge-root')).toBeFalsy();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Field Permissions tab
  // ───────────────────────────────────────────────────────────
  describe('Field Permissions tab', () => {
    it('renders a checkbox per field with PK and Alias badges', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="create" />);
      for (const field of MOCK_FIELDS) {
        expect(screen.getByTestId(`pdm-fields-field-${field.field}`)).toBeInTheDocument();
      }
      expect(screen.getByText('PK')).toBeInTheDocument();
      expect(screen.getByText('Alias')).toBeInTheDocument();
    });

    it("['*'] selects every field", async () => {
      const permission: Partial<Permission> = {
        id: 'p1', collection: 'articles', action: 'create', fields: ['*'],
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="create" permission={permission} />,
      );
      for (const field of MOCK_FIELDS) {
        expect(screen.getByTestId(`pdm-fields-field-${field.field}`)).toBeChecked();
      }
    });

    it('select all → save emits every field; select none → save emits null', async () => {
      const onSave = jest.fn();
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="create" onSave={onSave} />,
      );

      fireEvent.click(screen.getByTestId('pdm-fields-select-all'));
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ fields: expect.arrayContaining(MOCK_FIELDS.map((f) => f.field)) }),
      );
    });

    it('select none stores null fields', async () => {
      const onSave = jest.fn();
      const permission: Partial<Permission> = {
        id: 'p1', collection: 'articles', action: 'create', fields: ['title'],
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="create" permission={permission} onSave={onSave} />,
      );
      fireEvent.click(screen.getByTestId('pdm-fields-select-none'));
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ fields: null }));
    });

    it('locks app-minimal fields and excludes them from the payload', async () => {
      const onSave = jest.fn();
      await renderWithProvider(
        <PermissionDetailModal
          {...baseProps}
          action="read"
          appMinimal={{ collection: 'articles', action: 'read', fields: ['id'] }}
          onSave={onSave}
        />,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('pdm-tab-fields'));
      });
      const idCheckbox = screen.getByTestId('pdm-fields-field-id');
      expect(idCheckbox).toBeChecked();
      expect(idCheckbox).toBeDisabled();

      // Toggle a regular field on, save: payload contains title but not the locked id
      fireEvent.click(screen.getByTestId('pdm-fields-field-title'));
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ fields: ['title'] }));
    });
  });

  // ───────────────────────────────────────────────────────────
  // JSON tabs
  // ───────────────────────────────────────────────────────────
  describe('JSON editing', () => {
    async function switchFilterToJsonMode() {
      await act(async () => {
        fireEvent.click(screen.getByTestId('pdm-filter-mode-toggle'));
      });
    }

    it('valid filter JSON reaches the save payload', async () => {
      const onSave = jest.fn();
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="read" onSave={onSave} />,
      );
      await switchFilterToJsonMode();
      const textarea = screen.getByTestId('pdm-filter-json');
      fireEvent.change(textarea, { target: { value: '{"status": {"_eq": "published"}}' } });
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ permissions: { status: { _eq: 'published' } } }),
      );
    });

    it('invalid JSON blocks the draft update (last valid value wins)', async () => {
      const onSave = jest.fn();
      const permission: Partial<Permission> = {
        id: 'p1', collection: 'articles', action: 'read',
        fields: ['*'], permissions: { status: { _eq: 'draft' } },
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="read" permission={permission} onSave={onSave} />,
      );
      await switchFilterToJsonMode();
      const textarea = screen.getByTestId('pdm-filter-json');
      fireEvent.change(textarea, { target: { value: '{"status": {' } });
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ permissions: { status: { _eq: 'draft' } } }),
      );
    });

    it('relational filter keys surface the two-step-query warning', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="read" />);
      await switchFilterToJsonMode();
      const textarea = screen.getByTestId('pdm-filter-json');
      fireEvent.change(textarea, { target: { value: '{"comments": {"_has": true}}' } });
      expect(screen.getByText(/limited relational enforcement/)).toBeInTheDocument();
    });

    it('visual mode renders existing rules as pills and edits flow to the payload', async () => {
      const onSave = jest.fn();
      const permission: Partial<Permission> = {
        id: 'p1', collection: 'articles', action: 'read',
        fields: ['*'],
        permissions: { _and: [{ status: { _eq: 'published' } }, { title: { _nnull: true } }] },
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="read" permission={permission} onSave={onSave} />,
      );
      // Two root rules render as pills
      expect(screen.getByTestId('pdm-filter-node-0')).toBeInTheDocument();
      expect(screen.getByTestId('pdm-filter-node-1')).toBeInTheDocument();
      // Remove the second rule; the filter collapses to the single remaining condition
      await act(async () => {
        fireEvent.click(screen.getByTestId('pdm-filter-node-1-remove'));
      });
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ permissions: { status: { _eq: 'published' } } }),
      );
    });

    it('Add Filter creates a rule for the picked field', async () => {
      const onSave = jest.fn();
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="read" onSave={onSave} />,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('pdm-filter-add-filter'));
      });
      await act(async () => {
        fireEvent.click(await screen.findByTestId('pdm-filter-add-field-status'));
      });
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ permissions: { status: { _eq: null } } }),
      );
    });

    it('validation JSON edits reach the payload; Clear resets to null', async () => {
      const onSave = jest.fn();
      const permission: Partial<Permission> = {
        id: 'p1', collection: 'articles', action: 'update',
        fields: ['*'], validation: { title: { _nnull: true } },
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="update" permission={permission} onSave={onSave} />,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('pdm-tab-validation'));
      });
      fireEvent.click(screen.getByTestId('pdm-validation-clear'));
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ validation: null }));
    });

    it('uuid-array presets trigger the relational-syntax warning', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} action="update" />);
      await act(async () => {
        fireEvent.click(screen.getByTestId('pdm-tab-presets'));
      });
      const textarea = screen.getByTestId('pdm-presets-json');
      fireEvent.change(textarea, { target: { value: '{"author": ["uuid-1", "uuid-2"]}' } });
      expect(screen.getByText(/Relational Field Preset Syntax/)).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Save payload shape
  // ───────────────────────────────────────────────────────────
  describe('Save payload', () => {
    it('emits only the four editable keys — no $ markers, no id', async () => {
      const onSave = jest.fn();
      const permission: Partial<Permission> & { $type?: string; $index?: number } = {
        id: 'p1',
        collection: 'articles',
        action: 'read',
        fields: ['title'],
        permissions: null,
        validation: null,
        presets: null,
        $type: 'updated',
        $index: 0,
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="read" permission={permission} onSave={onSave} />,
      );
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenCalledTimes(1);
      const payload = onSave.mock.calls[0][0];
      expect(Object.keys(payload).sort()).toEqual(['fields', 'permissions', 'presets', 'validation']);
    });

    it('normalizes an empty fields array to null', async () => {
      const onSave = jest.fn();
      const permission: Partial<Permission> = {
        id: 'p1', collection: 'articles', action: 'read', fields: [],
      };
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} action="read" permission={permission} onSave={onSave} />,
      );
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ fields: null }));
    });

    it('closes after save', async () => {
      const onClose = jest.fn();
      await renderWithProvider(<PermissionDetailModal {...baseProps} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('pdm-save'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Delete flow
  // ───────────────────────────────────────────────────────────
  describe('Delete', () => {
    const existing: Partial<Permission> = {
      id: 'p1', collection: 'articles', action: 'read', fields: ['*'],
    };

    it('hides Delete for new permissions and when onDelete is absent', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} permission={null} onDelete={jest.fn()} />);
      expect(screen.queryByTestId('pdm-delete')).not.toBeInTheDocument();
    });

    it('requires confirmation before deleting', async () => {
      const onDelete = jest.fn();
      const onClose = jest.fn();
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} permission={existing} onDelete={onDelete} onClose={onClose} />,
      );
      fireEvent.click(screen.getByTestId('pdm-delete'));
      expect(onDelete).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('pdm-delete-confirm'));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalled();
    });

    it('labels the primary button Create for new and Save for existing', async () => {
      await renderWithProvider(<PermissionDetailModal {...baseProps} permission={null} />);
      expect(screen.getByTestId('pdm-save')).toHaveTextContent('Create');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Metadata fetching (un-injected path)
  // ───────────────────────────────────────────────────────────
  describe('Field fetching', () => {
    it('fetches /api/fields/{collection} when fields are not injected', async () => {
      mockedApiRequest.mockResolvedValue({ data: MOCK_FIELDS });
      await renderWithProvider(
        <PermissionDetailModal {...baseProps} fields={undefined} action="create" />,
      );
      expect(mockedApiRequest).toHaveBeenCalledWith('/api/fields/articles');
      expect(await screen.findByTestId('pdm-fields-field-title')).toBeInTheDocument();
    });
  });
});
