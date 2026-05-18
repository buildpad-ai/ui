import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig } from './init.js';
import { transformImports } from './transformer.js';
import {
  getRegistry as fetchRegistry,
  resolveSourceFile,
  type Registry,
} from '../resolver.js';

async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

export async function diff(component: string, options: { cwd: string }) {
  const { cwd } = options;

  console.log(chalk.bold(`\n📋 Preview: ${component}\n`));

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.log(chalk.red('✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    process.exit(1);
  }

  // Find component
  const registry = await getRegistry();
  const comp = registry.components.find(
    c => c.name.toLowerCase() === component.toLowerCase() ||
         c.title.toLowerCase() === component.toLowerCase()
  );

  if (!comp) {
    console.log(chalk.red(`✗ Component not found: ${component}\n`));
    console.log(chalk.dim('Run "npx buildpad list" to see available components.\n'));
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`${comp.title}`));
  console.log(chalk.dim(comp.description));
  console.log();

  // Show files that will be created
  console.log(chalk.bold('Files to be created:'));
  for (const file of comp.files) {
    const targetPath = path.join(
      config.srcDir ? path.join(cwd, 'src') : cwd,
      file.target
    );
    const relativePath = path.relative(cwd, targetPath);
    const exists = fs.existsSync(targetPath);
    
    if (exists) {
      console.log(chalk.yellow(`  ⚠ ${relativePath} (exists, will be overwritten)`));
    } else {
      console.log(chalk.green(`  + ${relativePath}`));
    }
  }

  // Show lib dependencies that will be copied
  if (comp.internalDependencies.length > 0) {
    console.log();
    console.log(chalk.bold('Lib modules required:'));
    for (const dep of comp.internalDependencies) {
      const installed = config.installedLib.includes(dep);
      if (installed) {
        console.log(chalk.dim(`  ✓ ${dep} (already installed)`));
      } else {
        console.log(chalk.cyan(`  → ${dep}`));
        
        // Show files in this lib module
        const libModule = registry.lib[dep];
        if (libModule?.files) {
          for (const file of libModule.files) {
            console.log(chalk.dim(`      + ${file.target}`));
          }
        }
      }
    }
  }

  // Show external dependencies
  if (comp.dependencies.length > 0) {
    console.log();
    console.log(chalk.bold('External dependencies:'));
    
    const packageJsonPath = path.join(cwd, 'package.json');
    let installed: Record<string, string> = {};
    
    if (fs.existsSync(packageJsonPath)) {
      const pkg = await fs.readJSON(packageJsonPath);
      installed = { ...pkg.dependencies, ...pkg.devDependencies };
    }
    
    for (const dep of comp.dependencies) {
      if (installed[dep]) {
        console.log(chalk.dim(`  ✓ ${dep} (v${installed[dep]})`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${dep} (not installed)`));
      }
    }
  }

  // Show sample transformed code
  console.log();
  console.log(chalk.bold('Import transformation preview:'));
  
  const sampleSource = comp.files[0]?.source;
  if (sampleSource) {
    try {
      const content = await resolveSourceFile(sampleSource);
      const lines = content.split('\n').slice(0, 15);
      
      console.log(chalk.dim('\nOriginal imports:'));
      lines.filter(l => l.startsWith('import')).forEach(line => {
        if (line.includes('@buildpad/')) {
          console.log(chalk.red(`  ${line}`));
        }
      });
      
      const transformed = transformImports(content, config);
      const transformedLines = transformed.split('\n').slice(0, 15);
      
      console.log(chalk.dim('\nTransformed imports:'));
      transformedLines.filter(l => l.startsWith('import')).forEach(line => {
        if (line.includes(config.aliases.lib) || line.includes(config.aliases.components)) {
          console.log(chalk.green(`  ${line}`));
        }
      });
    } catch {
      console.log(chalk.dim('\n  (source preview not available in remote mode)'));
    }
  }

  console.log();
  console.log(chalk.dim('Run the following to add this component:'));
  console.log(chalk.cyan(`  npx buildpad add ${comp.name}\n`));
}
