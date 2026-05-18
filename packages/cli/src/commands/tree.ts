/**
 * Buildpad CLI - Tree Command
 * 
 * Display dependency tree for a component showing:
 * - Lib module dependencies (types, services, hooks, utils)
 * - Registry dependencies (other components)
 * - NPM package dependencies
 */

import chalk from 'chalk';
import {
  getRegistry as fetchRegistry,
  type Registry,
  type ComponentEntry,
} from '../resolver.js';

// Load registry (local or remote via resolver)
async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

/**
 * Find a component by name (case-insensitive)
 */
function findComponent(name: string, registry: Registry): ComponentEntry | undefined {
  return registry.components.find(
    c => c.name.toLowerCase() === name.toLowerCase() ||
         c.title.toLowerCase() === name.toLowerCase()
  );
}

interface TreeNode {
  name: string;
  type: 'component' | 'lib' | 'npm';
  description?: string;
  children: TreeNode[];
}

/**
 * Build dependency tree for a component
 */
function buildTree(
  component: ComponentEntry, 
  registry: Registry, 
  visited = new Set<string>(),
  depth = 0,
  maxDepth = 3
): TreeNode {
  const node: TreeNode = {
    name: component.name,
    type: 'component',
    description: component.description,
    children: [],
  };
  
  if (visited.has(component.name) || depth >= maxDepth) {
    return node;
  }
  visited.add(component.name);
  
  // Add lib module dependencies
  for (const libName of component.internalDependencies) {
    const libModule = registry.lib[libName];
    const libNode: TreeNode = {
      name: libName,
      type: 'lib',
      description: libModule?.description,
      children: [],
    };
    
    // Add lib's own dependencies
    if (libModule?.internalDependencies) {
      for (const subLib of libModule.internalDependencies) {
        if (!visited.has(`lib:${subLib}`)) {
          visited.add(`lib:${subLib}`);
          const subLibModule = registry.lib[subLib];
          libNode.children.push({
            name: subLib,
            type: 'lib',
            description: subLibModule?.description,
            children: [],
          });
        }
      }
    }
    
    node.children.push(libNode);
  }
  
  // Add registry dependencies (other components)
  if (component.registryDependencies) {
    for (const depName of component.registryDependencies) {
      const dep = findComponent(depName, registry);
      if (dep) {
        node.children.push(buildTree(dep, registry, visited, depth + 1, maxDepth));
      }
    }
  }
  
  // Add npm dependencies
  for (const npmDep of component.dependencies) {
    node.children.push({
      name: npmDep,
      type: 'npm',
      children: [],
    });
  }
  
  return node;
}

/**
 * Render tree to console
 */
function renderTree(node: TreeNode, prefix = '', isLast = true, isRoot = true): void {
  const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
  const childPrefix = isRoot ? '' : (isLast ? '    ' : '│   ');
  
  let icon = '';
  let color = chalk.white;
  
  switch (node.type) {
    case 'component':
      icon = '📦';
      color = chalk.green;
      break;
    case 'lib':
      icon = '🔧';
      color = chalk.magenta;
      break;
    case 'npm':
      icon = '📚';
      color = chalk.yellow;
      break;
  }
  
  console.log(
    prefix + 
    connector + 
    icon + ' ' + 
    color(node.name) + 
    (node.description && isRoot ? chalk.dim(` - ${node.description}`) : '')
  );
  
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isChildLast = i === node.children.length - 1;
    renderTree(child, prefix + childPrefix, isChildLast, false);
  }
}

/**
 * Flatten tree to get unique dependencies
 */
function flattenTree(node: TreeNode): { components: string[], libs: string[], npm: string[] } {
  const result = {
    components: new Set<string>(),
    libs: new Set<string>(),
    npm: new Set<string>(),
  };
  
  function traverse(n: TreeNode) {
    switch (n.type) {
      case 'component':
        result.components.add(n.name);
        break;
      case 'lib':
        result.libs.add(n.name);
        break;
      case 'npm':
        result.npm.add(n.name);
        break;
    }
    n.children.forEach(traverse);
  }
  
  traverse(node);
  
  return {
    components: Array.from(result.components),
    libs: Array.from(result.libs),
    npm: Array.from(result.npm),
  };
}

export async function tree(componentName: string, options: { json?: boolean; depth?: number }) {
  const { json, depth = 2 } = options;
  
  const registry = await getRegistry();
  const component = findComponent(componentName, registry);
  
  if (!component) {
    console.log(chalk.red(`\n✗ Component not found: ${componentName}\n`));
    
    // Suggest similar components
    const suggestions = registry.components
      .filter(c => 
        c.name.includes(componentName.toLowerCase()) ||
        c.title.toLowerCase().includes(componentName.toLowerCase())
      )
      .slice(0, 5);
    
    if (suggestions.length > 0) {
      console.log(chalk.yellow('Did you mean one of these?\n'));
      suggestions.forEach(s => {
        console.log(`  ${chalk.green(s.name.padEnd(25))} ${chalk.dim(s.description)}`);
      });
      console.log();
    }
    
    console.log(chalk.dim('Run "buildpad list" to see all available components.\n'));
    process.exit(1);
  }
  
  const treeData = buildTree(component, registry, new Set(), 0, depth);
  const flattened = flattenTree(treeData);
  
  if (json) {
    console.log(JSON.stringify({
      tree: treeData,
      summary: flattened,
    }, null, 2));
    return;
  }
  
  console.log(chalk.bold.blue(`\n🌳 Dependency Tree: ${component.title}\n`));
  
  renderTree(treeData);
  
  // Summary
  console.log(chalk.bold('\n📊 Summary'));
  console.log(`   ${chalk.green('📦 Components:')} ${flattened.components.length}`);
  console.log(`   ${chalk.magenta('🔧 Lib modules:')} ${flattened.libs.length} ${chalk.dim(`(${flattened.libs.join(', ') || 'none'})`)}`);
  console.log(`   ${chalk.yellow('📚 NPM packages:')} ${flattened.npm.length}`);
  
  if (flattened.npm.length > 0) {
    console.log(chalk.bold('\n📦 Install NPM Dependencies'));
    console.log(chalk.dim(`   pnpm add ${flattened.npm.join(' ')}\n`));
  }
  
  console.log(chalk.bold('💡 Add this component'));
  console.log(chalk.dim(`   buildpad add ${component.name}\n`));
}
