# Component Map

Quick reference for finding component source files.

## High-Level Components

| Name | Command | Source | Description |
|------|---------|--------|-------------|
| `vform` | `buildpad add vform` | [ui-form/src/VForm.tsx](../packages/ui-form/src/VForm.tsx) | Dynamic form - renders 40+ interface types |
| `vtable` | `buildpad add vtable` | [ui-table/src/VTable.tsx](../packages/ui-table/src/VTable.tsx) | Dynamic table with sorting, selection, drag-drop |
| `collection-form` | `buildpad add collection-form` | [ui-collections/src/CollectionForm.tsx](../packages/ui-collections/src/CollectionForm.tsx) | CRUD wrapper with data fetching |
| `collection-list` | `buildpad add collection-list` | [ui-collections/src/CollectionList.tsx](../packages/ui-collections/src/CollectionList.tsx) | Dynamic table with pagination |
| `content-layout` | `buildpad add content-layout` | [ui-collections/src/ContentLayout.tsx](../packages/ui-collections/src/ContentLayout.tsx) | Shell layout with sidebar and main content |
| `content-navigation` | `buildpad add content-navigation` | [ui-collections/src/ContentNavigation.tsx](../packages/ui-collections/src/ContentNavigation.tsx) | Hierarchical collection navigation |
| `filter-panel` | `buildpad add filter-panel` | [ui-collections/src/FilterPanel.tsx](../packages/ui-collections/src/FilterPanel.tsx) | Field-type-aware filter builder |
| `save-options` | `buildpad add save-options` | [ui-collections/src/SaveOptions.tsx](../packages/ui-collections/src/SaveOptions.tsx) | Save action dropdown menu |

## Input Components

| Name | Command | Source |
|------|---------|--------|
| `input` | `buildpad add input` | [ui-interfaces/src/input/Input.tsx](../packages/ui-interfaces/src/input/Input.tsx) |
| `textarea` | `buildpad add textarea` | [ui-interfaces/src/textarea/Textarea.tsx](../packages/ui-interfaces/src/textarea/Textarea.tsx) |
| `input-code` | `buildpad add input-code` | [ui-interfaces/src/input-code/InputCode.tsx](../packages/ui-interfaces/src/input-code/InputCode.tsx) |
| `input-block-editor` | `buildpad add input-block-editor` | [ui-interfaces/src/input-block-editor/index.tsx](../packages/ui-interfaces/src/input-block-editor/index.tsx) (SSR-safe wrapper) |
| `tags` | `buildpad add tags` | [ui-interfaces/src/tags/Tags.tsx](../packages/ui-interfaces/src/tags/Tags.tsx) |
| `slider` | `buildpad add slider` | [ui-interfaces/src/slider/Slider.tsx](../packages/ui-interfaces/src/slider/Slider.tsx) |

## Selection Components

| Name | Command | Source |
|------|---------|--------|
| `select-dropdown` | `buildpad add select-dropdown` | [ui-interfaces/src/select-dropdown/SelectDropdown.tsx](../packages/ui-interfaces/src/select-dropdown/SelectDropdown.tsx) |
| `select-radio` | `buildpad add select-radio` | [ui-interfaces/src/select-radio/SelectRadio.tsx](../packages/ui-interfaces/src/select-radio/SelectRadio.tsx) |
| `select-multiple-checkbox` | `buildpad add select-multiple-checkbox` | [ui-interfaces/src/select-multiple-checkbox/SelectMultipleCheckbox.tsx](../packages/ui-interfaces/src/select-multiple-checkbox/SelectMultipleCheckbox.tsx) |
| `select-multiple-checkbox-tree` | `buildpad add select-multiple-checkbox-tree` | [ui-interfaces/src/select-multiple-checkbox/SelectMultipleCheckboxTree.tsx](../packages/ui-interfaces/src/select-multiple-checkbox/SelectMultipleCheckboxTree.tsx) |
| `select-multiple-dropdown` | `buildpad add select-multiple-dropdown` | [ui-interfaces/src/select-multiple-checkbox/SelectMultipleDropdown.tsx](../packages/ui-interfaces/src/select-multiple-checkbox/SelectMultipleDropdown.tsx) |
| `select-icon` | `buildpad add select-icon` | [ui-interfaces/src/select-icon/SelectIcon.tsx](../packages/ui-interfaces/src/select-icon/SelectIcon.tsx) |
| `autocomplete-api` | `buildpad add autocomplete-api` | [ui-interfaces/src/autocomplete-api/AutocompleteApi.tsx](../packages/ui-interfaces/src/autocomplete-api/AutocompleteApi.tsx) |
| `collection-item-dropdown` | `buildpad add collection-item-dropdown` | [ui-interfaces/src/collection-item-dropdown/CollectionItemDropdown.tsx](../packages/ui-interfaces/src/collection-item-dropdown/CollectionItemDropdown.tsx) |
| `color` | `buildpad add color` | [ui-interfaces/src/color/Color.tsx](../packages/ui-interfaces/src/color/Color.tsx) |

## Boolean Components

| Name | Command | Source |
|------|---------|--------|
| `boolean` | `buildpad add boolean` | [ui-interfaces/src/boolean/Boolean.tsx](../packages/ui-interfaces/src/boolean/Boolean.tsx) |
| `toggle` | `buildpad add toggle` | [ui-interfaces/src/toggle/Toggle.tsx](../packages/ui-interfaces/src/toggle/Toggle.tsx) |

## DateTime Components

| Name | Command | Source |
|------|---------|--------|
| `datetime` | `buildpad add datetime` | [ui-interfaces/src/datetime/DateTime.tsx](../packages/ui-interfaces/src/datetime/DateTime.tsx) |

## Media Components

| Name | Command | Source |
|------|---------|--------|
| `file` | `buildpad add file` | [ui-interfaces/src/file/File.tsx](../packages/ui-interfaces/src/file/File.tsx) |
| `file-image` | `buildpad add file-image` | [ui-interfaces/src/file-image/FileImage.tsx](../packages/ui-interfaces/src/file-image/FileImage.tsx) |
| `files` | `buildpad add files` | [ui-interfaces/src/files/Files.tsx](../packages/ui-interfaces/src/files/Files.tsx) |
| `upload` | `buildpad add upload` | [ui-interfaces/src/upload/Upload.tsx](../packages/ui-interfaces/src/upload/Upload.tsx) |

## Relational Components

| Name | Command | Source |
|------|---------|--------|
| `list-m2m` | `buildpad add list-m2m` | [ui-interfaces/src/list-m2m/ListM2M.tsx](../packages/ui-interfaces/src/list-m2m/ListM2M.tsx) |
| `select-dropdown-m2o` | `buildpad add select-dropdown-m2o` | [ui-interfaces/src/select-dropdown-m2o/SelectDropdownM2O.tsx](../packages/ui-interfaces/src/select-dropdown-m2o/SelectDropdownM2O.tsx) |
| `list-o2m` | `buildpad add list-o2m` | [ui-interfaces/src/list-o2m/ListO2M.tsx](../packages/ui-interfaces/src/list-o2m/ListO2M.tsx) |
| `list-m2a` | `buildpad add list-m2a` | [ui-interfaces/src/list-m2a/ListM2A.tsx](../packages/ui-interfaces/src/list-m2a/ListM2A.tsx) |

## Layout Components

| Name | Command | Source |
|------|---------|--------|
| `divider` | `buildpad add divider` | [ui-interfaces/src/divider/Divider.tsx](../packages/ui-interfaces/src/divider/Divider.tsx) |
| `notice` | `buildpad add notice` | [ui-interfaces/src/notice/Notice.tsx](../packages/ui-interfaces/src/notice/Notice.tsx) |
| `group-detail` | `buildpad add group-detail` | [ui-interfaces/src/group-detail/GroupDetail.tsx](../packages/ui-interfaces/src/group-detail/GroupDetail.tsx) |
| `group-accordion` | `buildpad add group-accordion` | [ui-interfaces/src/group-accordion/GroupAccordion.tsx](../packages/ui-interfaces/src/group-accordion/GroupAccordion.tsx) |
| `group-raw` | `buildpad add group-raw` | [ui-interfaces/src/group-raw/GroupRaw.tsx](../packages/ui-interfaces/src/group-raw/GroupRaw.tsx) |

## Rich Text Components

| Name | Command | Source |
|------|---------|--------|
| `rich-text-html` | `buildpad add rich-text-html` | [ui-interfaces/src/rich-text-html/RichTextHtml.tsx](../packages/ui-interfaces/src/rich-text-html/RichTextHtml.tsx) |
| `rich-text-markdown` | `buildpad add rich-text-markdown` | [ui-interfaces/src/rich-text-markdown/RichTextMarkdown.tsx](../packages/ui-interfaces/src/rich-text-markdown/RichTextMarkdown.tsx) |

## Map Components

| Name | Command | Source |
|------|---------|--------|
| `map` | `buildpad add map` | [ui-interfaces/src/map/Map.tsx](../packages/ui-interfaces/src/map/Map.tsx) |
| `map-with-real-map` | `buildpad add map-with-real-map` | [ui-interfaces/src/map/MapWithRealMap.tsx](../packages/ui-interfaces/src/map/MapWithRealMap.tsx) |

## Workflow Components

| Name | Command | Source |
|------|---------|--------|
| `workflow-button` | `buildpad add workflow-button` | [ui-interfaces/src/workflow-button/workflow-button.tsx](../packages/ui-interfaces/src/workflow-button/workflow-button.tsx) |

## Lib Modules (Auto-Installed as Dependencies)

| Module | Path | Description |
|--------|------|-------------|
| `types` | [types/src/](../packages/types/src/) | Core TypeScript types |
| `services` | [services/src/](../packages/services/src/) | API services, DaaSProvider, authentication |
| `hooks` | [hooks/src/](../packages/hooks/src/) | React hooks (useAuth, usePermissions, useRelationM2M, useRelationMultipleM2M, useFieldMetadata, etc.) |
| `utils` | [utils/src/](../packages/utils/src/) | Utility functions (field-interface-mapper, translate-field) |

## Dependency Reference

### VForm Dependencies (adds 32 components)
```
vform → types, services, hooks, utils
      → input, textarea, input-code, input-block-editor
      → boolean, toggle, datetime
      → select-dropdown, select-radio, select-icon, color, tags, slider
      → select-multiple-checkbox, select-multiple-dropdown, select-multiple-checkbox-tree
      → autocomplete-api, collection-item-dropdown
      → file, file-image, files, upload
      → list-m2m, select-dropdown-m2o, list-o2m, list-m2a
      → divider, notice, group-detail, group-accordion, group-raw
      → rich-text-html, rich-text-markdown
      → map, workflow-button
```

### CollectionForm Dependencies
```
collection-form → types, services → vform (includes all above)
```

## Common Tasks

```bash
# Add a single component
buildpad add input

# Add multiple components
buildpad add input select-dropdown datetime

# Add all selection components
buildpad add --category selection

# Add the complete form system (VForm + all interfaces)
buildpad add vform

# Add CRUD form with data fetching
buildpad add collection-form

# Bootstrap entire project (init + add all + deps + validate)
buildpad bootstrap --cwd /path/to/project

# List all available components
buildpad list

# See detailed info about a component
buildpad info vform

# Show dependency tree
buildpad tree collection-form

# Validate installation (check for issues)
buildpad validate
```
