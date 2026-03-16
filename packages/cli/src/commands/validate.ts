/**
 * Buildpad CLI - Validate Command
 * 
 * Validates the Buildpad installation in a project:
 * - Checks for untransformed @buildpad/* imports
 * - Checks for broken relative imports (file not found)
 * - Verifies all component files exist
 * - Checks for missing CSS files
 * - Validates required lib modules are present
 * - Checks for React 19 / Next.js 16 compatibility issues
 * - Runs TypeScript type checking on component files
 * - Suggests fixes for common issues
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import fg from 'fast-glob';
import { execSync } from 'child_process';
import { type Config, loadConfig } from './init.js';

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

interface ValidationError {
  file: string;
  line?: number;
  message: string;
  code: string;
}

interface ValidationWarning {
  file: string;
  line?: number;
  message: string;
  code: string;
}

/**
 * Check for untransformed @buildpad/* imports
 */
async function checkUntransformedImports(
  cwd: string,
  config: Config
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const patterns = [
    path.join(srcDir, 'components/**/*.{ts,tsx,js,jsx}'),
    path.join(srcDir, 'lib/buildpad/**/*.{ts,tsx,js,jsx}'),
  ];
  
  for (const pattern of patterns) {
    const files = await fg(pattern, { ignore: ['**/node_modules/**'] });
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for @buildpad/* imports (not in comments)
        if (
          (line.includes("from '@buildpad/") || line.includes('from "@buildpad/')) && 
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
        ) {
          errors.push({
            file: path.relative(cwd, file),
            line: index + 1,
            message: `Untransformed import: ${line.trim()}`,
            code: 'UNTRANSFORMED_IMPORT',
          });
        }
      });
    }
  }
  
  return errors;
}

/**
 * Check for missing CSS files that components might need
 */
async function checkMissingCssFiles(
  cwd: string,
  config: Config
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const componentsDir = path.join(srcDir, 'components/ui');
  
  // Components that require CSS files
  const cssRequirements: Record<string, string> = {
    'input-block-editor.tsx': 'InputBlockEditor.css',
    'rich-text-html.tsx': 'RichTextHTML.css',
    'rich-text-markdown.tsx': 'RichTextMarkdown.css',
  };
  
  for (const [component, cssFile] of Object.entries(cssRequirements)) {
    const componentPath = path.join(componentsDir, component);
    const cssPath = path.join(componentsDir, cssFile);
    
    if (fs.existsSync(componentPath) && !fs.existsSync(cssPath)) {
      warnings.push({
        file: cssFile,
        message: `Missing CSS file for ${component}`,
        code: 'MISSING_CSS',
      });
    }
  }
  
  return warnings;
}

/**
 * Check for missing lib modules
 */
async function checkLibModules(
  cwd: string,
  config: Config
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const libDir = path.join(srcDir, 'lib/buildpad');
  
  // Required lib modules based on installed components
  const requiredModules: Record<string, string[]> = {
    types: ['types/index.ts', 'types/core.ts'],
    services: ['services/index.ts', 'services/api-request.ts'],
    hooks: ['hooks/index.ts'],
    utils: ['utils.ts', 'field-interface-mapper.ts'],
  };
  
  for (const [module, files] of Object.entries(requiredModules)) {
    if (config.installedLib.includes(module)) {
      for (const file of files) {
        const filePath = path.join(libDir, file);
        if (!fs.existsSync(filePath)) {
          errors.push({
            file: `lib/buildpad/${file}`,
            message: `Missing required file for ${module} module`,
            code: 'MISSING_LIB_FILE',
          });
        }
      }
    }
  }
  
  // Check for interface-registry.ts if define-interface.ts exists
  const defineInterfacePath = path.join(libDir, 'define-interface.ts');
  const interfaceRegistryPath = path.join(libDir, 'interface-registry.ts');
  
  if (fs.existsSync(defineInterfacePath) && !fs.existsSync(interfaceRegistryPath)) {
    errors.push({
      file: 'lib/buildpad/interface-registry.ts',
      message: 'Missing interface-registry.ts (required by define-interface.ts)',
      code: 'MISSING_INTERFACE_REGISTRY',
    });
  }
  
  return errors;
}

/**
 * Check for SSR-unsafe component usage
 */
async function checkSsrIssues(
  cwd: string,
  config: Config
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const componentsDir = path.join(srcDir, 'components/ui');
  
  // Check if InputBlockEditor is exported without SSR protection
  const indexPath = path.join(componentsDir, 'index.ts');
  
  if (fs.existsSync(indexPath)) {
    const content = await fs.readFile(indexPath, 'utf-8');
    
    // Check for direct InputBlockEditor export without wrapper
    if (
      content.includes('InputBlockEditor') && 
      !content.includes('input-block-editor-wrapper') &&
      content.includes("from './input-block-editor'")
    ) {
      warnings.push({
        file: 'components/ui/index.ts',
        message: 'InputBlockEditor exported directly may cause SSR errors. Use input-block-editor-wrapper instead.',
        code: 'SSR_UNSAFE_EXPORT',
      });
    }
  }
  
  return warnings;
}

/**
 * Check for missing API routes
 */
async function checkApiRoutes(cwd: string): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  
  // Check for srcDir vs non-srcDir project structure
  const srcDir = fs.existsSync(path.join(cwd, 'src/app')) 
    ? path.join(cwd, 'src') 
    : cwd;
  const appDir = path.join(srcDir, 'app');
  const apiDir = path.join(appDir, 'api');
  
  // Required API routes for DaaS integration
  const requiredRoutes = [
    { path: 'fields/[collection]/route.ts', description: 'Fetch collection field schemas' },
    { path: 'items/[collection]/route.ts', description: 'List/Create items' },
    { path: 'items/[collection]/[id]/route.ts', description: 'Get/Update/Delete item' },
  ];
  
  // Optional but recommended routes
  const recommendedRoutes = [
    { path: 'relations/route.ts', description: 'Relation definitions (for M2M/M2O/O2M)' },
    { path: 'files/route.ts', description: 'File operations (for file components)' },
  ];
  
  if (!fs.existsSync(apiDir)) {
    warnings.push({
      file: 'app/api/',
      message: 'Missing API directory. Forms require API routes to fetch data from DaaS.',
      code: 'MISSING_API_DIR',
    });
    return warnings;
  }
  
  for (const route of requiredRoutes) {
    const routePath = path.join(apiDir, route.path);
    if (!fs.existsSync(routePath)) {
      warnings.push({
        file: `app/api/${route.path}`,
        message: `Missing required API route: ${route.description}`,
        code: 'MISSING_API_ROUTE',
      });
    }
  }
  
  for (const route of recommendedRoutes) {
    const routePath = path.join(apiDir, route.path);
    if (!fs.existsSync(routePath)) {
      warnings.push({
        file: `app/api/${route.path}`,
        message: `Missing recommended API route: ${route.description}`,
        code: 'MISSING_OPTIONAL_API_ROUTE',
      });
    }
  }
  
  // Check for auth-headers helper
  const authHeadersPath = path.join(srcDir, 'lib/api/auth-headers.ts');
  if (!fs.existsSync(authHeadersPath)) {
    warnings.push({
      file: 'lib/api/auth-headers.ts',
      message: 'Missing auth-headers helper. API routes need this to forward auth tokens.',
      code: 'MISSING_AUTH_HELPER',
    });
  }
  
  return warnings;
}

/**
 * Check for broken relative imports (file not found)
 */
async function checkBrokenRelativeImports(
  cwd: string,
  config: Config
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const patterns = [
    path.join(srcDir, 'components/**/*.{ts,tsx,js,jsx}'),
    path.join(srcDir, 'lib/buildpad/**/*.{ts,tsx,js,jsx}'),
  ];
  
  // Regex to extract relative imports
  const relativeImportPattern = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
  
  for (const pattern of patterns) {
    const files = await fg(pattern, { ignore: ['**/node_modules/**'] });
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      const fileDir = path.dirname(file);
      
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }
        
        let match;
        relativeImportPattern.lastIndex = 0;
        while ((match = relativeImportPattern.exec(line)) !== null) {
          const importPath = match[1];
          
          // Try to resolve the import
          const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', ''];
          const absolutePath = path.resolve(fileDir, importPath);
          
          const exists = possibleExtensions.some(ext => 
            fs.existsSync(absolutePath + ext)
          );
          
          if (!exists) {
            errors.push({
              file: path.relative(cwd, file),
              line: index + 1,
              message: `Cannot find module '${importPath}'`,
              code: 'BROKEN_IMPORT',
            });
          }
        }
      });
    }
  }
  
  return errors;
}

/**
 * Check for React 19 / Next.js 16 compatibility issues
 */
async function checkReact19Compatibility(
  cwd: string,
  config: Config
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  
  // Check for component={Link} patterns in Server Components
  const appDir = path.join(srcDir, 'app');
  if (!fs.existsSync(appDir)) {
    return warnings;
  }
  
  const serverComponentPattern = path.join(appDir, '**/page.tsx');
  const files = await fg(serverComponentPattern, { ignore: ['**/node_modules/**'] });
  
  // Pattern for component prop passing (React 19 breaking change)
  const componentPropPattern = /component=\{[A-Z][a-zA-Z]*\}/;
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    // Skip if file has "use client" directive
    if (content.includes('"use client"') || content.includes("'use client'")) {
      continue;
    }
    
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (componentPropPattern.test(line)) {
        warnings.push({
          file: path.relative(cwd, file),
          line: index + 1,
          message: 'Passing component as prop in Server Component may cause React 19 errors. Add "use client" or use wrapper pattern.',
          code: 'REACT19_COMPONENT_PROP',
        });
      }
    });
  }
  
  return warnings;
}

/**
 * Check for duplicate exports in index.ts
 */
async function checkDuplicateExports(
  cwd: string,
  config: Config
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const indexPath = path.join(srcDir, 'components/ui/index.ts');
  
  if (!fs.existsSync(indexPath)) {
    return warnings;
  }
  
  const content = await fs.readFile(indexPath, 'utf-8');
  const exportPattern = /export \* from ['"]\.\/([^'"]+)['"]/g;
  const exports = new Map<string, number>();
  
  let match;
  let lineNum = 0;
  const lines = content.split('\n');
  
  for (const line of lines) {
    lineNum++;
    exportPattern.lastIndex = 0;
    while ((match = exportPattern.exec(line)) !== null) {
      const exportPath = match[1];
      if (exports.has(exportPath)) {
        warnings.push({
          file: 'components/ui/index.ts',
          line: lineNum,
          message: `Duplicate export from './${exportPath}' (first at line ${exports.get(exportPath)})`,
          code: 'DUPLICATE_EXPORT',
        });
      } else {
        exports.set(exportPath, lineNum);
      }
    }
  }
  
  // Check for conflicting named exports across files
  const componentsDir = path.join(srcDir, 'components/ui');
  const namedExports = new Map<string, { file: string; line: number }>();
  
  for (const [exportFile] of exports) {
    const filePath = path.join(componentsDir, exportFile + '.tsx');
    if (!fs.existsSync(filePath)) continue;
    
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const namedExportPattern = /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g;
    
    let namedMatch;
    while ((namedMatch = namedExportPattern.exec(fileContent)) !== null) {
      const exportName = namedMatch[1];
      
      if (namedExports.has(exportName)) {
        const firstExport = namedExports.get(exportName)!;
        warnings.push({
          file: `components/ui/${exportFile}.tsx`,
          message: `Conflicting export '${exportName}' also exported from '${firstExport.file}'. This will cause 'export *' conflicts in index.ts`,
          code: 'CONFLICTING_NAMED_EXPORT',
        });
      } else {
        namedExports.set(exportName, { file: exportFile, line: 0 });
      }
    }
  }
  
  return warnings;
}

/**
 * Run TypeScript type checking on component files
 */
async function checkTypeScriptErrors(
  cwd: string,
  config: Config
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  
  // Check if tsconfig.json exists
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return errors; // Skip if no tsconfig
  }
  
  // Check if TypeScript is available
  try {
    const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
    const componentsDir = path.join(srcDir, 'components/ui');
    
    if (!fs.existsSync(componentsDir)) {
      return errors;
    }
    
    // Run tsc with --noEmit on specific files
    // Use --yes to skip npx install prompts, pipe stdin to prevent interactive hangs,
    // and set a 60s timeout to avoid indefinite blocking on macOS
    const result = execSync(
      `npx --yes tsc --noEmit --skipLibCheck --pretty false 2>&1 || true`,
      { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    // Parse TypeScript output
    // Format: filename(line,col): error TS####: message
    const tsErrorPattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
    let match;
    
    while ((match = tsErrorPattern.exec(result)) !== null) {
      const [, file, line, , severity, tsCode, message] = match;
      const relativePath = path.relative(cwd, file);
      
      // Only include errors from components/ui or lib/buildpad
      if (relativePath.includes('components/ui') || relativePath.includes('lib/buildpad')) {
        if (severity === 'error') {
          errors.push({
            file: relativePath,
            line: parseInt(line, 10),
            message: `${tsCode}: ${message}`,
            code: 'TYPESCRIPT_ERROR',
          });
        }
      }
    }
  } catch {
    // TypeScript not available or other error - skip silently
  }
  
  return errors;
}

/**
 * Generate suggestions based on errors and warnings
 */
function generateSuggestions(
  errors: ValidationError[],
  warnings: ValidationWarning[]
): string[] {
  const suggestions: string[] = [];
  
  // TypeScript errors
  const tsErrorCount = errors.filter(e => e.code === 'TYPESCRIPT_ERROR').length;
  if (tsErrorCount > 0) {
    suggestions.push(
      `Fix ${tsErrorCount} TypeScript error(s) in component files`
    );
  }
  
  // Untransformed imports
  const untransformedCount = errors.filter(e => e.code === 'UNTRANSFORMED_IMPORT').length;
  if (untransformedCount > 0) {
    suggestions.push(
      `Fix ${untransformedCount} untransformed import(s) by running: pnpm cli add --all --overwrite --cwd .`
    );
  }
  
  // Broken imports
  const brokenImportCount = errors.filter(e => e.code === 'BROKEN_IMPORT').length;
  if (brokenImportCount > 0) {
    suggestions.push(
      `Fix ${brokenImportCount} broken import(s) by checking file paths or reinstalling components`
    );
  }
  
  // Missing lib files
  const missingLibCount = errors.filter(e => e.code === 'MISSING_LIB_FILE').length;
  if (missingLibCount > 0) {
    suggestions.push(
      `Reinstall lib modules with: pnpm cli add vform --overwrite --cwd .`
    );
  }
  
  // Missing interface registry
  if (errors.some(e => e.code === 'MISSING_INTERFACE_REGISTRY')) {
    suggestions.push(
      `Add missing interface-registry.ts by reinstalling utils module`
    );
  }
  
  // Missing CSS files
  const missingCssCount = warnings.filter(w => w.code === 'MISSING_CSS').length;
  if (missingCssCount > 0) {
    suggestions.push(
      `Copy missing CSS files from buildpad-ui/packages/ui-interfaces/src/`
    );
  }
  
  // SSR issues
  if (warnings.some(w => w.code === 'SSR_UNSAFE_EXPORT')) {
    suggestions.push(
      `Update components/ui/index.ts to export InputBlockEditor from './input-block-editor-wrapper'`
    );
  }
  
  // Missing API routes
  const missingRouteCount = warnings.filter(w => w.code === 'MISSING_API_ROUTE').length;
  const missingApiDir = warnings.some(w => w.code === 'MISSING_API_DIR');
  const missingAuthHelper = warnings.some(w => w.code === 'MISSING_AUTH_HELPER');
  
  if (missingApiDir || missingRouteCount > 0 || missingAuthHelper) {
    suggestions.push(
      `Install API routes and auth helpers: npx @buildpad/cli@latest add api-routes --cwd .`
    );
  }
  
  // React 19 compatibility
  const react19Count = warnings.filter(w => w.code === 'REACT19_COMPONENT_PROP').length;
  if (react19Count > 0) {
    suggestions.push(
      `Fix ${react19Count} React 19 compatibility issue(s): wrap component with "use client" or use Link directly`
    );
  }
  
  // Duplicate exports
  const duplicateCount = warnings.filter(w => w.code === 'DUPLICATE_EXPORT').length;
  if (duplicateCount > 0) {
    suggestions.push(
      `Remove ${duplicateCount} duplicate export(s) from components/ui/index.ts`
    );
  }
  
  return suggestions;
}

/**
 * Main validate command
 */
export async function validate(options: {
  cwd: string;
  json?: boolean;
  noExit?: boolean;
}): Promise<ValidationResult | undefined> {
  const { cwd, json = false, noExit = false } = options;
  
  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    if (json) {
      console.log(JSON.stringify({
        valid: false,
        errors: [{ file: 'buildpad.json', message: 'Not found', code: 'NO_CONFIG' }],
        warnings: [],
        suggestions: ['Run "npx buildpad init" first'],
      }));
    } else {
      console.log(chalk.red('\n✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    }
    if (noExit) {
      return { valid: false, errors: [{ file: 'buildpad.json', message: 'Not found', code: 'NO_CONFIG' }], warnings: [], suggestions: ['Run "npx buildpad init" first'] };
    }
    process.exit(1);
  }
  
  const spinner = json ? null : ora('Validating Buildpad installation...').start();
  
  try {
    // Run all checks (TypeScript check is separate as it's slower)
    const [
      untransformedErrors,
      brokenImportErrors,
      missingCssWarnings,
      libModuleErrors,
      ssrWarnings,
      apiRouteWarnings,
      react19Warnings,
      duplicateExportWarnings,
    ] = await Promise.all([
      checkUntransformedImports(cwd, config),
      checkBrokenRelativeImports(cwd, config),
      checkMissingCssFiles(cwd, config),
      checkLibModules(cwd, config),
      checkSsrIssues(cwd, config),
      checkApiRoutes(cwd),
      checkReact19Compatibility(cwd, config),
      checkDuplicateExports(cwd, config),
    ]);
    
    // Run TypeScript check (slower, run separately)
    if (spinner) {
      spinner.text = 'Running TypeScript check...';
    }
    const tsErrors = await checkTypeScriptErrors(cwd, config);
    
    const errors = [...untransformedErrors, ...brokenImportErrors, ...libModuleErrors, ...tsErrors];
    const warnings = [...missingCssWarnings, ...ssrWarnings, ...apiRouteWarnings, ...react19Warnings, ...duplicateExportWarnings];
    const suggestions = generateSuggestions(errors, warnings);
    
    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
    
    if (noExit) {
      spinner?.stop();
      return result;
    }

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    
    // Display results
    if (errors.length === 0 && warnings.length === 0) {
      spinner?.succeed(chalk.green('Buildpad installation is valid! ✓'));
      console.log(chalk.dim(`\n  ${config.installedComponents.length} components installed`));
      console.log(chalk.dim(`  ${config.installedLib.length} lib modules installed\n`));
      return result;
    }
    
    spinner?.stop();
    
    // Show errors
    if (errors.length > 0) {
      console.log(chalk.red(`\n✗ Found ${errors.length} error(s):\n`));
      errors.forEach(error => {
        const location = error.line ? `:${error.line}` : '';
        console.log(chalk.red(`  ✗ ${error.file}${location}`));
        console.log(chalk.dim(`    ${error.message}`));
      });
    }
    
    // Show warnings
    if (warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠ Found ${warnings.length} warning(s):\n`));
      warnings.forEach(warning => {
        console.log(chalk.yellow(`  ⚠ ${warning.file}`));
        console.log(chalk.dim(`    ${warning.message}`));
      });
    }
    
    // Show suggestions
    if (suggestions.length > 0) {
      console.log(chalk.cyan('\n💡 Suggestions:\n'));
      suggestions.forEach((suggestion, i) => {
        console.log(chalk.cyan(`  ${i + 1}. ${suggestion}`));
      });
    }
    
    console.log();
    
    if (errors.length > 0) {
      process.exit(1);
    }

    return result;
  } catch (error) {
    spinner?.fail('Validation failed');
    console.error(error);
    process.exit(1);
  }
}
