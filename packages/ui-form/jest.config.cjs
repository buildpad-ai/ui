/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/../ui-interfaces/src/__tests__/__mocks__/styleMock.js',
    '^@buildpad/types$': '<rootDir>/../types/src/index.ts',
    '^@buildpad/services$': '<rootDir>/../services/src/index.ts',
    '^@buildpad/hooks$': '<rootDir>/../hooks/src/index.ts',
    '^@buildpad/utils$': '<rootDir>/../utils/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // Any *.test.ts(x) under src, not only __tests__/: a narrower pattern let
  // nine colocated test files sit unrun (and rot) for months.
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transformIgnorePatterns: ['node_modules/(?!(@mantine|@tabler)/)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
  ],
  coverageReporters: ['text', 'lcov'],
  // Floors just under the coverage measured when they were added
  // (52.93 / 32.49 / 60.76 / 55.11); raise them as tests are added.
  coverageThreshold: { global: { statements: 51, branches: 31, functions: 59, lines: 54 } },
};

module.exports = config;
