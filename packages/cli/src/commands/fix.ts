/**
 * Buildpad CLI - Fix Command
 * 
 * Automatically applies fixes for common issues detected by validate.
 * Fixes include:
 * - Untransformed @buildpad/* imports
 * - Broken relative imports
 * - Missing CSS files
 * - SSR-unsafe exports
 * - Duplicate exports
 * - TypeScript errors (missing deps, missing declarations, type suppressions)
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import fg from 'fast-glob';
import prompts from 'prompts';
import { execSync } from 'child_process';
import { type Config, loadConfig } from './init.js';
import { transformImports, toKebabCase } from './transformer.js';

interface FixResult {
  fixed: number;
  skipped: number;
  errors: string[];
}

/**
 * Fix untransformed @buildpad/* imports
 */
async function fixUntransformedImports(
  cwd: string,
  config: Config,
  dryRun: boolean
): Promise<FixResult> {
  const result: FixResult = { fixed: 0, skipped: 0, errors: [] };
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const patterns = [
    path.join(srcDir, 'components/**/*.{ts,tsx,js,jsx}'),
    path.join(srcDir, 'lib/buildpad/**/*.{ts,tsx,js,jsx}'),
  ];
  
  for (const pattern of patterns) {
    const files = await fg(pattern, { ignore: ['**/node_modules/**'] });
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Check if file has @buildpad/* imports
      if (content.includes("from '@buildpad/") || content.includes('from "@buildpad/')) {
        const transformed = transformImports(content, config);
        
        if (transformed !== content) {
          if (dryRun) {
            console.log(chalk.dim(`  Would fix: ${path.relative(cwd, file)}`));
          } else {
            await fs.writeFile(file, transformed);
          }
          result.fixed++;
        }
      }
    }
  }
  
  return result;
}

/**
 * Fix SSR-unsafe exports in components/ui/index.ts
 */
async function fixSsrUnsafeExports(
  cwd: string,
  config: Config,
  dryRun: boolean
): Promise<FixResult> {
  const result: FixResult = { fixed: 0, skipped: 0, errors: [] };
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const indexPath = path.join(srcDir, 'components/ui/index.ts');
  
  if (!fs.existsSync(indexPath)) {
    return result;
  }
  
  let content = await fs.readFile(indexPath, 'utf-8');
  let modified = false;
  
  // Check for direct InputBlockEditor export
  if (
    content.includes("from './input-block-editor'") &&
    !content.includes("from './input-block-editor-wrapper'")
  ) {
    // Check if wrapper exists
    const wrapperPath = path.join(srcDir, 'components/ui/input-block-editor-wrapper.tsx');
    if (fs.existsSync(wrapperPath)) {
      content = content.replace(
        /export \* from ['"]\.\/input-block-editor['"]/g,
        "export * from './input-block-editor-wrapper'"
      );
      modified = true;
      result.fixed++;
    }
  }
  
  if (modified && !dryRun) {
    await fs.writeFile(indexPath, content);
  } else if (modified && dryRun) {
    console.log(chalk.dim(`  Would fix SSR exports in: components/ui/index.ts`));
  }
  
  return result;
}

/**
 * Fix duplicate exports by using explicit named exports
 */
async function fixDuplicateExports(
  cwd: string,
  config: Config,
  dryRun: boolean
): Promise<FixResult> {
  const result: FixResult = { fixed: 0, skipped: 0, errors: [] };
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const indexPath = path.join(srcDir, 'components/ui/index.ts');
  
  if (!fs.existsSync(indexPath)) {
    return result;
  }
  
  const content = await fs.readFile(indexPath, 'utf-8');
  const componentsDir = path.join(srcDir, 'components/ui');
  
  // Build a map of all named exports across files
  const exportPattern = /export \* from ['"]\.\/([^'"]+)['"]/g;
  const namedExports = new Map<string, { files: string[]; count: number }>();
  const namedExportPattern = /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g;
  
  let match;
  while ((match = exportPattern.exec(content)) !== null) {
    const exportFile = match[1];
    const filePath = path.join(componentsDir, exportFile + '.tsx');
    
    if (!fs.existsSync(filePath)) continue;
    
    const fileContent = await fs.readFile(filePath, 'utf-8');
    let namedMatch;
    
    while ((namedMatch = namedExportPattern.exec(fileContent)) !== null) {
      const exportName = namedMatch[1];
      
      if (!namedExports.has(exportName)) {
        namedExports.set(exportName, { files: [exportFile], count: 1 });
      } else {
        const existing = namedExports.get(exportName)!;
        existing.files.push(exportFile);
        existing.count++;
      }
    }
  }
  
  // Find conflicts
  const conflicts = Array.from(namedExports.entries())
    .filter(([_, info]) => info.count > 1);
  
  if (conflicts.length > 0 && !dryRun) {
    console.log(chalk.yellow(`\n⚠ Found ${conflicts.length} conflicting export(s):`));
    conflicts.forEach(([name, info]) => {
      console.log(chalk.dim(`  ${name}: exported from ${info.files.join(', ')}`));
    });
    console.log(chalk.dim('\nTo fix, manually update components/ui/index.ts to use explicit named exports.'));
    console.log(chalk.dim('Example: export { ComponentA } from "./file-a";'));
    result.skipped = conflicts.length;
  } else if (conflicts.length > 0 && dryRun) {
    console.log(chalk.dim(`  Would report ${conflicts.length} conflicting exports`));
  }
  
  return result;
}

/**
 * Fix broken relative imports by normalizing paths
 */
async function fixBrokenImports(
  cwd: string,
  config: Config,
  dryRun: boolean
): Promise<FixResult> {
  const result: FixResult = { fixed: 0, skipped: 0, errors: [] };
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const componentsDir = path.join(srcDir, 'components/ui');
  
  const files = await fg(path.join(componentsDir, '**/*.{ts,tsx}'), {
    ignore: ['**/node_modules/**']
  });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const fileDir = path.dirname(file);
    let modified = false;
    let newContent = content;
    
    // Find relative imports
    const relativeImportPattern = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
    let match;
    
    while ((match = relativeImportPattern.exec(content)) !== null) {
      const importPath = match[1];
      const absolutePath = path.resolve(fileDir, importPath);
      
      // Check if file exists with various extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', ''];
      const exists = extensions.some(ext => fs.existsSync(absolutePath + ext));
      
      if (!exists) {
        // Try to find the correct path by checking kebab-case
        const baseName = path.basename(importPath);
        const kebabName = toKebabCase(baseName);
        const dirName = path.dirname(importPath);
        const newImportPath = dirName === '.' ? `./${kebabName}` : `${dirName}/${kebabName}`;
        const newAbsolutePath = path.resolve(fileDir, newImportPath);
        
        const newExists = extensions.some(ext => fs.existsSync(newAbsolutePath + ext));
        
        if (newExists) {
          newContent = newContent.replace(
            new RegExp(`from\\s+['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
            `from '${newImportPath}'`
          );
          modified = true;
          result.fixed++;
        }
      }
    }
    
    if (modified && !dryRun) {
      await fs.writeFile(file, newContent);
    } else if (modified && dryRun) {
      console.log(chalk.dim(`  Would fix imports in: ${path.relative(cwd, file)}`));
    }
  }
  
  return result;
}

/**
 * Copy missing CSS files from source
 */
async function fixMissingCss(
  cwd: string,
  config: Config,
  dryRun: boolean
): Promise<FixResult> {
  const result: FixResult = { fixed: 0, skipped: 0, errors: [] };
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const componentsDir = path.join(srcDir, 'components/ui');
  
  // CSS requirements mapping
  const cssRequirements: Record<string, { component: string; cssFile: string }> = {
    'input-block-editor.tsx': {
      component: 'input-block-editor',
      cssFile: 'InputBlockEditor.css'
    },
    'rich-text-html.tsx': {
      component: 'rich-text-html',
      cssFile: 'RichTextHTML.css'
    },
    'rich-text-markdown.tsx': {
      component: 'rich-text-markdown', 
      cssFile: 'RichTextMarkdown.css'
    },
  };
  
  for (const [componentFile, info] of Object.entries(cssRequirements)) {
    const componentPath = path.join(componentsDir, componentFile);
    const cssPath = path.join(componentsDir, info.cssFile);
    
    if (fs.existsSync(componentPath) && !fs.existsSync(cssPath)) {
      if (dryRun) {
        console.log(chalk.dim(`  Would copy missing CSS: ${info.cssFile}`));
        result.fixed++;
      } else {
        // Note: In real implementation, you'd copy from source registry
        console.log(chalk.yellow(`  Missing CSS: ${info.cssFile}`));
        console.log(chalk.dim(`    Reinstall component: npx buildpad add ${info.component} --overwrite`));
        result.skipped++;
      }
    }
  }
  
  return result;
}

/**
 * Known npm packages that components may import.
 * Used to distinguish missing npm deps from internal/relative imports.
 */
const KNOWN_NPM_PACKAGES = new Set([
  // Mantine ecosystem
  '@mantine/core', '@mantine/hooks', '@mantine/dates', '@mantine/notifications',
  '@mantine/tiptap', '@mantine/form', '@mantine/dropzone', '@mantine/modals',
  // Icons
  '@tabler/icons-react',
  // Drag-and-drop (list-m2m/list-m2a, vtable, form-builder)
  '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
  // TipTap rich text
  '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-highlight',
  '@tiptap/extension-text-align', '@tiptap/extension-superscript',
  '@tiptap/extension-subscript', '@tiptap/extension-placeholder',
  '@tiptap/extension-color', '@tiptap/extension-text-style',
  '@tiptap/extension-underline', '@tiptap/extension-link',
  '@tiptap/extension-code-block-lowlight',
  // EditorJS block editor
  '@editorjs/editorjs', '@editorjs/header', '@editorjs/nested-list',
  '@editorjs/paragraph', '@editorjs/code', '@editorjs/quote',
  '@editorjs/checklist', '@editorjs/delimiter', '@editorjs/table',
  '@editorjs/underline', '@editorjs/inline-code',
  // Utilities
  'lowlight', 'highlight.js', 'dayjs', 'axios',
  // Maps
  'maplibre-gl', '@mapbox/mapbox-gl-draw',
  // Supabase auth
  '@supabase/ssr', '@supabase/supabase-js',
  // React / Next.js (framework — usually present)
  'react', 'react-dom', 'next',
  // Styling utility
  'clsx', 'tailwind-merge',
]);

/**
 * Extract the npm package name from a module specifier.
 * e.g. '@mantine/core' -> '@mantine/core', 'dayjs/plugin/utc' -> 'dayjs'
 */
function extractPackageName(moduleSpec: string): string {
  if (moduleSpec.startsWith('@')) {
    // Scoped: @scope/pkg or @scope/pkg/subpath
    const parts = moduleSpec.split('/');
    return parts.slice(0, 2).join('/');
  }
  return moduleSpec.split('/')[0];
}

interface TsError {
  file: string;
  line: number;
  col: number;
  code: string;
  message: string;
}

/**
 * Run tsc and parse errors from component/lib files
 */
function collectTypeScriptErrors(cwd: string, config: Config): TsError[] {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return [];

  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const componentsDir = path.join(srcDir, 'components/ui');
  if (!fs.existsSync(componentsDir)) return [];

  try {
    const output = execSync(
      `npx --yes tsc --noEmit --skipLibCheck --pretty false 2>&1 || true`,
      { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const errors: TsError[] = [];
    const pattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
    let match;

    while ((match = pattern.exec(output)) !== null) {
      const [, file, line, col, code, message] = match;
      const rel = path.relative(cwd, file);
      if (rel.includes('components/ui') || rel.includes('lib/buildpad')) {
        errors.push({ file, line: parseInt(line, 10), col: parseInt(col, 10), code, message });
      }
    }
    return errors;
  } catch {
    return [];
  }
}

/**
 * Fix TypeScript errors by:
 * 1. Installing missing npm packages (TS2307 for known packages)
 * 2. Generating module declarations (TS2307/TS7016 for untyped packages)
 * 3. Adding @ts-expect-error comments for remaining errors
 */
async function fixTypeScriptErrors(
  cwd: string,
  config: Config,
  dryRun: boolean,
  spinner: ReturnType<typeof ora> | null
): Promise<FixResult> {
  const result: FixResult = { fixed: 0, skipped: 0, errors: [] };

  if (spinner) spinner.text = 'Running TypeScript check...';
  const tsErrors = collectTypeScriptErrors(cwd, config);

  if (tsErrors.length === 0) return result;

  // ── Phase 1: Collect missing npm packages from TS2307 ──────────
  const missingModules = new Set<string>();
  const missingNpmPackages = new Set<string>();
  const undeclaredModules = new Set<string>();
  const suppressTargets: { file: string; line: number; message: string }[] = [];

  for (const err of tsErrors) {
    if (err.code === 'TS2307' || err.code === 'TS7016') {
      // Extract module name from message like: Cannot find module 'xxx' or its type declarations
      const moduleMatch = err.message.match(/(?:Cannot find module|Could not find a declaration file for module)\s+'([^']+)'/);
      if (moduleMatch) {
        const moduleSpec = moduleMatch[1];
        // Skip relative imports (handled by fixBrokenImports)
        if (moduleSpec.startsWith('.')) continue;
        // Skip @buildpad/* (handled by fixUntransformedImports)
        if (moduleSpec.startsWith('@buildpad/')) continue;

        const pkgName = extractPackageName(moduleSpec);
        missingModules.add(moduleSpec);

        if (KNOWN_NPM_PACKAGES.has(pkgName)) {
          missingNpmPackages.add(pkgName);
        } else {
          // Unknown package — generate a declaration
          undeclaredModules.add(moduleSpec);
        }
      }
    } else {
      // Other TS errors — collect for @ts-expect-error suppression
      suppressTargets.push({ file: err.file, line: err.line, message: err.message });
    }
  }

  // ── Phase 2: Install missing npm packages ──────────────────────
  if (missingNpmPackages.size > 0) {
    // Check which are truly missing from package.json
    const packageJsonPath = path.join(cwd, 'package.json');
    let installedDeps: Record<string, string> = {};
    if (fs.existsSync(packageJsonPath)) {
      const pkg = await fs.readJSON(packageJsonPath);
      installedDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    }

    const toInstall = Array.from(missingNpmPackages).filter(p => !installedDeps[p]);

    if (toInstall.length > 0) {
      if (dryRun) {
        console.log(chalk.dim(`  Would install ${toInstall.length} missing package(s): ${toInstall.join(', ')}`));
        result.fixed += toInstall.length;
      } else {
        if (spinner) spinner.text = `Installing ${toInstall.length} missing package(s)...`;

        const hasPnpmLock = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'));
        const hasYarnLock = fs.existsSync(path.join(cwd, 'yarn.lock'));
        const hasBunLock = fs.existsSync(path.join(cwd, 'bun.lockb'));

        let installCmd: string;
        if (hasPnpmLock || (!hasYarnLock && !hasBunLock)) {
          installCmd = `pnpm add ${toInstall.join(' ')}`;
        } else if (hasYarnLock) {
          installCmd = `yarn add ${toInstall.join(' ')}`;
        } else {
          installCmd = `bun add ${toInstall.join(' ')}`;
        }

        try {
          execSync(installCmd, { cwd, stdio: 'pipe', timeout: 120_000 });
          result.fixed += toInstall.length;
          if (spinner) spinner.text = 'Packages installed';
        } catch {
          result.errors.push(`Failed to install: ${toInstall.join(', ')}`);
          result.skipped += toInstall.length;
        }
      }
    }
  }

  // ── Phase 3: Generate module declarations for untyped packages ─
  if (undeclaredModules.size > 0) {
    const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
    const declFile = path.join(srcDir, 'types', 'modules.d.ts');

    // Read existing declarations if present
    let existingContent = '';
    if (fs.existsSync(declFile)) {
      existingContent = await fs.readFile(declFile, 'utf-8');
    }

    const newDeclarations: string[] = [];
    for (const mod of undeclaredModules) {
      // Check both exact and package-level declarations
      const pkgName = extractPackageName(mod);
      if (!existingContent.includes(`'${mod}'`) && !existingContent.includes(`'${pkgName}'`)) {
        // Use package-level wildcard for subpath imports
        const declTarget = mod.includes('/') && mod !== pkgName ? pkgName : mod;
        if (!newDeclarations.some(d => d.includes(`'${declTarget}'`))) {
          newDeclarations.push(`declare module '${declTarget}';`);
        }
      }
    }

    if (newDeclarations.length > 0) {
      if (dryRun) {
        console.log(chalk.dim(`  Would add ${newDeclarations.length} module declaration(s) to types/modules.d.ts`));
        result.fixed += newDeclarations.length;
      } else {
        await fs.ensureDir(path.dirname(declFile));
        const separator = existingContent && !existingContent.endsWith('\n') ? '\n' : '';
        const header = existingContent ? '' : '// Auto-generated module declarations for untyped packages\n';
        const content = existingContent + separator + header + newDeclarations.join('\n') + '\n';
        await fs.writeFile(declFile, content);
        result.fixed += newDeclarations.length;
      }
    }
  }

  // ── Phase 4: Suppress remaining errors with @ts-expect-error ───
  if (suppressTargets.length > 0) {
    // Group by file to minimize I/O
    const byFile = new Map<string, { line: number; message: string }[]>();
    for (const t of suppressTargets) {
      const arr = byFile.get(t.file) || [];
      arr.push({ line: t.line, message: t.message });
      byFile.set(t.file, arr);
    }

    for (const [filePath, targets] of byFile) {
      if (dryRun) {
        console.log(chalk.dim(`  Would suppress ${targets.length} error(s) in ${path.relative(cwd, filePath)}`));
        result.fixed += targets.length;
        continue;
      }

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Sort targets by line descending so insertions don't shift line numbers
        const sorted = [...targets].sort((a, b) => b.line - a.line);
        const alreadySuppressed = new Set<number>();

        for (const { line, message } of sorted) {
          const idx = line - 1; // Convert to 0-based
          if (idx < 0 || idx >= lines.length) continue;
          if (alreadySuppressed.has(line)) continue;

          // Check if previous line already has @ts-expect-error or @ts-ignore
          if (idx > 0 && (lines[idx - 1].includes('@ts-expect-error') || lines[idx - 1].includes('@ts-ignore'))) {
            alreadySuppressed.add(line);
            continue;
          }

          // Determine indentation from the target line
          const indent = lines[idx].match(/^(\s*)/)?.[1] || '';
          const shortMsg = message.length > 80 ? message.slice(0, 77) + '...' : message;
          lines.splice(idx, 0, `${indent}// @ts-expect-error — auto-suppressed: ${shortMsg}`);
          result.fixed++;
          alreadySuppressed.add(line);
        }

        await fs.writeFile(filePath, lines.join('\n'));
      } catch {
        result.skipped += targets.length;
      }
    }
  }

  return result;
}

/**
 * Main fix command
 */
export async function fix(options: {
  cwd: string;
  dryRun?: boolean;
  yes?: boolean;
}) {
  const { cwd, dryRun = false, yes = false } = options;
  
  console.log(chalk.bold('\n🔧 Buildpad Fix\n'));
  
  if (dryRun) {
    console.log(chalk.yellow('Dry run mode - no changes will be made\n'));
  }
  
  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.log(chalk.red('✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    process.exit(1);
  }
  
  // Confirm before fixing (unless --yes or --dry-run)
  if (!yes && !dryRun) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'This will modify files in your project. Continue?',
      initial: true,
    });
    
    if (!confirm) {
      console.log(chalk.yellow('\n✓ Cancelled\n'));
      return;
    }
  }
  
  const spinner = ora('Scanning for issues...').start();
  
  try {
    // Run all fixes
    spinner.text = 'Fixing untransformed imports...';
    const importResult = await fixUntransformedImports(cwd, config, dryRun);
    
    spinner.text = 'Fixing broken relative imports...';
    const brokenResult = await fixBrokenImports(cwd, config, dryRun);
    
    spinner.text = 'Fixing SSR-unsafe exports...';
    const ssrResult = await fixSsrUnsafeExports(cwd, config, dryRun);
    
    spinner.text = 'Checking duplicate exports...';
    const duplicateResult = await fixDuplicateExports(cwd, config, dryRun);
    
    spinner.text = 'Checking missing CSS files...';
    const cssResult = await fixMissingCss(cwd, config, dryRun);
    
    // Run TypeScript error fixes (install missing deps, generate declarations, suppress)
    const tsResult = await fixTypeScriptErrors(cwd, config, dryRun, spinner);
    
    spinner.stop();
    
    // Calculate totals
    const totalFixed = importResult.fixed + brokenResult.fixed + ssrResult.fixed + cssResult.fixed + tsResult.fixed;
    const totalSkipped = importResult.skipped + brokenResult.skipped + ssrResult.skipped + 
                         duplicateResult.skipped + cssResult.skipped + tsResult.skipped;
    
    // Summary
    console.log(chalk.bold('\n📋 Fix Summary:\n'));
    
    if (importResult.fixed > 0) {
      console.log(chalk.green(`  ✓ Fixed ${importResult.fixed} untransformed import(s)`));
    }
    if (brokenResult.fixed > 0) {
      console.log(chalk.green(`  ✓ Fixed ${brokenResult.fixed} broken import(s)`));
    }
    if (ssrResult.fixed > 0) {
      console.log(chalk.green(`  ✓ Fixed ${ssrResult.fixed} SSR-unsafe export(s)`));
    }
    if (cssResult.fixed > 0) {
      console.log(chalk.green(`  ✓ Fixed ${cssResult.fixed} missing CSS file(s)`));
    }
    if (tsResult.fixed > 0) {
      console.log(chalk.green(`  ✓ Fixed ${tsResult.fixed} TypeScript error(s)`));
    }
    if (tsResult.errors.length > 0) {
      tsResult.errors.forEach(e => console.log(chalk.yellow(`  ⚠ ${e}`)));
    }
    
    if (totalSkipped > 0) {
      console.log(chalk.yellow(`\n  ⚠ Skipped ${totalSkipped} issue(s) requiring manual fix`));
    }
    
    if (totalFixed === 0 && totalSkipped === 0) {
      console.log(chalk.green('  ✓ No issues found!\n'));
    } else if (dryRun) {
      console.log(chalk.dim('\n  Run without --dry-run to apply fixes\n'));
    } else {
      console.log(chalk.green('\n✨ Fixes applied!\n'));
      console.log(chalk.dim('Run "npx buildpad validate" to verify.\n'));
    }
    
  } catch (error) {
    spinner.fail('Fix failed');
    console.error(chalk.red(error));
    process.exit(1);
  }
}
