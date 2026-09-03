import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

const __dirname = import.meta.dirname;
const rootModules = resolve(__dirname, '../../node_modules');

/**
 * Alias the `@buildpad/*` workspace packages to their `src` entry points so
 * the tests exercise the live source (not a possibly-stale `dist`), and pin
 * react/react-dom to the root install to avoid a dual-React-copy crash.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@buildpad/types': resolve(__dirname, '../types/src'),
      '@buildpad/services': resolve(__dirname, '../services/src'),
      '@buildpad/hooks': resolve(__dirname, '../hooks/src'),
      '@buildpad/utils': resolve(__dirname, '../utils/src'),
      // Deep subpath alias must precede the package alias — Vite matches these
      // in order, so a bare '@buildpad/ui-interfaces' entry would otherwise
      // rewrite '@buildpad/ui-interfaces/select-icon' to '<src>/select-icon'
      // only by luck of path shape. Declared explicitly for clarity.
      '@buildpad/ui-interfaces/select-icon': resolve(__dirname, '../ui-interfaces/src/select-icon'),
      '@buildpad/ui-interfaces': resolve(__dirname, '../ui-interfaces/src'),
      // Without this, RolesManager/PoliciesManager/UsersManager — every suite
      // that renders a table — fails to resolve and silently collects 0 tests
      // unless ui-table happens to have been built.
      '@buildpad/ui-table': resolve(__dirname, '../ui-table/src'),
      'react': resolve(rootModules, 'react'),
      'react-dom': resolve(rootModules, 'react-dom'),
      'react/jsx-runtime': resolve(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(rootModules, 'react/jsx-dev-runtime'),
      // VTable (aliased ui-table source) imports @dnd-kit, which resolves from
      // ui-table's own node_modules and binds to the `.pnpm` React copy — a
      // second instance next to the hoisted root React that react-dom above
      // renders with (null-dispatcher crash in useSensor). Pin dnd-kit to the
      // root install for the same reason react/react-dom are.
      '@dnd-kit/core': resolve(rootModules, '@dnd-kit/core'),
      '@dnd-kit/sortable': resolve(rootModules, '@dnd-kit/sortable'),
      '@dnd-kit/utilities': resolve(rootModules, '@dnd-kit/utilities'),
    },
    // Aliased ui-interfaces sources must share ONE Mantine (and React) copy
    // with the tests — a second pnpm-keyed instance crashes with a null
    // dispatcher ("Cannot read properties of null (reading 'useContext')").
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@mantine/notifications'],
  },
});
