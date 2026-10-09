/**
 * Transformer Tests
 *
 * Unit tests for the import transformation logic.
 * These tests ensure:
 * - @buildpad/* imports are correctly transformed to local paths
 * - Relative imports are normalized correctly
 * - VForm-specific transformations work
 * - Edge cases are handled
 */

import { describe, expect, test } from "vitest";
import type { Config } from "../src/commands/init.js";
import {
  addOriginHeader,
  extractOriginInfo,
  normalizeImportPaths,
  toKebabCase,
  transformImports,
  transformIntraComponentImports,
  transformRelativeImports,
  transformVFormImports,
  rewriteBuildpadSpecifiers,
  transformRegistryFile,
  UnmappedImportError,
} from "../src/commands/transformer.js";

const defaultConfig: Config = {
  model: "copy-own",
  tsx: true,
  srcDir: false,
  aliases: {
    components: "@/components/ui",
    lib: "@/lib/buildpad",
  },
  installedLib: [],
  installedComponents: [],
};

describe("transformImports", () => {
  test("transforms @buildpad/types imports", () => {
    const input = `import { Field, Collection } from '@buildpad/types';`;
    const expected = `import { Field, Collection } from '@/lib/buildpad/types';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms @buildpad/types subpath imports", () => {
    const input = `import type { FileInfo } from '@buildpad/types/file';`;
    const expected = `import type { FileInfo } from '@/lib/buildpad/types/file';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms @buildpad/services imports", () => {
    const input = `import { apiRequest } from '@buildpad/services';`;
    const expected = `import { apiRequest } from '@/lib/buildpad/services';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms @buildpad/hooks imports", () => {
    const input = `import { useRelationM2M } from '@buildpad/hooks';`;
    const expected = `import { useRelationM2M } from '@/lib/buildpad/hooks';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms @buildpad/ui-interfaces imports", () => {
    const input = `import { Input, Select } from '@buildpad/ui-interfaces';`;
    const expected = `import { Input, Select } from '@/components/ui';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms @buildpad/ui-form imports", () => {
    const input = `import { VForm } from '@buildpad/ui-form';`;
    const expected = `import { VForm } from '@/components/ui/vform';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms @buildpad/utils imports", () => {
    const input = `import { cn, formatFileSize } from '@buildpad/utils';`;
    const expected = `import { cn, formatFileSize } from '@/lib/buildpad/utils';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms import type statements", () => {
    const input = `import type { FormField } from '@buildpad/types';`;
    const expected = `import type { FormField } from '@/lib/buildpad/types';`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("handles multiple imports in one file", () => {
    const input = `
import { Field } from '@buildpad/types';
import { apiRequest } from '@buildpad/services';
import { VForm } from '@buildpad/ui-form';
`;
    const result = transformImports(input, defaultConfig);
    expect(result).toContain("from '@/lib/buildpad/types'");
    expect(result).toContain("from '@/lib/buildpad/services'");
    expect(result).toContain("from '@/components/ui/vform'");
  });

  test("does not transform non-buildpad imports", () => {
    const input = `import React from 'react';
import { Button } from '@mantine/core';`;
    expect(transformImports(input, defaultConfig)).toBe(input);
  });

  test("respects custom aliases", () => {
    const customConfig: Config = {
      ...defaultConfig,
      aliases: {
        components: "~/ui",
        lib: "~/shared",
      },
    };
    const input = `import { Field } from '@buildpad/types';`;
    const expected = `import { Field } from '~/shared/types';`;
    expect(transformImports(input, customConfig)).toBe(expected);
  });

  test("transforms dynamic imports for @buildpad/services", () => {
    const input = `const FieldsService = (await import('@buildpad/services')).FieldsService;`;
    const expected = `const FieldsService = (await import('@/lib/buildpad/services')).FieldsService;`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });

  test("transforms dynamic imports for @buildpad/hooks", () => {
    const input = `const hook = await import('@buildpad/hooks');`;
    const expected = `const hook = await import('@/lib/buildpad/hooks');`;
    expect(transformImports(input, defaultConfig)).toBe(expected);
  });
});

describe("normalizeImportPaths", () => {
  test("converts PascalCase import to kebab-case", () => {
    const input = `import { FileImage } from './FileImage';`;
    const expected = `import { FileImage } from './file-image';`;
    expect(normalizeImportPaths(input)).toBe(expected);
  });

  test("converts nested PascalCase path", () => {
    const input = `import { Upload } from '../Upload/Upload';`;
    const expected = `import { Upload } from './upload';`;
    expect(normalizeImportPaths(input)).toBe(expected);
  });

  test("flattens a kebab-case folder + PascalCase file import to the folder's own flat target", () => {
    // The source layout is ui-interfaces/src/select-icon/SelectIcon.tsx, but
    // select-icon is delivered as the flat sibling components/ui/select-icon.tsx —
    // so the PascalCase filename must be dropped, not kebab-cased.
    const input = `import { paletteNameFromColor } from '../select-icon/SelectIcon';`;
    const expected = `import { paletteNameFromColor } from './select-icon';`;
    expect(normalizeImportPaths(input)).toBe(expected);
  });

  test("flattens a kebab-case folder dynamic import the same way", () => {
    const input = `import('../select-icon/SelectIcon').then((m) => ({ default: m.IconDisplay }))`;
    const expected = `import('./select-icon').then((m) => ({ default: m.IconDisplay }))`;
    expect(normalizeImportPaths(input)).toBe(expected);
  });

  test("preserves kebab-case imports", () => {
    const input = `import { Input } from './input';`;
    expect(normalizeImportPaths(input)).toBe(input);
  });

  test("skips files with preserve-casing directive", () => {
    const input = `// @buildpad-preserve-casing
import { FormField } from './FormField';`;
    expect(normalizeImportPaths(input)).toBe(input);
  });
});

describe("toKebabCase", () => {
  test("converts PascalCase to kebab-case", () => {
    expect(toKebabCase("InputBlockEditor")).toBe("input-block-editor");
    expect(toKebabCase("FileImage")).toBe("file-image");
    // Note: VForm becomes 'vform' not 'v-form' because V is a single letter
    expect(toKebabCase("VForm")).toBe("vform");
  });

  test("converts camelCase to kebab-case", () => {
    expect(toKebabCase("inputCode")).toBe("input-code");
    expect(toKebabCase("richTextHtml")).toBe("rich-text-html");
  });

  test("handles already kebab-case", () => {
    expect(toKebabCase("input-code")).toBe("input-code");
  });

  test("handles single word", () => {
    expect(toKebabCase("Input")).toBe("input");
    expect(toKebabCase("input")).toBe("input");
  });
});

describe("transformVFormImports", () => {
  test("preserves types import in components folder", () => {
    const input = `import type { FormField } from '../types';`;
    const result = transformVFormImports(
      input,
      "ui-form/src/components/FormField.tsx",
      "components/ui/vform/components/FormField.tsx",
    );
    expect(result).toContain("from '../types'");
  });

  test("handles root folder types import", () => {
    const input = `import type { FormField } from './types';`;
    const result = transformVFormImports(
      input,
      "ui-form/src/VForm.tsx",
      "components/ui/vform/VForm.tsx",
    );
    expect(result).toContain("from './types'");
  });
});

describe("transformRelativeImports", () => {
  test("transforms sibling imports from parent to current directory", () => {
    const input = `import { Upload } from '../upload';`;
    const result = transformRelativeImports(
      input,
      "ui-interfaces/src/file-image/FileImage.tsx",
      "components/ui/file-image.tsx",
      "@/components/ui",
    );
    expect(result).toContain("from './upload'");
  });

  test("transforms cross-component imports with kebab-case subpaths", () => {
    const input = `import { renderTemplate } from "../list-m2a/render-template";`;
    const result = transformRelativeImports(
      input,
      "ui-interfaces/src/list-m2m/ListM2M.tsx",
      "components/ui/list-m2m.tsx",
      "@/components/ui",
    );
    expect(result).toContain("./list-m2a/render-template");
    expect(result).not.toContain("../list-m2a/render-template");
  });
});

describe("addOriginHeader", () => {
  test("adds origin header to plain content", () => {
    const content = "export const Component = () => {};";
    const result = addOriginHeader(
      content,
      "input",
      "@buildpad/ui-interfaces",
      "1.0.0",
    );

    expect(result).toContain(
      "@buildpad-origin @buildpad/ui-interfaces/input",
    );
    expect(result).toContain("@buildpad-version 1.0.0");
    expect(result).toContain("export const Component");
  });

  test('adds header after "use client" directive', () => {
    const content = '"use client";\n\nexport const Component = () => {};';
    const result = addOriginHeader(
      content,
      "input",
      "@buildpad/ui-interfaces",
      "1.0.0",
    );

    expect(result.startsWith('"use client"')).toBe(true);
    expect(result).toContain("@buildpad-origin");
    expect(result).toContain("export const Component");
  });
});

describe("extractOriginInfo", () => {
  test("extracts origin info from header", () => {
    const content = `/**
 * @buildpad-origin @buildpad/ui-interfaces/input
 * @buildpad-version 1.0.0
 * @buildpad-date 2024-01-15
 */
export const Input = () => {};`;

    const info = extractOriginInfo(content);

    expect(info).not.toBeNull();
    expect(info?.origin).toBe("@buildpad/ui-interfaces/input");
    expect(info?.version).toBe("1.0.0");
    expect(info?.date).toBe("2024-01-15");
  });

  test("returns null for content without origin", () => {
    const content = "export const Input = () => {};";
    expect(extractOriginInfo(content)).toBeNull();
  });
});

// ─── VTable / Collection-List transform regression tests ─────────

const VTABLE_FILES = [
  { source: "ui-table/src/VTable.tsx", target: "components/ui/vtable.tsx" },
  { source: "ui-table/src/VTable.css", target: "components/ui/vtable.css" },
  {
    source: "ui-table/src/components/TableHeader.tsx",
    target: "components/ui/table-header.tsx",
  },
  {
    source: "ui-table/src/components/TableHeader.css",
    target: "components/ui/table-header.css",
  },
  {
    source: "ui-table/src/components/TableRow.tsx",
    target: "components/ui/table-row.tsx",
  },
  {
    source: "ui-table/src/components/TableRow.css",
    target: "components/ui/table-row.css",
  },
  { source: "ui-table/src/types.ts", target: "components/ui/vtable-types.ts" },
];

describe("transformIntraComponentImports (vtable)", () => {
  test("VTable.tsx: ./components/TableHeader → ./table-header", () => {
    const input = `import { TableHeader } from './components/TableHeader';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/VTable.tsx",
      "components/ui/vtable.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(`import { TableHeader } from './table-header';`);
  });

  test("VTable.tsx: ./components/TableRow → ./table-row", () => {
    const input = `import { TableRow } from './components/TableRow';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/VTable.tsx",
      "components/ui/vtable.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(`import { TableRow } from './table-row';`);
  });

  test("VTable.tsx: ./types → ./vtable-types", () => {
    const input = `import type { HeaderRaw, Header } from './types';\nimport { HeaderDefaults } from './types';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/VTable.tsx",
      "components/ui/vtable.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(
      `import type { HeaderRaw, Header } from './vtable-types';\nimport { HeaderDefaults } from './vtable-types';`,
    );
  });

  test("VTable.tsx: CSS import ./VTable.css → ./vtable.css", () => {
    const input = `import './VTable.css';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/VTable.tsx",
      "components/ui/vtable.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(`import './vtable.css';`);
  });

  test("TableHeader.tsx: ../types → ./vtable-types", () => {
    const input = `import type { Header, Sort, ShowSelect } from '../types';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/components/TableHeader.tsx",
      "components/ui/table-header.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(
      `import type { Header, Sort, ShowSelect } from './vtable-types';`,
    );
  });

  test("TableHeader.tsx: CSS import ./TableHeader.css → ./table-header.css", () => {
    const input = `import './TableHeader.css';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/components/TableHeader.tsx",
      "components/ui/table-header.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(`import './table-header.css';`);
  });

  test("TableRow.tsx: ../types → ./vtable-types", () => {
    const input = `import type { Header, Item, ShowSelect } from '../types';`;
    const result = transformIntraComponentImports(
      input,
      "ui-table/src/components/TableRow.tsx",
      "components/ui/table-row.tsx",
      VTABLE_FILES,
    );
    expect(result).toBe(
      `import type { Header, Item, ShowSelect } from './vtable-types';`,
    );
  });

  test("single-file component is skipped", () => {
    const input = `import { foo } from './bar';`;
    const singleFile = [
      { source: "pkg/Foo.tsx", target: "components/ui/foo.tsx" },
    ];
    const result = transformIntraComponentImports(
      input,
      "pkg/Foo.tsx",
      "components/ui/foo.tsx",
      singleFile,
    );
    expect(result).toBe(input);
  });
});

describe("transformImports (@buildpad/ui-table)", () => {
  test("value import → componentsAlias/vtable", () => {
    const input = `import { VTable } from '@buildpad/ui-table';`;
    const result = transformImports(input, defaultConfig);
    expect(result).toBe(`import { VTable } from '@/components/ui/vtable';`);
  });

  test("type import → componentsAlias/vtable-types", () => {
    const input = `import type { HeaderRaw, Sort, Alignment, Header } from '@buildpad/ui-table';`;
    const result = transformImports(input, defaultConfig);
    expect(result).toBe(
      `import type { HeaderRaw, Sort, Alignment, Header } from '@/components/ui/vtable-types';`,
    );
  });

  test("subpaths map to the registry targets they install as", () => {
    // Previously `@buildpad/ui-table/<x>` → `@/components/ui/<x>`, which only
    // exists by accident (types.ts installs as vtable-types.tsx). No shipped
    // file used a ui-table subpath.
    const input = [
      `import type { Header } from '@buildpad/ui-table/types';`,
      `import { VTable } from '@buildpad/ui-table/VTable';`,
      `import { TableHeader } from '@buildpad/ui-table/components/TableHeader';`,
      `import { TableRow } from '@buildpad/ui-table/components/TableRow';`,
    ].join("\n");
    expect(transformImports(input, defaultConfig)).toBe(
      [
        `import type { Header } from '@/components/ui/vtable-types';`,
        `import { VTable } from '@/components/ui/vtable';`,
        `import { TableHeader } from '@/components/ui/table-header';`,
        `import { TableRow } from '@/components/ui/table-row';`,
      ].join("\n"),
    );
  });

  test("a subpath the registry does not install fails instead of shipping a broken import", () => {
    expect(() => transformImports(`import { something } from '@buildpad/ui-table/utils';`, defaultConfig)).toThrow(
      UnmappedImportError,
    );
  });

  test("type-only imports of a component's props type go to that component", () => {
    expect(transformImports(`import type { VTableProps } from '@buildpad/ui-table';`, defaultConfig)).toBe(
      `import type { VTableProps } from '@/components/ui/vtable';`,
    );
    expect(transformImports(`import type { TableRowProps } from '@buildpad/ui-table';`, defaultConfig)).toBe(
      `import type { TableRowProps } from '@/components/ui/table-row';`,
    );
    expect(() =>
      transformImports(`import type { VTableProps, Header } from '@buildpad/ui-table';`, defaultConfig),
    ).toThrow(/split the import/);
  });

  test("export type { … } re-exports go to vtable-types like import type", () => {
    expect(transformImports(`export type { Header } from '@buildpad/ui-table';`, defaultConfig)).toBe(
      `export type { Header } from '@/components/ui/vtable-types';`,
    );
  });

});

describe("rewriteBuildpadSpecifiers — import forms and fail-closed", () => {
  const config = defaultConfig;

  test("side-effect, require, declare module and line-broken `from` are rewritten", () => {
    const input = [
      `import '@buildpad/ui-form/VForm.css';`,
      `const s = require("@buildpad/services");`,
      `declare module '@buildpad/types' {}`,
      `import {\n  a,\n} from\n  '@buildpad/hooks';`,
    ].join("\n");
    expect(rewriteBuildpadSpecifiers(input, config)).toBe(
      [
        `import '@/components/ui/vform/VForm.css';`,
        `const s = require('@/lib/buildpad/services');`,
        `declare module '@/lib/buildpad/types' {}`,
        `import {\n  a,\n} from\n  '@/lib/buildpad/hooks';`,
      ].join("\n"),
    );
  });

  test("dynamic import of any mapped specifier", () => {
    expect(rewriteBuildpadSpecifiers(`const m = await import( '@buildpad/services/auth/session' );`, config)).toBe(
      `const m = await import('@/lib/buildpad/services/auth/session');`,
    );
  });

  test("an unmapped @buildpad import throws, naming the specifier and line", () => {
    const run = () => rewriteBuildpadSpecifiers(`import x from 'react';\nimport { y } from '@buildpad/not-a-package';`, config);
    expect(run).toThrow(UnmappedImportError);
    expect(run).toThrow(/line 2: cannot rewrite '@buildpad\/not-a-package'/);
    expect(() => rewriteBuildpadSpecifiers(`import '@buildpad/mcp';`, config)).toThrow(/never installed/);
  });

  test("keepPublished (fix, on a consumer's own code) leaves @buildpad/cli and @buildpad/mcp as written", () => {
    const input = `import { s } from '@buildpad/mcp';\nimport type { C } from "@buildpad/cli/dist/x";\nimport { a } from '@buildpad/types';\n`;
    expect(rewriteBuildpadSpecifiers(input, config, { keepPublished: true })).toBe(
      `import { s } from '@buildpad/mcp';\nimport type { C } from "@buildpad/cli/dist/x";\nimport { a } from '@/lib/buildpad/types';\n`,
    );
    expect(() => rewriteBuildpadSpecifiers(`import '@buildpad/nope';`, config, { keepPublished: true })).toThrow(UnmappedImportError);
  });

  test("dynamic import() with magic comments, attributes or a trailing comma: only the literal changes", () => {
    expect(rewriteBuildpadSpecifiers(`import(/* webpackChunkName: 'h' */ '@buildpad/hooks')`, config)).toBe(
      `import(/* webpackChunkName: 'h' */ '@/lib/buildpad/hooks')`,
    );
    expect(rewriteBuildpadSpecifiers(`import("@buildpad/types", { with: { type: "json" } })`, config)).toBe(
      `import('@/lib/buildpad/types', { with: { type: "json" } })`,
    );
    expect(rewriteBuildpadSpecifiers(`import( '@buildpad/utils', )`, config)).toBe(`import( '@/lib/buildpad/utils', )`);
    expect(rewriteBuildpadSpecifiers('import(`@buildpad/ui-interfaces/upload`)', config)).toBe(
      `import('@/components/ui/upload')`,
    );
  });

  test("import() forms the scanner used to miss fail closed too", () => {
    expect(() => rewriteBuildpadSpecifiers(`import(/* webpackChunkName: "x" */ '@buildpad/bogus')`, config)).toThrow(UnmappedImportError);
    expect(() => rewriteBuildpadSpecifiers(`import('@buildpad/bogus', {})`, config)).toThrow(UnmappedImportError);
    expect(() => rewriteBuildpadSpecifiers('import(`@buildpad/ui-interfaces/${name}`)', config)).toThrow(/template literal/);
  });

  test("an unmapped specifier after a closed comment on the same line is code, and throws", () => {
    expect(() => rewriteBuildpadSpecifiers(`/* eslint-disable */ import { x } from '@buildpad/bogus';`, config)).toThrow(
      UnmappedImportError,
    );
    expect(() => rewriteBuildpadSpecifiers(`/**\n * doc\n */ import { x } from '@buildpad/bogus';`, config)).toThrow(
      /line 3/,
    );
  });

  test("transformRegistryFile names the shipped file in the error", () => {
    expect(() =>
      transformRegistryFile(
        `import { y } from '@buildpad/cli';`,
        { source: "ui-interfaces/src/x/X.tsx", target: "components/ui/x.tsx" },
        { kind: "component", name: "x", files: [] },
        config,
        "1.0.0",
      ),
    ).toThrow(/^ui-interfaces\/src\/x\/X\.tsx:1: cannot rewrite '@buildpad\/cli'/);
  });

  test("an unmapped specifier on a comment line is documentation, left as written", () => {
    const input = `/**\n * import { y } from '@buildpad/not-a-package';\n */\n// import { z } from '@buildpad/mcp';\n`;
    expect(rewriteBuildpadSpecifiers(input, config)).toBe(input);
  });

  test("mapped specifiers in comment lines are rewritten, as they always were", () => {
    expect(rewriteBuildpadSpecifiers(` * import { VForm } from "@buildpad/ui-form";`, config)).toBe(
      ` * import { VForm } from '@/components/ui/vform';`,
    );
  });

  test("ui-forms maps to the form-builder component", () => {
    expect(rewriteBuildpadSpecifiers(`import { FormBuilder } from '@buildpad/ui-forms';\nimport { D } from '@buildpad/ui-forms/DynamicForm';`, config)).toBe(
      `import { FormBuilder } from '@/components/ui/form-builder';\nimport { D } from '@/components/ui/form-builder/dynamic-form';`,
    );
  });

  test("ui-workflows maps to the workflow-management component, subpaths kebab-cased", () => {
    expect(
      rewriteBuildpadSpecifiers(
        [
          `import { WorkflowsManager } from '@buildpad/ui-workflows';`,
          `import type { WorkflowDetailProps } from "@buildpad/ui-workflows";`,
          `import { WorkflowDiagram } from '@buildpad/ui-workflows/WorkflowDiagram';`,
          `import { loadAllWorkflowPolicyOptions } from '@buildpad/ui-workflows/workflowPolicies';`,
          `const Detail = lazy(() => import('@buildpad/ui-workflows/WorkflowInstanceDetail'));`,
        ].join("\n"),
        config,
      ),
    ).toBe(
      [
        `import { WorkflowsManager } from '@/components/ui/workflow-management';`,
        `import type { WorkflowDetailProps } from '@/components/ui/workflow-management';`,
        `import { WorkflowDiagram } from '@/components/ui/workflow-management/workflow-diagram';`,
        `import { loadAllWorkflowPolicyOptions } from '@/components/ui/workflow-management/workflow-policies';`,
        `const Detail = lazy(() => import('@/components/ui/workflow-management/workflow-instance-detail'));`,
      ].join("\n"),
    );
  });

  test("ui-workflows follows a custom components alias", () => {
    expect(
      rewriteBuildpadSpecifiers(`export * from '@buildpad/ui-workflows';`, {
        ...config,
        aliases: { ...config.aliases, components: "~/ui" },
      }),
    ).toBe(`export * from '~/ui/workflow-management';`);
  });

  test("a workflow-management file keeps the React Flow stylesheet import and gets sibling paths", () => {
    const files = [
      { source: "ui-workflows/src/WorkflowDiagram.tsx", target: "components/ui/workflow-management/workflow-diagram.tsx" },
      { source: "ui-workflows/src/workflowDiagramModel.ts", target: "components/ui/workflow-management/workflow-diagram-model.ts" },
      { source: "ui-workflows/src/WorkflowManagerTable.css", target: "components/ui/workflow-management/workflow-manager-table.css" },
    ];
    const out = transformRegistryFile(
      [
        `"use client";`,
        `import { ReactFlow } from '@xyflow/react';`,
        `import '@xyflow/react/dist/style.css';`,
        `import { VTable } from '@buildpad/ui-table';`,
        `import type { Header } from '@buildpad/ui-table';`,
        `import { clampPage } from '@buildpad/utils';`,
        `import { toFlowNodes } from './workflowDiagramModel';`,
        `import './WorkflowManagerTable.css';`,
        ``,
      ].join("\n"),
      files[0],
      { kind: "component", name: "workflow-management", files, sourcePackage: "@buildpad/ui-workflows" },
      config,
      "2.7.0",
    );
    expect(out).toContain("@buildpad-origin @buildpad/ui-workflows/workflow-management");
    expect(out).toContain(`import { ReactFlow } from '@xyflow/react';`);
    expect(out).toContain(`import '@xyflow/react/dist/style.css';`);
    expect(out).toContain(`import { VTable } from '@/components/ui/vtable';`);
    expect(out).toContain(`import type { Header } from '@/components/ui/vtable-types';`);
    expect(out).toContain(`import { clampPage } from '@/lib/buildpad/utils';`);
    expect(out).toContain(`import { toFlowNodes } from './workflow-diagram-model';`);
    expect(out).toContain(`import './workflow-manager-table.css';`);
    expect(out).not.toMatch(/(from|import)\s+['"]@buildpad\//);
  });

  test("ui-cron maps to the cron-management component, subpaths kebab-cased", () => {
    expect(
      rewriteBuildpadSpecifiers(
        [
          `import { CronJobsManager } from '@buildpad/ui-cron';`,
          `import type { CronJobDetailProps, CronCodeEditorProps } from "@buildpad/ui-cron";`,
          `import { CronRunsTable } from '@buildpad/ui-cron/CronRunsTable';`,
          `import { useCronList } from '@buildpad/ui-cron/useCronList';`,
          `const Detail = lazy(() => import('@buildpad/ui-cron/CronJobDetail'));`,
        ].join("\n"),
        config,
      ),
    ).toBe(
      [
        `import { CronJobsManager } from '@/components/ui/cron-management';`,
        `import type { CronJobDetailProps, CronCodeEditorProps } from '@/components/ui/cron-management';`,
        `import { CronRunsTable } from '@/components/ui/cron-management/cron-runs-table';`,
        `import { useCronList } from '@/components/ui/cron-management/use-cron-list';`,
        `const Detail = lazy(() => import('@/components/ui/cron-management/cron-job-detail'));`,
      ].join("\n"),
    );
  });

  test("ui-cron follows a custom components alias", () => {
    expect(
      rewriteBuildpadSpecifiers(`export * from '@buildpad/ui-cron';`, {
        ...config,
        aliases: { ...config.aliases, components: "~/ui" },
      }),
    ).toBe(`export * from '~/ui/cron-management';`);
  });

  test("a cron-management file gets the installed InputCode and VTable, and sibling paths", () => {
    const files = [
      { source: "ui-cron/src/CronJobDetail.tsx", target: "components/ui/cron-management/cron-job-detail.tsx" },
      { source: "ui-cron/src/CronCodeEditor.tsx", target: "components/ui/cron-management/cron-code-editor.tsx" },
      { source: "ui-cron/src/cronFormat.ts", target: "components/ui/cron-management/cron-format.ts" },
      { source: "ui-cron/src/cronTableColumns.ts", target: "components/ui/cron-management/cron-table-columns.ts" },
      { source: "ui-cron/src/useCronList.ts", target: "components/ui/cron-management/use-cron-list.ts" },
      { source: "ui-cron/src/CronManagerTable.css", target: "components/ui/cron-management/cron-manager-table.css" },
    ];
    const out = transformRegistryFile(
      [
        `"use client";`,
        `import { InputCode } from '@buildpad/ui-interfaces/input-code';`,
        `import { VTable } from '@buildpad/ui-table';`,
        `import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';`,
        `import { useCronJobs, usePermissions } from '@buildpad/hooks';`,
        `import { CRON_JOBS_COLLECTION, type CronJobRecord } from '@buildpad/types';`,
        `import { interpolate, type CronTranslations } from '@buildpad/utils';`,
        `import { CronCodeEditor, type CronCodeEditorProps } from './CronCodeEditor';`,
        `import { CRON_DATE_TIME_FORMAT } from './cronFormat';`,
        `import { CRON_JOBS_COLUMNS, cronGridStyle } from './cronTableColumns';`,
        `import { useCronList } from './useCronList';`,
        `import './CronManagerTable.css';`,
        ``,
      ].join("\n"),
      files[0],
      { kind: "component", name: "cron-management", files, sourcePackage: "@buildpad/ui-cron" },
      config,
      "3.0.0",
    );
    expect(out).toContain("@buildpad-origin @buildpad/ui-cron/cron-management");
    expect(out).toContain(`import { InputCode } from '@/components/ui/input-code';`);
    expect(out).toContain(`import { VTable } from '@/components/ui/vtable';`);
    expect(out).toContain(`import type { Header, HeaderRaw, Item } from '@/components/ui/vtable-types';`);
    expect(out).toContain(`import { useCronJobs, usePermissions } from '@/lib/buildpad/hooks';`);
    expect(out).toContain(`import { CRON_JOBS_COLLECTION, type CronJobRecord } from '@/lib/buildpad/types';`);
    expect(out).toContain(`import { interpolate, type CronTranslations } from '@/lib/buildpad/utils';`);
    expect(out).toContain(`import { CronCodeEditor, type CronCodeEditorProps } from './cron-code-editor';`);
    expect(out).toContain(`import { CRON_DATE_TIME_FORMAT } from './cron-format';`);
    expect(out).toContain(`import { CRON_JOBS_COLUMNS, cronGridStyle } from './cron-table-columns';`);
    expect(out).toContain(`import { useCronList } from './use-cron-list';`);
    expect(out).toContain(`import './cron-manager-table.css';`);
    expect(out).not.toMatch(/(from|import)\s+['"]@buildpad\//);
  });

  test("ui-collections / ui-files / ui-users subpaths are kebab-cased like their targets", () => {
    expect(
      rewriteBuildpadSpecifiers(
        [
          `import { CollectionList } from '@buildpad/ui-collections/CollectionList';`,
          `import { D } from '@buildpad/ui-files/DeleteConfirmModal';`,
          `import { u } from '@buildpad/ui-users/userDisplay';`,
        ].join("\n"),
        config,
      ),
    ).toBe(
      [
        `import { CollectionList } from '@/components/ui/collection-list';`,
        `import { D } from '@/components/ui/file-manager/delete-confirm-modal';`,
        `import { u } from '@/components/ui/users-management/user-display';`,
      ].join("\n"),
    );
  });

  test("ui-interfaces <x>/<EntryFile> collapses to the flattened component; other subpaths are kept", () => {
    expect(
      rewriteBuildpadSpecifiers(
        [
          `import { Upload } from '@buildpad/ui-interfaces/upload/Upload';`,
          `import { M } from '@buildpad/ui-interfaces/list-m2a/ListM2A';`,
          `import { J } from '@buildpad/ui-interfaces/list-m2a/JunctionItemForm';`,
          `import { r } from '@buildpad/ui-interfaces/list-m2a/render-template';`,
        ].join("\n"),
        config,
      ),
    ).toBe(
      [
        `import { Upload } from '@/components/ui/upload';`,
        `import { M } from '@/components/ui/list-m2a';`,
        `import { J } from '@/components/ui/list-m2a/JunctionItemForm';`,
        `import { r } from '@/components/ui/list-m2a/render-template';`,
      ].join("\n"),
    );
  });
});

describe("dynamic import('@buildpad/ui-interfaces/<x>') — lazy-loaded interfaces", () => {
  test("rewrites to the component's path under the components alias", () => {
    const input = `const Input = lazy(() => import('@buildpad/ui-interfaces/input'));`;
    expect(transformImports(input, defaultConfig)).toBe(
      `const Input = lazy(() => import('@/components/ui/input'));`,
    );
  });

  test("normalises quotes and whitespace like every rewritten import()", () => {
    const input = `const T = lazy(() => import( "@buildpad/ui-interfaces/textarea" ).then(m => ({ default: m.Textarea })));`;
    expect(transformImports(input, defaultConfig)).toBe(
      `const T = lazy(() => import('@/components/ui/textarea').then(m => ({ default: m.Textarea })));`,
    );
  });

  test("follows a custom components alias", () => {
    const config = { ...defaultConfig, aliases: { components: "@/ui", lib: "@/lib/bp" } };
    expect(transformImports(`import('@buildpad/ui-interfaces/select-icon')`, config)).toBe(`import('@/ui/select-icon')`);
  });

  test("an <x>/<EntryFile> subpath collapses to the flattened component", () => {
    expect(transformImports(`import('@buildpad/ui-interfaces/upload/Upload')`, defaultConfig)).toBe(
      `import('@/components/ui/upload')`,
    );
  });

  test("inside a VForm file (casing kept) the alias path is untouched by normalisation", () => {
    const out = transformRegistryFile(
      `const L = lazy(() => import('@buildpad/ui-interfaces/list-m2a'));\nimport { F } from './FormField';\n`,
      { source: "ui-form/src/components/FormFieldInterface.tsx", target: "components/ui/vform/components/FormFieldInterface.tsx" },
      { kind: "component", name: "vform", files: [] },
      defaultConfig,
      "1.0.0",
    );
    expect(out).toContain(`const L = lazy(() => import('@/components/ui/list-m2a'));\nimport { F } from './FormField';`);
  });
});
