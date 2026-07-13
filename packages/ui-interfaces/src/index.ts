/**
 * @buildpad/ui-interfaces
 * 
 * Shared UI interface components for Buildpad projects.
 * DaaS-compatible field interfaces built with Mantine v8.
 */

// Boolean / Toggle
export { Boolean } from './boolean';
export type { BooleanProps } from './boolean';
export { Toggle } from './toggle';
export type { ToggleProps } from './toggle';

// Date / Time
export { DateTime } from './datetime';
export type { DateTimeProps } from './datetime';

// Text inputs
export { Input } from './input';
export type { InputProps } from './input';
export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';
export { InputCode } from './input-code';
export type { InputCodeProps } from './input-code';
export { InputHash } from './input-hash';
export type { InputHashProps } from './input-hash';

// System Token
export { SystemToken } from './system-token';
export type { SystemTokenProps } from './system-token';

// System Permissions
export { SystemPermissions } from './system-permissions';
export type { SystemPermissionsProps, PermissionGroup, PermissionAlterations } from './system-permissions';

// Select / Dropdown
export { SelectDropdown } from './select-dropdown';
export type { SelectDropdownProps, SelectOption } from './select-dropdown';
export { SelectRadio } from './select-radio';
export type { SelectRadioProps } from './select-radio';
export { SelectMultipleCheckbox, SelectMultipleCheckboxTree, SelectMultipleDropdown } from './select-multiple-checkbox';
export type { SelectMultipleCheckboxProps, Option, SelectMultipleCheckboxTreeProps, TreeChoice, SelectMultipleDropdownProps, DropdownChoice } from './select-multiple-checkbox';
export { SelectIcon, IconDisplay } from './select-icon';
export type { SelectIconProps, IconDisplayProps, MappedIconProps } from './select-icon';

// Autocomplete
export { AutocompleteAPI } from './autocomplete-api';
export type { AutocompleteAPIProps } from './autocomplete-api';

// Collection Item Dropdown
export { CollectionItemDropdown } from './collection-item-dropdown';
export type { CollectionItemDropdownProps, CollectionItemDropdownValue } from './collection-item-dropdown';

// Color
export { Color } from './color';
export type { ColorProps } from './color';

// Tags
export { Tags } from './tags';
export type { TagsProps } from './tags';

// Slider
export { Slider } from './slider';
export type { SliderProps, SliderValueType } from './slider';

// Layout / Presentation
export { Divider } from './divider';
export type { DividerProps } from './divider';
export { Notice } from './notice';
export type { NoticeProps, NoticeType } from './notice';
export { GroupDetail } from './group-detail';
export type { GroupDetailProps } from './group-detail';
export { GroupAccordion } from './group-accordion';
export type { GroupAccordionProps } from './group-accordion';
export { GroupRaw } from './group-raw';
export type { GroupRawProps } from './group-raw';

// File interfaces - integrate with DaaS Files API via @buildpad/hooks
export { File, FileInterface } from './file';
export type { FileProps, FileInterfaceProps } from './file';
export { FileImage, FileImageInterface } from './file-image';
export type { FileImageProps, FileImageInterfaceProps } from './file-image';
export { Files, FilesInterface } from './files';
export type { FilesProps, FilesInterfaceProps } from './files';
export { Upload } from './upload';
export type { UploadProps, FileUpload } from './upload';

// Relational interfaces (placeholders - require render props)
export { ListM2MInterface } from './list-m2m';
export type { ListM2MInterfaceProps, ListM2MRenderProps } from './list-m2m';
export { SelectDropdownM2OInterface, ListM2OInterface } from './select-dropdown-m2o';
export type { SelectDropdownM2OInterfaceProps, SelectDropdownM2ORenderProps, ListM2OInterfaceProps, ListM2ORenderProps } from './select-dropdown-m2o';
export { ListO2MInterface } from './list-o2m';
export type { ListO2MInterfaceProps, ListO2MRenderProps } from './list-o2m';

// Full relational components (with hooks integration)
export { ListM2M } from './list-m2m';
export type { ListM2MProps } from './list-m2m';
export { SelectDropdownM2O, ListM2O } from './select-dropdown-m2o';
export type { SelectDropdownM2OProps, ListM2OProps } from './select-dropdown-m2o';
export { ListO2M } from './list-o2m';
export type { ListO2MProps } from './list-o2m';
export { ListM2A } from './list-m2a';
export type { ListM2AProps } from './list-m2a';

// Rich text editors
export { InputBlockEditor } from './input-block-editor';
export type { InputBlockEditorProps } from './input-block-editor';
export { RichTextHTML } from './rich-text-html';
export type { RichTextHTMLProps } from './rich-text-html';
export { RichTextMarkdown } from './rich-text-markdown';
export type { RichTextMarkdownProps } from './rich-text-markdown';

// Map interface
export { Map, MapWithRealMap } from './map';
export type { MapProps, MapWithRealMapProps, GeometryType, GeometryFormat, BasemapSource, DefaultView } from './map';

// Workflow Button - workflow state transition interface
export { WorkflowButton, useWorkflow } from './workflow-button';
export type {
  WorkflowButtonProps,
  UseWorkflowOptions,
  UseWorkflowReturn,
  WorkflowInstance,
  WorkflowState,
  WorkflowCommand,
  WorkflowAction,
  WorkflowDefinition,
  CommandOption,
} from './workflow-button';

