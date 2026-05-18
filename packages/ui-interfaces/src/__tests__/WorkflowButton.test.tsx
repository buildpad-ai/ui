import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { WorkflowButton } from '../workflow-button';
import type { WorkflowButtonProps } from '../workflow-button';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper function to render components with Mantine provider
const renderWithProvider = (component: React.ReactElement) => {
  return render(<MantineProvider>{component}</MantineProvider>);
};

// Mock workflow instance response
const mockWorkflowInstance = {
  id: 1,
  item_id: 'article-123',
  current_state: 'Draft',
  version_key: null,
  terminated: false,
  workflow: {
    id: 1,
    name: 'Article Workflow',
    workflow_json: JSON.stringify({
      initial_state: 'Draft',
      compare_rollback_state: 'Published',
      states: [
        {
          name: 'Draft',
          commands: [
            { name: 'Submit', next_state: 'Review', policies: [] },
            { name: 'Publish', next_state: 'Published', policies: ['admin-policy'] },
          ],
          isEndState: false,
        },
        {
          name: 'Review',
          commands: [
            { name: 'Approve', next_state: 'Published', policies: [] },
            { name: 'Reject', next_state: 'Draft', policies: [] },
          ],
          isEndState: false,
        },
        {
          name: 'Published',
          commands: [],
          isEndState: true,
        },
      ],
    }),
  },
};

// Mock user response
const mockUserResponse = {
  data: {
    id: 'user-1',
    email: 'user@example.com',
    policies: ['user-policy'],
  },
};

// Mock access response
const mockAccessResponse = {
  data: [{ policy: 'user-policy' }],
};

describe('WorkflowButton', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Loading State', () => {
    it('renders loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      expect(screen.getByText('Loading workflow...')).toBeInTheDocument();
    });
  });

  describe('No Workflow Instance', () => {
    it('renders placeholder when no workflow exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          placeholder="No workflow"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No workflow')).toBeInTheDocument();
      });
    });

    it('hides component when alwaysVisible is false and no workflow exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { container } = renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          alwaysVisible={false}
        />
      );

      await waitFor(() => {
        // Loading state should disappear
        expect(screen.queryByText('Loading workflow...')).not.toBeInTheDocument();
      });

      // Should render nothing (empty container)
      expect(container.firstChild).toBeNull();
    });
  });

  describe('With Workflow Instance', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });
    });

    it('renders current state in button', async () => {
      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Draft/i })).toBeInTheDocument();
      });
    });

    it('shows available commands in dropdown', async () => {
      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Draft/i })).toBeInTheDocument();
      });

      // Open the dropdown menu
      const button = screen.getByRole('button', { name: /Draft/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Should show Submit command (no policies required)
        expect(screen.getByText('Submit')).toBeInTheDocument();
      });
    });

    it('filters commands based on user policies', async () => {
      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Draft/i })).toBeInTheDocument();
      });

      // Open the dropdown menu
      const button = screen.getByRole('button', { name: /Draft/i });
      fireEvent.click(button);

      await waitFor(() => {
        // Submit should be shown (no policies required)
        expect(screen.getByText('Submit')).toBeInTheDocument();
        // Publish should NOT be shown (requires admin-policy which user doesn't have)
        expect(screen.queryByText('Publish')).not.toBeInTheDocument();
      });
    });

    it('displays compare button when canCompare is true', async () => {
      renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          canCompare={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Compare/i })).toBeInTheDocument();
      });
    });

    it('does not display compare button when canCompare is false', async () => {
      renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          canCompare={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Draft/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Compare/i })).not.toBeInTheDocument();
    });
  });

  describe('Transition Execution', () => {
    it('executes transition on command selection', async () => {
      const onChangeMock = jest.fn();
      const onTransitionMock = jest.fn();

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        if (url.includes('/api/workflow/transition') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          onChange={onChangeMock}
          onTransition={onTransitionMock}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Draft/i })).toBeInTheDocument();
      });

      // Open the dropdown menu
      const button = screen.getByRole('button', { name: /Draft/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Submit')).toBeInTheDocument();
      });

      // Click the Submit command
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        // Should have called the transition endpoint
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/workflow/transition'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Disabled State', () => {
    it('disables button when disabled prop is true', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          disabled={true}
        />
      );

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Draft/i });
        expect(button).toBeDisabled();
      });
    });

    it('disables button when no commands are available', async () => {
      const terminatedInstance = {
        ...mockWorkflowInstance,
        current_state: 'Published',
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [terminatedInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Published/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Additional Choices', () => {
    it('merges additional choices with workflow commands', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      renderWithProvider(
        <WorkflowButton
          itemId="article-123"
          collection="articles"
          choices={[
            {
              text: 'Custom Action',
              value: 'custom',
              command: 'Custom Action',
              nextState: 'Custom State',
            },
          ]}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Draft/i })).toBeInTheDocument();
      });

      // Open the dropdown menu
      const button = screen.getByRole('button', { name: /Draft/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Submit')).toBeInTheDocument();
        expect(screen.getByText('Custom Action')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('displays error when workflow config is missing', async () => {
      const invalidInstance = {
        ...mockWorkflowInstance,
        workflow: {
          id: 1,
          name: 'Invalid Workflow',
          workflow_json: null,
        },
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [invalidInstance] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      renderWithProvider(
        <WorkflowButton itemId="article-123" collection="articles" />
      );

      await waitFor(() => {
        expect(screen.getByText(/Workflow configuration is missing/i)).toBeInTheDocument();
      });
    });
  });
});
