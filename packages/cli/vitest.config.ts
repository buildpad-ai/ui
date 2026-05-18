import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/commands/transformer.ts',
        'src/utils/checksum.ts',
        'src/utils/changelog-parser.ts',
        'src/utils/three-way-merge.ts',
        'src/resolver.ts',
      ],
    },
  },
});
