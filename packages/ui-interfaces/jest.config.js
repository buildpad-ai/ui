// Third-party packages that only ship ESM (or whose CJS build is broken under
// Jest) and therefore must be transpiled by ts-jest. They are pulled in by the
// package barrel (src/index.ts -> RichTextMarkdown), so without this any test
// importing '@buildpad/ui-interfaces' fails to load.
const esmPackages = ['@tiptap/extension-code-block-lowlight', 'lowlight', 'devlop'];

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__tests__/__mocks__/styleMock.js',
    '^@buildpad/types$': '<rootDir>/../types/src/index.ts',
    '^@buildpad/services$': '<rootDir>/../services/src/index.ts',
    '^@buildpad/hooks$': '<rootDir>/../hooks/src/index.ts',
    '^@buildpad/utils$': '<rootDir>/../utils/src/index.ts',
    '^@buildpad/ui-form$': '<rootDir>/../ui-form/src/index.ts',
    '^@buildpad/ui-table$': '<rootDir>/../ui-table/src/index.ts',
    // marked only publishes ESM/UMD; point Jest at the UMD (CJS) build.
    '^marked$': '<rootDir>/../../node_modules/marked/lib/marked.umd.js',
    // @mapbox/mapbox-gl-draw's "exports" entry is untranspiled ESM source;
    // point Jest at its UMD (CJS-compatible) bundle, same as `browser`.
    '^@mapbox/mapbox-gl-draw$':
      '<rootDir>/../../node_modules/@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw-unminified.js',
    // @tiptap/extension-code-block-lowlight's CJS build does
    // `__toESM(require('@tiptap/extension-code-block'), 1)` (node-mode interop),
    // which sets `.default` to the whole CJS exports object, so
    // `CodeBlock.extend` is undefined and importing the barrel (src/index.ts)
    // throws "default.extend is not a function". Load the ESM build instead and
    // let ts-jest transpile it (see `transform` / `transformIgnorePatterns`).
    '^@tiptap/extension-code-block-lowlight$':
      '<rootDir>/../../node_modules/@tiptap/extension-code-block-lowlight/dist/index.js',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    // ESM-only third-party files (see esmPackages / transformIgnorePatterns).
    [`/node_modules/(${esmPackages.join('|')})/.+\\.js$`]: 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // Any *.test.ts(x) under src, not only __tests__/: a narrower pattern let
  // nine colocated test files sit unrun (and rot) for months.
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transformIgnorePatterns: [
    `node_modules/(?!(@mantine|@tabler|${esmPackages.join('|')})/)`,
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
  ],
  coverageReporters: ['text', 'lcov'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
};

module.exports = config;
