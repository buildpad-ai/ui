/**
 * `interfaces` namespace — ui-interfaces, one sub-namespace per interface
 * folder (`interfaces.listM2M`, `interfaces.upload`, …), each in
 * `./interfaces/<folder>.ts` with its interface, English defaults and
 * Indonesian catalog. Add keys in the sub-namespace file; this composer only
 * assembles them.
 */
import { autocompleteApiDefaults, autocompleteApiId, type AutocompleteApiTranslations } from './interfaces/autocomplete-api';
import { booleanDefaults, booleanId, type BooleanTranslations } from './interfaces/boolean';
import { collectionItemDropdownDefaults, collectionItemDropdownId, type CollectionItemDropdownTranslations } from './interfaces/collection-item-dropdown';
import { colorDefaults, colorId, type ColorTranslations } from './interfaces/color';
import { datetimeDefaults, datetimeId, type DateTimeTranslations } from './interfaces/datetime';
import { dividerDefaults, dividerId, type DividerTranslations } from './interfaces/divider';
import { fileDefaults, fileId, type FileTranslations } from './interfaces/file';
import { fileImageDefaults, fileImageId, type FileImageTranslations } from './interfaces/file-image';
import { filesDefaults, filesId, type FilesTranslations } from './interfaces/files';
import { groupAccordionDefaults, groupAccordionId, type GroupAccordionTranslations } from './interfaces/group-accordion';
import { groupDetailDefaults, groupDetailId, type GroupDetailTranslations } from './interfaces/group-detail';
import { groupRawDefaults, groupRawId, type GroupRawTranslations } from './interfaces/group-raw';
import { inputDefaults, inputId, type InputTranslations } from './interfaces/input';
import { inputBlockEditorDefaults, inputBlockEditorId, type InputBlockEditorTranslations } from './interfaces/input-block-editor';
import { inputCodeDefaults, inputCodeId, type InputCodeTranslations } from './interfaces/input-code';
import { inputHashDefaults, inputHashId, type InputHashTranslations } from './interfaces/input-hash';
import { listM2ADefaults, listM2AId, type ListM2ATranslations } from './interfaces/list-m2a';
import { listM2MDefaults, listM2MId, type ListM2MTranslations } from './interfaces/list-m2m';
import { listO2MDefaults, listO2MId, type ListO2MTranslations } from './interfaces/list-o2m';
import { mapDefaults, mapId, type MapTranslations } from './interfaces/map';
import { noticeDefaults, noticeId, type NoticeTranslations } from './interfaces/notice';
import { richTextHtmlDefaults, richTextHtmlId, type RichTextHtmlTranslations } from './interfaces/rich-text-html';
import { richTextMarkdownDefaults, richTextMarkdownId, type RichTextMarkdownTranslations } from './interfaces/rich-text-markdown';
import { selectDropdownDefaults, selectDropdownId, type SelectDropdownTranslations } from './interfaces/select-dropdown';
import { selectDropdownM2ODefaults, selectDropdownM2OId, type SelectDropdownM2OTranslations } from './interfaces/select-dropdown-m2o';
import { selectIconDefaults, selectIconId, type SelectIconTranslations } from './interfaces/select-icon';
import { selectMultipleCheckboxDefaults, selectMultipleCheckboxId, type SelectMultipleCheckboxTranslations } from './interfaces/select-multiple-checkbox';
import { selectRadioDefaults, selectRadioId, type SelectRadioTranslations } from './interfaces/select-radio';
import { sliderDefaults, sliderId, type SliderTranslations } from './interfaces/slider';
import { systemPermissionsDefaults, systemPermissionsId, type SystemPermissionsTranslations } from './interfaces/system-permissions';
import { systemTokenDefaults, systemTokenId, type SystemTokenTranslations } from './interfaces/system-token';
import { tagsDefaults, tagsId, type TagsTranslations } from './interfaces/tags';
import { textareaDefaults, textareaId, type TextareaTranslations } from './interfaces/textarea';
import { toggleDefaults, toggleId, type ToggleTranslations } from './interfaces/toggle';
import { uploadDefaults, uploadId, type UploadTranslations } from './interfaces/upload';
import { workflowButtonDefaults, workflowButtonId, type WorkflowButtonTranslations } from './interfaces/workflow-button';

export type { AutocompleteApiTranslations, BooleanTranslations, CollectionItemDropdownTranslations, ColorTranslations, DateTimeTranslations, DividerTranslations, FileTranslations, FileImageTranslations, FilesTranslations, GroupAccordionTranslations, GroupDetailTranslations, GroupRawTranslations, InputTranslations, InputBlockEditorTranslations, InputCodeTranslations, InputHashTranslations, ListM2ATranslations, ListM2MTranslations, ListO2MTranslations, MapTranslations, NoticeTranslations, RichTextHtmlTranslations, RichTextMarkdownTranslations, SelectDropdownTranslations, SelectDropdownM2OTranslations, SelectIconTranslations, SelectMultipleCheckboxTranslations, SelectRadioTranslations, SliderTranslations, SystemPermissionsTranslations, SystemTokenTranslations, TagsTranslations, TextareaTranslations, ToggleTranslations, UploadTranslations, WorkflowButtonTranslations };

export interface InterfacesTranslations {
  autocompleteApi: AutocompleteApiTranslations;
  boolean: BooleanTranslations;
  collectionItemDropdown: CollectionItemDropdownTranslations;
  color: ColorTranslations;
  datetime: DateTimeTranslations;
  divider: DividerTranslations;
  file: FileTranslations;
  fileImage: FileImageTranslations;
  files: FilesTranslations;
  groupAccordion: GroupAccordionTranslations;
  groupDetail: GroupDetailTranslations;
  groupRaw: GroupRawTranslations;
  input: InputTranslations;
  inputBlockEditor: InputBlockEditorTranslations;
  inputCode: InputCodeTranslations;
  inputHash: InputHashTranslations;
  listM2A: ListM2ATranslations;
  listM2M: ListM2MTranslations;
  listO2M: ListO2MTranslations;
  map: MapTranslations;
  notice: NoticeTranslations;
  richTextHtml: RichTextHtmlTranslations;
  richTextMarkdown: RichTextMarkdownTranslations;
  selectDropdown: SelectDropdownTranslations;
  selectDropdownM2O: SelectDropdownM2OTranslations;
  selectIcon: SelectIconTranslations;
  selectMultipleCheckbox: SelectMultipleCheckboxTranslations;
  selectRadio: SelectRadioTranslations;
  slider: SliderTranslations;
  systemPermissions: SystemPermissionsTranslations;
  systemToken: SystemTokenTranslations;
  tags: TagsTranslations;
  textarea: TextareaTranslations;
  toggle: ToggleTranslations;
  upload: UploadTranslations;
  workflowButton: WorkflowButtonTranslations;
}

export const interfacesDefaults: InterfacesTranslations = {
  autocompleteApi: autocompleteApiDefaults,
  boolean: booleanDefaults,
  collectionItemDropdown: collectionItemDropdownDefaults,
  color: colorDefaults,
  datetime: datetimeDefaults,
  divider: dividerDefaults,
  file: fileDefaults,
  fileImage: fileImageDefaults,
  files: filesDefaults,
  groupAccordion: groupAccordionDefaults,
  groupDetail: groupDetailDefaults,
  groupRaw: groupRawDefaults,
  input: inputDefaults,
  inputBlockEditor: inputBlockEditorDefaults,
  inputCode: inputCodeDefaults,
  inputHash: inputHashDefaults,
  listM2A: listM2ADefaults,
  listM2M: listM2MDefaults,
  listO2M: listO2MDefaults,
  map: mapDefaults,
  notice: noticeDefaults,
  richTextHtml: richTextHtmlDefaults,
  richTextMarkdown: richTextMarkdownDefaults,
  selectDropdown: selectDropdownDefaults,
  selectDropdownM2O: selectDropdownM2ODefaults,
  selectIcon: selectIconDefaults,
  selectMultipleCheckbox: selectMultipleCheckboxDefaults,
  selectRadio: selectRadioDefaults,
  slider: sliderDefaults,
  systemPermissions: systemPermissionsDefaults,
  systemToken: systemTokenDefaults,
  tags: tagsDefaults,
  textarea: textareaDefaults,
  toggle: toggleDefaults,
  upload: uploadDefaults,
  workflowButton: workflowButtonDefaults,
};

export const interfacesId: InterfacesTranslations = {
  autocompleteApi: autocompleteApiId,
  boolean: booleanId,
  collectionItemDropdown: collectionItemDropdownId,
  color: colorId,
  datetime: datetimeId,
  divider: dividerId,
  file: fileId,
  fileImage: fileImageId,
  files: filesId,
  groupAccordion: groupAccordionId,
  groupDetail: groupDetailId,
  groupRaw: groupRawId,
  input: inputId,
  inputBlockEditor: inputBlockEditorId,
  inputCode: inputCodeId,
  inputHash: inputHashId,
  listM2A: listM2AId,
  listM2M: listM2MId,
  listO2M: listO2MId,
  map: mapId,
  notice: noticeId,
  richTextHtml: richTextHtmlId,
  richTextMarkdown: richTextMarkdownId,
  selectDropdown: selectDropdownId,
  selectDropdownM2O: selectDropdownM2OId,
  selectIcon: selectIconId,
  selectMultipleCheckbox: selectMultipleCheckboxId,
  selectRadio: selectRadioId,
  slider: sliderId,
  systemPermissions: systemPermissionsId,
  systemToken: systemTokenId,
  tags: tagsId,
  textarea: textareaId,
  toggle: toggleId,
  upload: uploadId,
  workflowButton: workflowButtonId,
};
