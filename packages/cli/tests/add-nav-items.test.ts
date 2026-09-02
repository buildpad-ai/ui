/**
 * applyNavItems writes the dictionary keys (labelKey / sectionKey) route
 * modules declare, so the locale-aware shell can translate sidebar entries.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import ora from 'ora';
import { applyNavItems } from '../src/commands/add.js';
import type { Config } from '../src/commands/init.js';
import type { LibModule } from '../src/resolver.js';

const NAV = `import { IconHome } from "@tabler/icons-react";
import type { NavItem } from "./AuthenticatedShell";

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", labelKey: "app.nav.home", href: "/", icon: IconHome },
  // buildpad:nav-insert — installed route modules add entries above this line. Do not remove.
];
`;

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-nav-'));
  await fs.outputFile(path.join(tmpdir, 'components/layout/navigation.ts'), NAV);
});

afterEach(async () => {
  await fs.remove(tmpdir);
});

const config: Config = {
  schemaVersion: 3,
  model: 'copy-own',
  tsx: true,
  srcDir: false,
  aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
  installedLib: ['design-system'],
  installedComponents: [],
  lib: {
    'design-system': {
      sourcePackage: '@buildpad/cli',
      installedAt: '2026-01-01T00:00:00Z',
      files: [{ target: 'components/layout/navigation.ts', sha256: 'x' }],
    },
  },
};

describe('applyNavItems', () => {
  test('emits labelKey and sectionKey and imports the icons', async () => {
    const mod: LibModule = {
      name: 'users-routes',
      description: '',
      navItems: [
        { label: 'Users', labelKey: 'app.nav.users', href: '/users', icon: 'IconUsers', section: 'Administration', sectionKey: 'app.nav.administration' },
        { label: 'Roles', labelKey: 'app.nav.roles', href: '/roles', icon: 'IconUsersGroup', section: 'Administration', sectionKey: 'app.nav.administration' },
      ],
    };
    const spinner = ora({ isSilent: true }).start();
    await applyNavItems(mod, config, tmpdir, spinner);
    spinner.stop();

    const nav = await fs.readFile(path.join(tmpdir, 'components/layout/navigation.ts'), 'utf-8');
    expect(nav).toContain(
      '  { label: "Users", labelKey: "app.nav.users", href: "/users", icon: IconUsers, section: "Administration", sectionKey: "app.nav.administration" },'
    );
    expect(nav).toContain('import { IconHome, IconUsers, IconUsersGroup } from "@tabler/icons-react";');
    // marker preserved, home entry untouched, entries inserted above the marker
    expect(nav.indexOf('app.nav.home')).toBeLessThan(nav.indexOf('app.nav.users'));
    expect(nav.indexOf('app.nav.roles')).toBeLessThan(nav.indexOf('buildpad:nav-insert'));
    // manifest hash refreshed
    expect(config.lib!['design-system'].files[0].sha256).not.toBe('x');
  });

  test('is idempotent (matched by href)', async () => {
    const mod: LibModule = {
      name: 'files-routes',
      description: '',
      navItems: [{ label: 'Files', labelKey: 'app.nav.files', href: '/files', icon: 'IconFolders' }],
    };
    const spinner = ora({ isSilent: true }).start();
    await applyNavItems(mod, config, tmpdir, spinner);
    await applyNavItems(mod, config, tmpdir, spinner);
    spinner.stop();
    const nav = await fs.readFile(path.join(tmpdir, 'components/layout/navigation.ts'), 'utf-8');
    expect(nav.match(/href: "\/files"/g)).toHaveLength(1);
  });
});
