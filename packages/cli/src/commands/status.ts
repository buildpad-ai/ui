/**
 * Buildpad CLI - Status Command
 * 
 * Scans project for buildpad-installed files and shows:
 * - Which components are installed
 * - Their versions and install dates
 * - Whether they've been modified
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, type Config } from './init.js';
import { extractOriginInfo, hasBuildpadOrigin, hashTransformed } from './transformer.js';

interface InstalledFile {
  path: string;
  origin: string;
  version: string;
  /** installedAt from old-style header (kept for backward compat display) */
  date: string;
  /** true when the file's current hash differs from the recorded sha256 in buildpad.json */
  modified: boolean;
  /** sha256 of current disk content (stripped + normalised) */
  currentSha256: string;
}

/**
 * Recursively find all files with buildpad origin headers.
 * @param manifestComponents - v2 components map from buildpad.json (optional)
 */
async function findBuildpadFiles(
  dir: string,
  manifestComponents?: Config['components']
): Promise<InstalledFile[]> {
  const files: InstalledFile[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        const subFiles = await findBuildpadFiles(fullPath, manifestComponents);
        files.push(...subFiles);
      }
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      const content = await fs.readFile(fullPath, 'utf-8');
      
      if (hasBuildpadOrigin(content)) {
        const info = extractOriginInfo(content);
        if (info && info.origin) {
          const currentSha256 = hashTransformed(content);

          // Look up recorded sha256 in v2 manifest to determine modification status.
          let modified = false;
          if (manifestComponents) {
            // The origin string is like "@buildpad/ui-interfaces/input"
            // Component name is the last segment
            const componentName = info.origin.split('/').pop() ?? '';
            const record = manifestComponents[componentName];
            if (record) {
              // Find the matching file entry by sha256 comparison
              const hasMatch = record.files.some(f => f.sha256 === currentSha256);
              modified = !hasMatch;
            }
            // If no record found (component not in manifest) → assume pristine (unknown)
          }

          files.push({
            path: fullPath,
            origin: info.origin,
            version: info.version || 'unknown',
            date: info.date || 'unknown',
            currentSha256,
            modified,
          });
        }
      }
    }
  }
  
  return files;
}

/**
 * Group files by component/lib
 */
function groupByOrigin(files: InstalledFile[]): Map<string, InstalledFile[]> {
  const groups = new Map<string, InstalledFile[]>();
  
  for (const file of files) {
    const [pkg, component] = file.origin.split('/').slice(0, 2);
    const key = `${pkg}/${component || 'root'}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(file);
  }
  
  return groups;
}

/**
 * Main status command
 */
export async function status(options: { cwd: string; json?: boolean }) {
  const { cwd, json = false } = options;

  const config = await loadConfig(cwd);
  if (!config) {
    console.log(chalk.red('\n✗ buildpad.json not found.\n'));
    console.log('This project may not be initialized with Buildpad.');
    console.log('Run "npx @buildpad/cli init" to initialize.\n');
    return;
  }

  // Scan for installed files — pass v2 component map for modification detection
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const files = await findBuildpadFiles(srcDir, config.components);

  if (json) {
    console.log(JSON.stringify({
      config: {
        installedLib: config.installedLib,
        installedComponents: config.installedComponents,
      },
      files: files.map(f => ({
        path: path.relative(cwd, f.path),
        origin: f.origin,
        version: f.version,
        modified: f.modified,
        currentSha256: f.currentSha256,
      })),
    }, null, 2));
    return;
  }

  // Pretty print
  console.log('\n' + chalk.bold('📦 Buildpad Status\n'));
  
  console.log(chalk.gray('Config file: ') + 'buildpad.json');
  console.log(chalk.gray('Lib modules: ') + (config.installedLib.join(', ') || 'none'));
  console.log(chalk.gray('Components:  ') + (config.installedComponents.join(', ') || 'none'));
  
  if (files.length === 0) {
    console.log('\n' + chalk.yellow('No files with @buildpad-origin headers found.'));
    console.log(chalk.gray('This may mean components were installed before origin tracking was added.'));
    return;
  }

  const groups = groupByOrigin(files);
  
  console.log('\n' + chalk.bold('Installed Files:\n'));
  
  for (const [origin, groupFiles] of groups) {
    console.log(chalk.cyan(`  ${origin}`));
    for (const file of groupFiles) {
      const relativePath = path.relative(cwd, file.path);
      const modTag = file.modified ? chalk.yellow(' [modified]') : chalk.green(' [pristine]');
      console.log(chalk.gray(`    └─ ${relativePath}`) + modTag);
      const meta = [`v${file.version}`, ...(file.date !== 'unknown' ? [file.date] : [])].join(' • ');
      console.log(chalk.gray(`       ${meta}`));
    }
    console.log();
  }

  console.log(chalk.gray(`\nTotal: ${files.length} files from Buildpad\n`));
}
