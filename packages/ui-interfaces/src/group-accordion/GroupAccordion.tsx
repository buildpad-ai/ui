import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Group,
  Text,
  ActionIcon,
  Stack,
} from '@mantine/core';
import {
  IconChevronDown,
  IconExclamationCircle,
  IconStarFilled,
} from '@tabler/icons-react';

/**
 * GroupAccordion - Accordion-style group that renders ALL direct child fields
 * as expandable sections. Each child becomes a section header; the section
 * content is rendered via `renderSection`.
 *
 * DaaS equivalent: group-accordion
 * Options: accordionMode (boolean), start ('opened' | 'closed' | 'first')
 *
 * In DaaS, every direct child of the accordion (whether a regular field
 * or a nested group) becomes an accordion section. The section header shows
 * the field name, and the section content renders the field itself (with
 * hideLabel) plus any nested children if it's a group.
 *
 * Structure:
 *   accordion (group-accordion)
 *     ├── test_input      ← section header "Test Input", content = input field
 *     ├── test_input2     ← section header "Test Input2", content = input field
 *     └── rich_text_editor ← section header "Rich Text Editor", content = editor
 */
export interface GroupAccordionProps {
  /** Field configuration object */
  field?: {
    name?: string;
    meta?: {
      field?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };

  /** Array of ALL field configurations (used to find children) */
  fields?: Array<{
    field: string;
    name?: string;
    type?: string;
    meta?: any;
    schema?: any;
  }>;

  /** Current form values */
  values?: Record<string, any>;

  /** Initial form values */
  initialValues?: Record<string, any>;

  /** Whether the form is disabled */
  disabled?: boolean;

  /** Whether in batch mode */
  batchMode?: boolean;

  /** Active fields in batch mode */
  batchActiveFields?: string[];

  /** Primary key of the record */
  primaryKey?: string | number;

  /** Whether the form is loading */
  loading?: boolean;

  /** Validation errors */
  validationErrors?: Array<{
    field: string;
    code: string;
    type: string;
    [key: string]: any;
  }>;

  /** Badge text */
  badge?: string;

  /** Whether raw editor is enabled */
  rawEditorEnabled?: boolean;

  /**
   * Accordion mode: when true, only one section can be open at a time.
   * When false, multiple sections can be open simultaneously.
   * Default: true
   */
  accordionMode?: boolean;

  /**
   * Initial open state.
   * - 'closed': all sections closed (default)
   * - 'first': first section open
   * - 'opened': all sections open (only available when accordionMode is false)
   */
  start?: 'opened' | 'closed' | 'first';

  /** Text direction */
  direction?: 'ltr' | 'rtl';

  /**
   * Render function for section content.
   * Called for each accordion section (any direct child field).
   * Receives the section field config and should return the rendered content.
   */
  renderSection?: (sectionField: {
    field: string;
    name?: string;
    meta?: any;
  }) => React.ReactNode;

  /** Children as fallback content */
  children?: React.ReactNode;

  /** Callback when form values change */
  onChange?: (values: Record<string, any>) => void;
}

// Helper to format field names as titles
const formatTitle = (str: string): string => {
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export function GroupAccordion({
  field,
  fields = [],
  values = {},
  initialValues = {},
  validationErrors = [],
  badge,
  accordionMode = true,
  start = 'closed',
  disabled = false,
  renderSection,
  children,
}: GroupAccordionProps) {
  const groupFieldName = field?.meta?.field;

  // Find ALL direct child fields that belong to this accordion group.
  // Matches DaaS limitFields(): fields.filter(f => f.meta?.group === field.meta?.field)
  // Every direct child becomes a section — regardless of whether it's a group or regular field.
  const sectionFields = useMemo(() => {
    if (!groupFieldName) return [];
    return fields.filter((f) => f.meta?.group === groupFieldName);
  }, [fields, groupFieldName]);

  // Track which sections are open
  const [openSections, setOpenSections] = useState<string[]>(() => {
    if (sectionFields.length === 0) return [];
    if (start === 'opened' && !accordionMode) {
      return sectionFields.map((f) => f.field);
    }
    if (start === 'first' && sectionFields.length > 0) {
      return [sectionFields[0]!.field];
    }
    return [];
  });

  // Auto-open sections with validation errors
  useEffect(() => {
    if (validationErrors.length === 0 || sectionFields.length === 0) return;

    const fieldsWithErrors = validationErrors.map((e) => e.field);
    const sectionsWithErrors = sectionFields.filter((section) => {
      // Check if the section itself has an error
      if (fieldsWithErrors.includes(section.field)) return true;
      // Check if any child of this section has an error (for group-type sections)
      if (section.meta?.special?.includes?.('group')) {
        const sectionChildren = fields.filter((f) => f.meta?.group === section.field);
        return sectionChildren.some((child) => fieldsWithErrors.includes(child.field));
      }
      return false;
    });

    if (sectionsWithErrors.length > 0) {
      setOpenSections((prev) => {
        const newSections = [...new Set([...prev, ...sectionsWithErrors.map((s) => s.field)])];
        return accordionMode ? [sectionsWithErrors[0]!.field] : newSections;
      });
    }
  }, [validationErrors, sectionFields, fields, accordionMode]);

  const toggleSection = useCallback(
    (sectionField: string) => {
      if (disabled) return;
      setOpenSections((prev) => {
        const isOpen = prev.includes(sectionField);
        if (accordionMode) {
          return isOpen ? [] : [sectionField];
        }
        return isOpen ? prev.filter((s) => s !== sectionField) : [...prev, sectionField];
      });
    },
    [accordionMode, disabled],
  );

  const toggleAll = useCallback(() => {
    if (accordionMode || disabled) return;
    setOpenSections((prev) =>
      prev.length === sectionFields.length ? [] : sectionFields.map((f) => f.field),
    );
  }, [accordionMode, disabled, sectionFields]);

  // Check if a section's fields have been edited
  const isSectionEdited = useCallback(
    (sectionField: string) => {
      if (!values || !initialValues) return false;
      // For regular fields, check the field itself
      if (sectionField in values && values[sectionField] !== initialValues[sectionField]) {
        return true;
      }
      // For group fields, check children
      const sectionChildren = fields.filter((f) => f.meta?.group === sectionField);
      return sectionChildren.some(
        (child) =>
          child.field in values && values[child.field] !== initialValues[child.field],
      );
    },
    [values, initialValues, fields],
  );

  // Get validation message for a section
  const getSectionValidation = useCallback(
    (sectionField: string) => {
      const error = validationErrors.find((e) => e.field === sectionField);
      if (!error) return undefined;
      if (error.code === 'RECORD_NOT_UNIQUE') return `${formatTitle(sectionField)} must be unique`;
      return `${formatTitle(sectionField)} ${error.type?.toLowerCase() || 'error'}`;
    },
    [validationErrors],
  );

  // If there are no section fields and children provided, render children directly
  if (sectionFields.length === 0) {
    if (children) {
      return <Box className="group-accordion">{children}</Box>;
    }
    return <Box className="group-accordion" />;
  }

  return (
    <Box
      className="group-accordion"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-3)',
      }}
    >
      {sectionFields.map((section) => {
        const isOpen = openSections.includes(section.field);
        const edited = isSectionEdited(section.field);
        const validationMsg = getSectionValidation(section.field);

        return (
          <AccordionSection
            key={section.field}
            field={section}
            isOpen={isOpen}
            edited={edited}
            disabled={disabled}
            badge={badge}
            validationMessage={validationMsg}
            onToggle={() => toggleSection(section.field)}
            onShiftClick={toggleAll}
            accordionMode={accordionMode}
          >
            {renderSection ? renderSection(section) : null}
          </AccordionSection>
        );
      })}
    </Box>
  );
}

/** Individual accordion section */
interface AccordionSectionProps {
  field: { field: string; name?: string; meta?: any };
  isOpen: boolean;
  edited: boolean;
  disabled: boolean;
  badge?: string;
  validationMessage?: string;
  onToggle: () => void;
  onShiftClick: () => void;
  accordionMode: boolean;
  children?: React.ReactNode;
}

function AccordionSection({
  field,
  isOpen,
  edited,
  disabled,
  badge,
  validationMessage,
  onToggle,
  onShiftClick,
  accordionMode,
  children,
}: AccordionSectionProps) {
  // Lazy-mount: only render section content once the section has been opened
  // at least once. Once mounted, content stays mounted so that form state
  // (and complex editors like Tiptap) are preserved when collapsed.
  //
  // We use a ref + state combo so that the very first render where isOpen
  // becomes true already has hasBeenOpened === true.  This avoids a two-phase
  // mount (useEffect → setState → re-render) that can race with Tiptap's own
  // useEffect-based editor creation, causing ProseMirror to attach to a DOM
  // node that isn't fully laid out yet.
  const mountedRef = React.useRef(isOpen);
  if (isOpen && !mountedRef.current) {
    mountedRef.current = true;
  }
  const [hasBeenOpened, setHasBeenOpened] = useState(mountedRef.current);

  // Keep state in sync for subsequent opens (e.g. if the component
  // re-renders with isOpen=true after being constructed with isOpen=false).
  if (isOpen && !hasBeenOpened) {
    setHasBeenOpened(true);
  }

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (!accordionMode && e.shiftKey) {
      onShiftClick();
    } else {
      onToggle();
    }
  };

  // We avoid Mantine <Collapse> for the content because its height animation
  // (overflow:hidden + height:0→auto) prevents Tiptap/ProseMirror editors
  // from measuring their container, causing them to render as empty.
  // Instead we use display:none/block toggling which gives the editor a
  // proper layout context the moment it mounts.

  return (
    <Box
      className="accordion-section"
      style={{
        borderTop: '1px solid var(--mantine-color-gray-3)',
      }}
    >
      {/* Section Header */}
      <Group
        align="center"
        gap="xs"
        py="xs"
        onClick={handleClick}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          position: 'relative',
        }}
      >
        {edited && !isOpen && (
          <Box
            w={4}
            h={4}
            bg="gray.6"
            style={{
              borderRadius: '50%',
              position: 'absolute',
              top: 14,
              left: -7,
            }}
            title="Edited"
          />
        )}

        <ActionIcon
          variant="transparent"
          size="sm"
          style={{
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 150ms ease',
            color: isOpen
              ? 'var(--mantine-color-text)'
              : 'var(--mantine-color-dimmed)',
          }}
        >
          <IconChevronDown size={16} />
        </ActionIcon>

        <Text
          size="sm"
          fw={500}
          c={isOpen ? undefined : 'dimmed'}
          style={{ transition: 'color 150ms ease' }}
        >
          {field.name || formatTitle(field.field)}
        </Text>

        {field.meta?.required && (
          <IconStarFilled
            size={8}
            style={{ color: 'var(--mantine-primary-color-6)', marginTop: -8 }}
          />
        )}

        {badge && (
          <Text size="xs" c="dimmed">
            {badge}
          </Text>
        )}

        {!isOpen && validationMessage && (
          <ActionIcon
            variant="transparent"
            size="sm"
            color="red"
            title={validationMessage}
            data-testid="validation-warning"
          >
            <IconExclamationCircle size={16} />
          </ActionIcon>
        )}
      </Group>

      {/* Section Content — lazy-mounted on first open, toggled via display */}
      {hasBeenOpened && (
        <div
          style={{
            display: isOpen ? 'block' : 'none',
            paddingTop: 'var(--mantine-spacing-sm)',
            paddingBottom: 'var(--mantine-spacing-sm)',
          }}
        >
          {children || (
            <Stack gap="md">
              <Text c="dimmed" size="sm">
                No content for this section
              </Text>
            </Stack>
          )}
        </div>
      )}
    </Box>
  );
}

export default GroupAccordion;
