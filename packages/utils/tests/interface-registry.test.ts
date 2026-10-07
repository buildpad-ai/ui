/**
 * Interface Registry Unit Tests
 * 
 * Tests for the Interface Registry system in @buildpad/utils.
 * These are unit tests using Vitest that can run without a browser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InterfaceRegistry,
  interfaceRegistry,
  getInterfaceRegistry,
} from '../src/interface-registry';
import {
  defineInterface,
  defineInterfaces,
  createInterfaceOption,
  createOptionGroup,
  InterfaceOptions,
} from '../src/define-interface';
import type { InterfaceMetadata, InterfaceGroup, FieldType } from '../src/interface-types';
import {
  loadInterfacesFromRegistry,
  extractInterfaceFromComponent,
  getInterfacesForApi,
  type RegistryJson,
  type RegistryComponent,
} from '../src/load-interfaces';

describe('InterfaceRegistry', () => {
  let registry: InterfaceRegistry;

  beforeEach(() => {
    registry = new InterfaceRegistry();
  });

  describe('register()', () => {
    it('should register a new interface', () => {
      registry.register({
        id: 'test-input',
        name: 'Test Input',
        icon: 'IconForms',
        types: ['string'],
        group: 'standard',
      });

      expect(registry.has('test-input')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should overwrite existing interface with same id', () => {
      registry.register({
        id: 'test-input',
        name: 'Test Input',
        icon: 'IconForms',
        types: ['string'],
        group: 'standard',
      });

      registry.register({
        id: 'test-input',
        name: 'Updated Input',
        icon: 'IconPencil',
        types: ['string', 'text'],
        group: 'standard',
      });

      expect(registry.size).toBe(1);
      expect(registry.get('test-input')?.name).toBe('Updated Input');
    });
  });

  describe('registerMany()', () => {
    it('should register multiple interfaces at once', () => {
      registry.registerMany([
        { id: 'input-1', name: 'Input 1', icon: 'Icon1', types: ['string'], group: 'standard' },
        { id: 'input-2', name: 'Input 2', icon: 'Icon2', types: ['integer'], group: 'standard' },
        { id: 'input-3', name: 'Input 3', icon: 'Icon3', types: ['boolean'], group: 'selection' },
      ]);

      expect(registry.size).toBe(3);
    });
  });

  describe('get()', () => {
    it('should return interface by id', () => {
      registry.register({
        id: 'my-interface',
        name: 'My Interface',
        icon: 'IconTest',
        types: ['string'],
        group: 'standard',
        description: 'A test interface',
      });

      const result = registry.get('my-interface');
      expect(result).toBeDefined();
      expect(result?.name).toBe('My Interface');
      expect(result?.description).toBe('A test interface');
    });

    it('should return undefined for non-existent interface', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    beforeEach(() => {
      registry.registerMany([
        { id: 'supported-1', name: 'Supported 1', icon: 'Icon', types: ['string'], group: 'standard', supported: true },
        { id: 'supported-2', name: 'Supported 2', icon: 'Icon', types: ['string'], group: 'standard' }, // default supported
        { id: 'unsupported', name: 'Unsupported', icon: 'Icon', types: ['string'], group: 'standard', supported: false },
      ]);
    });

    it('should return only supported interfaces by default', () => {
      const result = registry.getAll();
      expect(result.length).toBe(2);
      expect(result.every(i => i.supported !== false)).toBe(true);
    });

    it('should include unsupported interfaces when requested', () => {
      const result = registry.getAll(true);
      expect(result.length).toBe(3);
    });
  });

  describe('getForType()', () => {
    beforeEach(() => {
      registry.registerMany([
        { id: 'input', name: 'Input', icon: 'Icon', types: ['string', 'text'], group: 'standard' },
        { id: 'number', name: 'Number', icon: 'Icon', types: ['integer', 'float'], group: 'standard' },
        { id: 'textarea', name: 'Textarea', icon: 'Icon', types: ['text'], group: 'standard' },
      ]);
    });

    it('should return interfaces that support the given field type', () => {
      const stringInterfaces = registry.getForType('string');
      expect(stringInterfaces.length).toBe(1);
      expect(stringInterfaces[0].id).toBe('input');

      const textInterfaces = registry.getForType('text');
      expect(textInterfaces.length).toBe(2);

      const intInterfaces = registry.getForType('integer');
      expect(intInterfaces.length).toBe(1);
      expect(intInterfaces[0].id).toBe('number');
    });

    it('should return empty array for unsupported type', () => {
      const result = registry.getForType('binary' as FieldType);
      expect(result.length).toBe(0);
    });
  });

  describe('getByGroup()', () => {
    beforeEach(() => {
      registry.registerMany([
        { id: 'input', name: 'Input', icon: 'Icon', types: ['string'], group: 'standard' },
        { id: 'dropdown', name: 'Dropdown', icon: 'Icon', types: ['string'], group: 'selection' },
        { id: 'm2m', name: 'M2M', icon: 'Icon', types: ['alias'], group: 'relational' },
        { id: 'm2o', name: 'M2O', icon: 'Icon', types: ['uuid'], group: 'relational' },
      ]);
    });

    it('should return interfaces by group', () => {
      const standard = registry.getByGroup('standard');
      expect(standard.length).toBe(1);

      const relational = registry.getByGroup('relational');
      expect(relational.length).toBe(2);
    });
  });

  describe('getGrouped()', () => {
    beforeEach(() => {
      registry.registerMany([
        { id: 'input', name: 'Input', icon: 'Icon', types: ['string'], group: 'standard', order: 1 },
        { id: 'textarea', name: 'Textarea', icon: 'Icon', types: ['text'], group: 'standard', order: 2 },
        { id: 'dropdown', name: 'Dropdown', icon: 'Icon', types: ['string'], group: 'selection', order: 1 },
      ]);
    });

    it('should return interfaces grouped by category', () => {
      const groups = registry.getGrouped();
      expect(groups.length).toBe(2); // Only groups with interfaces

      const standardGroup = groups.find(g => g.key === 'standard');
      expect(standardGroup).toBeDefined();
      expect(standardGroup?.interfaces.length).toBe(2);
      expect(standardGroup?.name).toBe('Text & Numbers');
    });

    it('should include empty groups when requested', () => {
      const groups = registry.getGrouped(true);
      // All 8 groups: InterfaceGroup gained the registry's 'system' group
      // (system-permissions), which getGrouped() used to drop silently.
      expect(groups.length).toBe(8);
      expect(groups.map((g) => g.key)).toEqual([
        'standard', 'selection', 'relational', 'presentation', 'group', 'workflow', 'other', 'system',
      ]);
    });

    it('lists an interface of the system group under "System"', () => {
      registry.register({ id: 'perm', name: 'Permissions', icon: 'Icon', types: ['alias'], group: 'system' });
      const system = registry.getGrouped().find((g) => g.key === 'system');
      expect(system?.name).toBe('System');
      expect(system?.interfaces.map((i) => i.id)).toEqual(['perm']);
    });
  });

  describe('unregister()', () => {
    it('should remove an interface', () => {
      registry.register({ id: 'to-remove', name: 'Remove', icon: 'Icon', types: ['string'], group: 'standard' });
      expect(registry.has('to-remove')).toBe(true);

      const removed = registry.unregister('to-remove');
      expect(removed).toBe(true);
      expect(registry.has('to-remove')).toBe(false);
    });

    it('should return false for non-existent interface', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all interfaces', () => {
      registry.registerMany([
        { id: 'a', name: 'A', icon: 'Icon', types: ['string'], group: 'standard' },
        { id: 'b', name: 'B', icon: 'Icon', types: ['string'], group: 'standard' },
      ]);

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
});

describe('defineInterface()', () => {
  let registry: InterfaceRegistry;

  beforeEach(() => {
    registry = new InterfaceRegistry();
  });

  it('should create interface definition with defaults', () => {
    const definition = defineInterface({
      id: 'custom-input',
      name: 'Custom Input',
      icon: 'IconForms',
      types: ['string'],
      group: 'standard',
    }, { register: false });

    expect(definition.id).toBe('custom-input');
    expect(definition.supported).toBe(true);
    expect(definition.recommended).toBe(false);
    expect(definition.order).toBe(0);
    expect(definition.hasOptions).toBe(false);
  });

  it('should auto-register with global registry by default', () => {
    // Clear global registry first
    interfaceRegistry.clear();

    defineInterface({
      id: 'auto-registered',
      name: 'Auto Registered',
      icon: 'Icon',
      types: ['string'],
      group: 'standard',
    });

    expect(interfaceRegistry.has('auto-registered')).toBe(true);
    interfaceRegistry.clear();
  });

  it('should register with custom registry', () => {
    defineInterface({
      id: 'custom-registry',
      name: 'Custom Registry',
      icon: 'Icon',
      types: ['string'],
      group: 'standard',
    }, { register: true, registry });

    expect(registry.has('custom-registry')).toBe(true);
  });

  it('should set hasOptions based on options array', () => {
    const withOptions = defineInterface({
      id: 'with-options',
      name: 'With Options',
      icon: 'Icon',
      types: ['string'],
      group: 'standard',
      options: [{ field: 'test', name: 'Test', type: 'string' }],
    }, { register: false });

    const withoutOptions = defineInterface({
      id: 'without-options',
      name: 'Without Options',
      icon: 'Icon',
      types: ['string'],
      group: 'standard',
    }, { register: false });

    expect(withOptions.hasOptions).toBe(true);
    expect(withoutOptions.hasOptions).toBe(false);
  });
});

describe('defineInterfaces()', () => {
  it('should create multiple interface definitions', () => {
    const definitions = defineInterfaces([
      { id: 'a', name: 'A', icon: 'Icon', types: ['string'], group: 'standard' },
      { id: 'b', name: 'B', icon: 'Icon', types: ['integer'], group: 'standard' },
    ], { register: false });

    expect(definitions.length).toBe(2);
    expect(definitions[0].id).toBe('a');
    expect(definitions[1].id).toBe('b');
  });
});

describe('createInterfaceOption()', () => {
  it('should create option with defaults', () => {
    const option = createInterfaceOption({
      field: 'test',
      name: 'Test',
      type: 'string',
    });

    expect(option.field).toBe('test');
    expect(option.meta?.interface).toBe('input');
    expect(option.meta?.width).toBe('full');
  });

  it('should preserve provided meta values', () => {
    const option = createInterfaceOption({
      field: 'test',
      name: 'Test',
      type: 'string',
      meta: { interface: 'custom', width: 'half' },
    });

    expect(option.meta?.interface).toBe('custom');
    expect(option.meta?.width).toBe('half');
  });
});

describe('createOptionGroup()', () => {
  it('should create divider and options', () => {
    const group = createOptionGroup('Advanced Options', [
      { field: 'option1', name: 'Option 1', type: 'string' },
    ]);

    expect(group.length).toBe(2);
    expect(group[0].type).toBe('alias');
    expect(group[0].meta?.interface).toBe('presentation-divider');
    expect(group[1].field).toBe('option1');
  });
});

describe('InterfaceOptions presets', () => {
  it('should create placeholder option', () => {
    const opt = InterfaceOptions.placeholder();
    expect(opt.field).toBe('placeholder');
    expect(opt.type).toBe('string');
  });

  it('should create required option', () => {
    const opt = InterfaceOptions.required();
    expect(opt.field).toBe('required');
    expect(opt.type).toBe('boolean');
    expect(opt.schema?.default_value).toBe(false);
  });

  it('should create min/max options', () => {
    const min = InterfaceOptions.min();
    const max = InterfaceOptions.max();
    expect(min.field).toBe('min');
    expect(max.field).toBe('max');
  });
});

describe('loadInterfacesFromRegistry()', () => {
  let registry: InterfaceRegistry;

  beforeEach(() => {
    registry = new InterfaceRegistry();
  });

  const mockRegistryJson: RegistryJson = {
    version: '1.0.0',
    name: 'test',
    description: 'Test registry',
    components: [
      {
        name: 'input',
        title: 'Input',
        description: 'Text input component',
        category: 'input',
        files: [{ source: 'src/input.tsx', target: 'components/input.tsx' }],
        dependencies: [],
        internalDependencies: [],
        interface: {
          id: 'input',
          name: 'Input',
          icon: 'IconForms',
          types: ['string', 'text'],
          group: 'standard',
          order: 1,
          supported: true,
          recommended: true,
        },
      },
      {
        name: 'no-interface',
        title: 'No Interface',
        description: 'Component without interface',
        category: 'misc',
        files: [{ source: 'src/no-interface.tsx', target: 'components/no-interface.tsx' }],
        dependencies: [],
        internalDependencies: [],
        // No interface property
      },
    ],
    categories: [],
  };

  it('should load interfaces from registry.json data', () => {
    const loaded = loadInterfacesFromRegistry(mockRegistryJson, registry);

    expect(loaded.length).toBe(1);
    expect(registry.has('input')).toBe(true);
    expect(registry.has('no-interface')).toBe(false);
  });

  it('should extract metadata correctly', () => {
    loadInterfacesFromRegistry(mockRegistryJson, registry);

    const input = registry.get('input');
    expect(input?.name).toBe('Input');
    expect(input?.types).toContain('string');
    expect(input?.types).toContain('text');
    expect(input?.group).toBe('standard');
    expect(input?.description).toBe('Text input component');
  });
});

describe('extractInterfaceFromComponent()', () => {
  it('should return null for component without interface', () => {
    const component: RegistryComponent = {
      name: 'test',
      title: 'Test',
      description: 'Test',
      category: 'test',
      files: [],
      dependencies: [],
      internalDependencies: [],
    };

    expect(extractInterfaceFromComponent(component)).toBeNull();
  });

  it('should extract interface metadata from component', () => {
    const component: RegistryComponent = {
      name: 'input',
      title: 'Input',
      description: 'A text input',
      category: 'input',
      files: [{ source: 'src/input.tsx', target: 'components/input.tsx' }],
      dependencies: [],
      internalDependencies: [],
      interface: {
        id: 'input',
        name: 'Input',
        icon: 'IconForms',
        types: ['string'],
        group: 'standard',
        recommended: true,
      },
    };

    const metadata = extractInterfaceFromComponent(component);
    expect(metadata).not.toBeNull();
    expect(metadata?.id).toBe('input');
    expect(metadata?.description).toBe('A text input');
    expect(metadata?.componentPath).toBe('components/input.tsx');
    expect(metadata?.recommended).toBe(true);
  });
});

describe('getInterfacesForApi()', () => {
  const mockRegistry: RegistryJson = {
    version: '1.0.0',
    name: 'test',
    description: 'Test',
    components: [
      {
        name: 'input',
        title: 'Input',
        description: 'Input',
        category: 'input',
        files: [{ source: 'a', target: 'b' }],
        dependencies: [],
        internalDependencies: [],
        interface: {
          id: 'input',
          name: 'Input',
          icon: 'Icon',
          types: ['string'],
          group: 'standard',
          order: 1,
        },
      },
      {
        name: 'textarea',
        title: 'Textarea',
        description: 'Textarea',
        category: 'input',
        files: [{ source: 'a', target: 'b' }],
        dependencies: [],
        internalDependencies: [],
        interface: {
          id: 'textarea',
          name: 'Textarea',
          icon: 'Icon',
          types: ['text'],
          group: 'standard',
          order: 2,
        },
      },
      {
        name: 'dropdown',
        title: 'Dropdown',
        description: 'Dropdown',
        category: 'selection',
        files: [{ source: 'a', target: 'b' }],
        dependencies: [],
        internalDependencies: [],
        interface: {
          id: 'dropdown',
          name: 'Dropdown',
          icon: 'Icon',
          types: ['string'],
          group: 'selection',
          order: 1,
        },
      },
    ],
    categories: [],
  };

  it('should return interfaces and groups for API response', () => {
    const result = getInterfacesForApi(mockRegistry);

    expect(result.interfaces.length).toBe(3);
    expect(result.groups.length).toBe(2); // standard and selection
  });

  it('should sort interfaces by order', () => {
    const result = getInterfacesForApi(mockRegistry);
    const standardGroup = result.groups.find(g => g.key === 'standard');

    expect(standardGroup?.interfaces[0].id).toBe('input');
    expect(standardGroup?.interfaces[1].id).toBe('textarea');
  });

  it('should include group names', () => {
    const result = getInterfacesForApi(mockRegistry);
    const standardGroup = result.groups.find(g => g.key === 'standard');

    expect(standardGroup?.name).toBe('Text & Numbers');
  });

  it("names the registry's system group (system-permissions)", () => {
    const withSystem: RegistryJson = {
      ...mockRegistry,
      components: [
        {
          name: 'system-permissions',
          title: 'SystemPermissions',
          description: 'Permissions',
          category: 'admin',
          files: [{ source: 'a', target: 'b' }],
          dependencies: [],
          internalDependencies: [],
          interface: { id: 'system-permissions', name: 'Permissions', icon: 'Icon', types: ['alias'], group: 'system' },
        },
      ],
    };
    expect(getInterfacesForApi(withSystem).groups).toEqual([
      expect.objectContaining({ key: 'system', name: 'System' }),
    ]);
  });
});

describe('Global interfaceRegistry', () => {
  beforeEach(() => {
    interfaceRegistry.clear();
  });

  it('should be accessible via getInterfaceRegistry()', () => {
    expect(getInterfaceRegistry()).toBe(interfaceRegistry);
  });

  it('should be a singleton', () => {
    interfaceRegistry.register({
      id: 'singleton-test',
      name: 'Singleton Test',
      icon: 'Icon',
      types: ['string'],
      group: 'standard',
    });

    expect(getInterfaceRegistry().has('singleton-test')).toBe(true);
  });
});
