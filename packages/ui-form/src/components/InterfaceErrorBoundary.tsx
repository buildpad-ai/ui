/**
 * InterfaceErrorBoundary
 * Ported from DaaS v-error-boundary concept
 *
 * Wraps field interface components so that a runtime error in one
 * interface doesn't crash the entire form.  Shows a warning notice
 * instead, matching DaaS's `<v-error-boundary>` + `#fallback` pattern.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  /** Display name of the interface (for the error message) */
  interfaceName?: string;
  /** The field key (for debugging) */
  fieldKey?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * React Error Boundary that catches render errors in interface components.
 *
 * Usage:
 * ```tsx
 * <InterfaceErrorBoundary interfaceName="input" fieldKey="name">
 *   <InterfaceComponent {...props} />
 * </InterfaceErrorBoundary>
 * ```
 */
export class InterfaceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[VForm] Interface "${this.props.interfaceName}" for field "${this.props.fieldKey}" threw an error:`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert icon={<IconAlertTriangle size={16} />} color="warning">
          <Text size="sm">
            Unexpected error in interface{' '}
            <Text component="span" fw={600}>
              {this.props.interfaceName || 'unknown'}
            </Text>
          </Text>
          {this.state.error?.message && (
            <Text size="xs" c="dimmed" mt="xs">
              {this.state.error.message}
            </Text>
          )}
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default InterfaceErrorBoundary;
