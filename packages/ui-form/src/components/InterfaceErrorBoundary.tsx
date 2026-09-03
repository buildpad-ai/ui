/**
 * InterfaceErrorBoundary
 * Ported from DaaS v-error-boundary concept
 *
 * Wraps field interface components so that a runtime error in one
 * interface doesn't crash the entire form.  Shows a warning notice
 * instead, matching DaaS's `<v-error-boundary>` + `#fallback` pattern.
 *
 * Error boundaries must be class components, and classes cannot call hooks,
 * so the exported `InterfaceErrorBoundary` is a thin function component that
 * resolves the dictionary strings and hands them to the class as props.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { DeepPartial, FormTranslations } from '@buildpad/utils';
import { useBuildpadTranslations } from '@buildpad/services';

export interface InterfaceErrorBoundaryProps {
  /** Display name of the interface (for the error message) */
  interfaceName?: string;
  /** The field key (for debugging) */
  fieldKey?: string;
  /** Per-instance overrides of the `form` dictionary namespace */
  translations?: DeepPartial<FormTranslations>;
  children: ReactNode;
}

type BoundaryStrings = FormTranslations['interfaceErrorBoundary'];

interface BoundaryProps extends Omit<InterfaceErrorBoundaryProps, 'translations'> {
  /** Resolved strings — the class cannot call the translation hook itself */
  strings: BoundaryStrings;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/** Where the bold interface name goes inside `strings.title`. */
const INTERFACE_NAME_PLACEHOLDER = '{interfaceName}';

/**
 * React Error Boundary that catches render errors in interface components.
 */
class InterfaceErrorBoundaryImpl extends Component<BoundaryProps, State> {
  constructor(props: BoundaryProps) {
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
      const { strings } = this.props;
      // The interface name is rendered bold, so the template is split around
      // its placeholder instead of being interpolated into one string.
      const [before, after] = strings.title.split(INTERFACE_NAME_PLACEHOLDER);
      return (
        <Alert icon={<IconAlertTriangle size={16} />} color="warning">
          <Text size="sm">
            {before}
            <Text component="span" fw={600}>
              {this.props.interfaceName || strings.unknownInterface}
            </Text>
            {after}
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

/**
 * Error boundary for a field interface.
 *
 * Usage:
 * ```tsx
 * <InterfaceErrorBoundary interfaceName="input" fieldKey="name">
 *   <InterfaceComponent {...props} />
 * </InterfaceErrorBoundary>
 * ```
 */
export function InterfaceErrorBoundary({ translations, ...props }: InterfaceErrorBoundaryProps) {
  const t = useBuildpadTranslations((d) => d.form, translations);
  return <InterfaceErrorBoundaryImpl {...props} strings={t.interfaceErrorBoundary} />;
}

export default InterfaceErrorBoundary;
