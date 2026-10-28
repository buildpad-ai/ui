import type { MetaRecord } from 'nextra';

const meta: MetaRecord = {
  // Whole screens need the full content width; the frames carry their own nav.
  '*': { theme: { layout: 'full', toc: false } },
  forms: 'Forms',
  'data-views': 'Data views',
  states: 'Empty, loading & error states',
  'page-sections': 'Page headers & sections',
};

export default meta;
