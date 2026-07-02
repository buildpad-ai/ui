/**
 * BuilderCanvas
 *
 * The center pane of the `FormBuilder`: an ordered, sortable list of
 * `BuilderSection`s plus an "Add section" action. Section reordering and field
 * reordering are driven by the single `DndContext` owned by `FormBuilder`; this
 * component only provides the section-level `SortableContext`.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { Button, Stack, Text } from '@mantine/core';
import { IconLayoutGridAdd } from '@tabler/icons-react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { BuilderSection, SECTION_ID_PREFIX } from './BuilderSection';
import type { Field, FormSection } from '@buildpad/types';

export interface BuilderCanvasProps {
  sections: FormSection[];
  schemaByKey: Map<string, Field>;
  selectedField: string | null;
  onSelectField: (field: string) => void;
  onRemoveField: (field: string) => void;
  onRenameSection: (sectionId: string, title: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onAddSection: () => void;
}

/**
 * Sortable list of sections.
 */
export function BuilderCanvas({
  sections,
  schemaByKey,
  selectedField,
  onSelectField,
  onRemoveField,
  onRenameSection,
  onRemoveSection,
  onAddSection,
}: BuilderCanvasProps) {
  const sectionIds = sections.map((s) => `${SECTION_ID_PREFIX}${s.id}`);

  return (
    <Stack gap="sm" data-testid="builder-canvas">
      {sections.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="lg">
          Add a section, then drag fields from the palette to start building the
          form.
        </Text>
      )}

      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        <Stack gap="sm">
          {sections.map((section) => (
            <BuilderSection
              key={section.id}
              section={section}
              schemaByKey={schemaByKey}
              selectedField={selectedField}
              onSelectField={onSelectField}
              onRemoveField={onRemoveField}
              onRenameSection={(title) => onRenameSection(section.id, title)}
              onRemoveSection={() => onRemoveSection(section.id)}
            />
          ))}
        </Stack>
      </SortableContext>

      <Button
        variant="light"
        leftSection={<IconLayoutGridAdd size={16} />}
        onClick={onAddSection}
        data-testid="builder-add-section"
      >
        Add section
      </Button>
    </Stack>
  );
}

export default BuilderCanvas;
