/**
 * Shared mock data for Storybook stories of the prop-driven components.
 *
 * Internal to the stories only — intentionally NOT exported from `index.ts`
 * and not bundled by tsup (it builds `src/index.ts` alone).
 */
import type { FileUpload, Folder } from '@buildpad/hooks';

const baseFile: FileUpload = {
  id: '70e79244-a2d5-45e4-ae98-612efa61eebc',
  filename_download: 'hero.png',
  filename_disk: '70e79244.png',
  type: 'image/png',
  filesize: 482_000,
  storage: 'files',
  width: 1920,
  height: 1080,
  uploaded_on: new Date('2026-06-01T10:30:00Z').toISOString(),
  modified_on: new Date('2026-06-02T08:15:00Z').toISOString(),
  uploaded_by: 'user',
};

/** One file per category, to exercise `getFileCategory` icons/badges. */
export const mockFiles: FileUpload[] = [
  baseFile,
  {
    ...baseFile,
    id: '11111111-1111-4111-8111-111111111111',
    filename_download: 'annual-report.pdf',
    filename_disk: '11111111.pdf',
    type: 'application/pdf',
    filesize: 240_000,
    width: undefined,
    height: undefined,
  },
  {
    ...baseFile,
    id: '22222222-2222-4222-8222-222222222222',
    filename_download: 'promo-clip.mp4',
    filename_disk: '22222222.mp4',
    type: 'video/mp4',
    filesize: 12_400_000,
    duration: 95,
    width: 1280,
    height: 720,
  },
  {
    ...baseFile,
    id: '33333333-3333-4333-8333-333333333333',
    filename_download: 'soundtrack.mp3',
    filename_disk: '33333333.mp3',
    type: 'audio/mpeg',
    filesize: 5_200_000,
    duration: 184,
    width: undefined,
    height: undefined,
  },
  {
    ...baseFile,
    id: '44444444-4444-4444-8444-444444444444',
    filename_download: 'assets-bundle.zip',
    filename_disk: '44444444.zip',
    type: 'application/zip',
    filesize: 8_900_000,
    width: undefined,
    height: undefined,
  },
];

export const mockFile = mockFiles[0];

export const mockFolders: Folder[] = [
  { id: 'f-marketing', name: 'Marketing', parent: null },
  { id: 'f-product', name: 'Product Shots', parent: null },
  { id: 'f-archive', name: 'Archive', parent: null },
];

export const mockFolder = mockFolders[0];

/** Folder choices for the metadata form's move-to-folder selector. */
export const mockFolderOptions = mockFolders.map((f) => ({
  value: f.id,
  label: f.name,
}));
