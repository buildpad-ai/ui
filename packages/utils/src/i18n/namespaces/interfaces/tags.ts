/** `interfaces.tags` — strings of the Tags interface. */
export interface TagsTranslations {
  /** Default input placeholder (the `placeholder` prop overrides it) */
  placeholder: string;
  /** Heading shown above preset chips when no label is given */
  defaultLabel: string;
}

export const tagsDefaults: TagsTranslations = {
  placeholder: 'Add a tag...',
  defaultLabel: 'Tags',
};

export const tagsId: TagsTranslations = {
  placeholder: 'Tambahkan tag...',
  defaultLabel: 'Tag',
};
