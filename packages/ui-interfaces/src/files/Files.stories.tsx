import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { setGlobalDaaSConfig } from '@buildpad/services';
import { Files } from './Files';

const meta: Meta<typeof Files> = {
  title: 'Interfaces/Files',
  component: Files,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `A multiple file manager with support for upload, selection from library, and file management.

## Features
- Multiple file upload
- Select from file library
- File preview (images, video, audio, PDF)
- Pagination for large file lists
- Download and delete actions
- Folder organization

## Usage
\`\`\`tsx
import { Files } from '@buildpad/ui-interfaces';

<Files
  label="Attachments"
  value={fileIds}
  onChange={(values) => setFileIds(values)}
  enableCreate
  enableSelect
/>
\`\`\`

**Note:** This component requires a configured API connection to work with real files.`,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'object',
      description: 'Array of file IDs or file objects',
    },
    label: {
      control: 'text',
      description: 'Field label',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no files',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the picker is disabled',
    },
    readonly: {
      control: 'boolean',
      description: 'Whether the picker is read-only',
    },
    enableCreate: {
      control: 'boolean',
      description: 'Enable upload new files',
    },
    enableSelect: {
      control: 'boolean',
      description: 'Enable selecting from library',
    },
    folder: {
      control: 'text',
      description: 'Target folder for uploads',
    },
    limit: {
      control: 'number',
      description: 'Items per page',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Files',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Attachments',
    placeholder: 'No files attached',
  },
};

export const EnableUploadOnly: Story = {
  args: {
    label: 'Upload Files',
    enableCreate: true,
    enableSelect: false,
  },
};

export const EnableSelectOnly: Story = {
  args: {
    label: 'Select Files',
    enableCreate: false,
    enableSelect: true,
  },
};

export const BothEnabled: Story = {
  args: {
    label: 'Documents',
    enableCreate: true,
    enableSelect: true,
    placeholder: 'Upload or select from library',
  },
};

export const WithFolder: Story = {
  args: {
    label: 'Project Files',
    folder: 'projects',
    enableCreate: true,
    enableSelect: true,
  },
};

export const CustomLimit: Story = {
  args: {
    label: 'Gallery',
    limit: 6,
    enableCreate: true,
    enableSelect: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true,
    placeholder: 'File management is disabled',
  },
};

export const ReadOnly: Story = {
  args: {
    label: 'Read Only',
    readonly: true,
    placeholder: 'View only mode',
  },
};

export const WithMockFiles: Story = {
  args: {
    label: 'Project Documents',
    value: [
      {
        id: 'file-1',
        filename_download: 'document.pdf',
        filename_disk: 'document.pdf',
        type: 'application/pdf',
        filesize: 250000,
        title: 'Project Proposal',
        uploaded_on: '2024-01-15T10:30:00Z',
        uploaded_by: 'user-1',
      },
      {
        id: 'file-2',
        filename_download: 'image.jpg',
        filename_disk: 'image.jpg',
        type: 'image/jpeg',
        filesize: 150000,
        width: 1920,
        height: 1080,
        title: 'Screenshot',
        uploaded_on: '2024-01-16T14:20:00Z',
        uploaded_by: 'user-1',
      },
      {
        id: 'file-3',
        filename_download: 'data.xlsx',
        filename_disk: 'data.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filesize: 45000,
        title: 'Budget Spreadsheet',
        uploaded_on: '2024-01-17T09:15:00Z',
        uploaded_by: 'user-2',
      },
    ],
    enableCreate: true,
    enableSelect: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Example with mock file objects showing the component structure.',
      },
    },
  },
};

export const ImageGallery: Story = {
  args: {
    label: 'Product Gallery',
    value: [
      {
        id: 'img-1',
        filename_download: 'product-1.jpg',
        filename_disk: 'product-1.jpg',
        type: 'image/jpeg',
        filesize: 200000,
        width: 800,
        height: 600,
        title: 'Product Front',
        uploaded_on: '2024-01-15T10:30:00Z',
        uploaded_by: 'user-1',
      },
      {
        id: 'img-2',
        filename_download: 'product-2.jpg',
        filename_disk: 'product-2.jpg',
        type: 'image/jpeg',
        filesize: 180000,
        width: 800,
        height: 600,
        title: 'Product Side',
        uploaded_on: '2024-01-15T10:31:00Z',
        uploaded_by: 'user-1',
      },
    ],
    limit: 10,
    enableCreate: true,
    enableSelect: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Common use case for product image galleries.',
      },
    },
  },
};

export const DocumentManager: Story = {
  args: {
    label: 'Legal Documents',
    folder: 'legal',
    enableCreate: true,
    enableSelect: true,
    limit: 20,
  },
  parameters: {
    docs: {
      description: {
        story: 'Document management with folder organization.',
      },
    },
  },
};

// ============================================================================
// WithEditModePrimaryKey — Exercises syncJunctionTable for regression testing
// ============================================================================

export const WithEditModePrimaryKey: Story = {
  args: {
    label: 'Attachments',
    collection: 'tasks',
    field: 'attachments',
    primaryKey: '123',
    enableCreate: true,
    enableSelect: false,
  },
  decorators: [
    (Story) => {
      // Set a minimal DaaS config so buildApiUrl() in useFiles.ts doesn't throw.
      // Empty string base URL produces relative paths like '/api/files' that the mock below intercepts.
      setGlobalDaaSConfig({ url: '' });

      const originalFetch = window.fetch;

      const MOCK_FILE = {
        id: 'uploaded-file-1',
        filename_download: 'test-document.pdf',
        filename_disk: 'test-document.pdf',
        type: 'application/pdf',
        filesize: 2048,
        title: 'Test Document',
        uploaded_on: '2024-01-01T00:00:00Z',
        uploaded_by: 'user-1',
      };

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;

        // Permissions — allow all
        if (url.includes('/api/permissions/me')) {
          return new Response(JSON.stringify({ data: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // GET junction table records — return empty (no existing files)
        if (
          url.includes('/api/items/tasks_daas_files') &&
          init?.method !== 'POST'
        ) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // POST junction creation — capture body for test assertion
        if (
          url.includes('/api/items/tasks_daas_files') &&
          init?.method === 'POST'
        ) {
          if (init.body) {
            ;(window as any).__junctionCreateBody = JSON.parse(
              typeof init.body === 'string' ? init.body : '',
            );
          }
          return new Response(JSON.stringify({ data: { id: 1 } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // POST /api/files — file upload (FormData, not JSON)
        if (
          url.includes('/api/files') &&
          init?.method === 'POST' &&
          typeof init?.body !== 'string'
        ) {
          return new Response(JSON.stringify({ data: MOCK_FILE }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // GET /api/files/<id> — file hydration
        if (url.match(/\/api\/files\/[^/?]+$/)) {
          return new Response(JSON.stringify({ data: MOCK_FILE }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // GET /api/files — library file listing
        if (url.includes('/api/files')) {
          return new Response(JSON.stringify({ data: [MOCK_FILE] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Fallback: other items endpoints
        if (url.includes('/api/items/')) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return originalFetch(input, init);
      };

      React.useEffect(() => {
        return () => {
          window.fetch = originalFetch;
          setGlobalDaaSConfig(null);
        };
      });

      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Exercises syncJunctionTable with primaryKey. Used for regression testing that junction creation does NOT include a `sort` field.',
      },
    },
  },
};
