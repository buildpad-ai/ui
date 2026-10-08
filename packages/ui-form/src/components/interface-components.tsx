/**
 * The interface components VForm renders, by export name.
 *
 * FormFieldInterface resolves a field to an export name through the interface
 * manifest (`getRenderedInterfaceEntry(type).exportName`) and looks the
 * component up here. Each one is imported from its own module, not from the
 * components barrel, so a form bundles only what this file names:
 *
 *   - EAGER_INTERFACE_COMPONENTS — light controls, imported statically and
 *     loaded with the form (manifest `loading: 'eager'`).
 *   - LAZY_INTERFACE_COMPONENTS — editors, the map, files and the relational
 *     tables, loaded when a field first renders one (manifest `loading:
 *     'lazy'` or `'client-only'`). FormFieldInterface shows a skeleton of the
 *     manifest's `fallbackHeight` meanwhile.
 *
 * The imports are written out, one literal per component, because a bundler
 * only splits a literal `import()`. Which table a component is in must match
 * its manifest `loading` class; packages/cli/tests/interface-tables.test.ts
 * checks that, and that every module here is one the `vform` registry entry
 * installs.
 *
 * To render an interface of your own, add its component to one of the tables
 * under the export name FormFieldInterface resolves for it (the PascalCase of
 * the interface id: `my-widget` → `MyWidget`).
 *
 * A name neither table has (`SystemPermissions`, which `vform` does not
 * install, or a project's own interface) is looked up on demand in the
 * components barrel: see `loadInstalledInterfaceComponent`.
 */

import { lazy, type ComponentType } from 'react';
import { Boolean as BooleanInterface } from '@buildpad/ui-interfaces/boolean';
import { Color } from '@buildpad/ui-interfaces/color';
import { DateTime } from '@buildpad/ui-interfaces/datetime';
import { Divider } from '@buildpad/ui-interfaces/divider';
import { GroupAccordion } from '@buildpad/ui-interfaces/group-accordion';
import { GroupDetail } from '@buildpad/ui-interfaces/group-detail';
import { GroupRaw } from '@buildpad/ui-interfaces/group-raw';
import { Input } from '@buildpad/ui-interfaces/input';
import { InputCode } from '@buildpad/ui-interfaces/input-code';
import { InputHash } from '@buildpad/ui-interfaces/input-hash';
import { Notice } from '@buildpad/ui-interfaces/notice';
import { SelectDropdown } from '@buildpad/ui-interfaces/select-dropdown';
import { SelectDropdownM2O } from '@buildpad/ui-interfaces/select-dropdown-m2o';
import { SelectMultipleCheckbox } from '@buildpad/ui-interfaces/select-multiple-checkbox';
import { SelectMultipleCheckboxTree } from '@buildpad/ui-interfaces/select-multiple-checkbox-tree';
import { SelectMultipleDropdown } from '@buildpad/ui-interfaces/select-multiple-dropdown';
import { SelectRadio } from '@buildpad/ui-interfaces/select-radio';
import { Slider } from '@buildpad/ui-interfaces/slider';
import { SystemToken } from '@buildpad/ui-interfaces/system-token';
import { Tags } from '@buildpad/ui-interfaces/tags';
import { Textarea } from '@buildpad/ui-interfaces/textarea';
import { Toggle } from '@buildpad/ui-interfaces/toggle';
import { WorkflowButton } from '@buildpad/ui-interfaces/workflow-button';

/** An interface component: each takes its own props, which FormFieldInterface builds from the field. */
export type InterfaceComponent = ComponentType<any>;

/** Loaded with the form. */
export const EAGER_INTERFACE_COMPONENTS: Record<string, InterfaceComponent> = {
  Boolean: BooleanInterface,
  Color,
  DateTime,
  Divider,
  GroupAccordion,
  GroupDetail,
  GroupRaw,
  Input,
  InputCode,
  InputHash,
  Notice,
  SelectDropdown,
  SelectDropdownM2O,
  SelectMultipleCheckbox,
  SelectMultipleCheckboxTree,
  SelectMultipleDropdown,
  SelectRadio,
  Slider,
  SystemToken,
  Tags,
  Textarea,
  Toggle,
  WorkflowButton,
};

/** Loaded when a field first renders one. */
export const LAZY_INTERFACE_COMPONENTS: Record<string, InterfaceComponent> = {
  AutocompleteAPI: lazy(() =>
    import('@buildpad/ui-interfaces/autocomplete-api').then((m) => ({ default: m.AutocompleteAPI })),
  ),
  CollectionItemDropdown: lazy(() =>
    import('@buildpad/ui-interfaces/collection-item-dropdown').then((m) => ({ default: m.CollectionItemDropdown })),
  ),
  File: lazy(() => import('@buildpad/ui-interfaces/file').then((m) => ({ default: m.File }))),
  FileImage: lazy(() => import('@buildpad/ui-interfaces/file-image').then((m) => ({ default: m.FileImage }))),
  Files: lazy(() => import('@buildpad/ui-interfaces/files').then((m) => ({ default: m.Files }))),
  // client-only: EditorJS reads `Element` when its module is evaluated, so
  // FormFieldInterface renders this one only after hydration.
  InputBlockEditor: lazy(() =>
    import('@buildpad/ui-interfaces/input-block-editor').then((m) => ({ default: m.InputBlockEditor })),
  ),
  ListM2A: lazy(() => import('@buildpad/ui-interfaces/list-m2a').then((m) => ({ default: m.ListM2A }))),
  ListM2M: lazy(() => import('@buildpad/ui-interfaces/list-m2m').then((m) => ({ default: m.ListM2M }))),
  ListO2M: lazy(() => import('@buildpad/ui-interfaces/list-o2m').then((m) => ({ default: m.ListO2M }))),
  Map: lazy(() => import('@buildpad/ui-interfaces/map').then((m) => ({ default: m.Map }))),
  RichTextHTML: lazy(() =>
    import('@buildpad/ui-interfaces/rich-text-html').then((m) => ({ default: m.RichTextHTML })),
  ),
  RichTextMarkdown: lazy(() =>
    import('@buildpad/ui-interfaces/rich-text-markdown').then((m) => ({ default: m.RichTextMarkdown })),
  ),
  SelectIcon: lazy(() => import('@buildpad/ui-interfaces/select-icon').then((m) => ({ default: m.SelectIcon }))),
};

const own = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

/** The component the tables above have for an export name, if any. */
export function getInterfaceComponent(exportName: string): InterfaceComponent | undefined {
  if (own(EAGER_INTERFACE_COMPONENTS, exportName)) return EAGER_INTERFACE_COMPONENTS[exportName];
  if (own(LAZY_INTERFACE_COMPONENTS, exportName)) return LAZY_INTERFACE_COMPONENTS[exportName];
  return undefined;
}

const installedLookups = new Map<string, Promise<InterfaceComponent | null>>();

/**
 * Look an export name up in the components barrel, for a name the tables
 * above do not have. Resolves to null when nothing installed exports it.
 *
 * The barrel holds every installed component, so it is imported on demand:
 * only a form that renders such a field loads it. A failed load is not kept,
 * so the next field to ask tries again.
 */
export function loadInstalledInterfaceComponent(exportName: string): Promise<InterfaceComponent | null> {
  let lookup = installedLookups.get(exportName);
  if (!lookup) {
    lookup = import('@buildpad/ui-interfaces').then((barrel) =>
      own(barrel, exportName) ? ((barrel as Record<string, unknown>)[exportName] as InterfaceComponent) || null : null,
    );
    lookup.catch(() => installedLookups.delete(exportName));
    installedLookups.set(exportName, lookup);
  }
  return lookup;
}
