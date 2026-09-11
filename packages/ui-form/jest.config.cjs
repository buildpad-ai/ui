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
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: ['node_modules/(?!(@mantine|@tabler)/)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
  ],
  coverageReporters: ['text', 'lcov'],
};

module.exports = config;
