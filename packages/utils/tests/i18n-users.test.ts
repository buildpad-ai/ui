/**
 * `users` namespace: the footer's noun. Key and placeholder parity with the
 * Indonesian catalog is covered for every namespace in i18n.test.ts; this pins
 * the one thing particular here: the noun of "Showing N of M {itemsLabel}"
 * follows the total.
 */
import { describe, it, expect } from 'vitest';
import { defaultTranslations, formatCount, hasPlaceholders, id, interpolate, mergeTranslations } from '../src/i18n';

type List = 'usersManager' | 'rolesManager' | 'policiesManager';
const LISTS: List[] = ['usersManager', 'rolesManager', 'policiesManager'];

const usersDefaults = defaultTranslations.users;
const usersId = id.users;

/** The footer line, as ui-users' ListFooter composes it. */
function showing(locale: string, catalog: typeof usersDefaults, list: List, shown: number, totalCount: number) {
  return interpolate(catalog.listFooter.showing, {
    shown,
    totalCount,
    itemsLabel: formatCount(locale, totalCount, catalog[list].itemsLabel),
  });
}

describe('users namespace', () => {
  it("the footer's noun follows the total: one user, many users", () => {
    expect(showing('en', usersDefaults, 'usersManager', 1, 1)).toBe('Showing 1 of 1 user');
    expect(showing('en', usersDefaults, 'rolesManager', 1, 1)).toBe('Showing 1 of 1 role');
    expect(showing('en', usersDefaults, 'policiesManager', 1, 1)).toBe('Showing 1 of 1 policy');
    // The noun is the total's, not the shown rows': one row of 26 is still "users"
    expect(showing('en', usersDefaults, 'usersManager', 1, 26)).toBe('Showing 1 of 26 users');
    expect(showing('en', usersDefaults, 'rolesManager', 2, 2)).toBe('Showing 2 of 2 roles');
    expect(showing('en', usersDefaults, 'policiesManager', 25, 26)).toBe('Showing 25 of 26 policies');
  });

  it('Indonesian nouns have one form for every number', () => {
    expect(usersId.usersManager.itemsLabel).toEqual({ other: 'pengguna' });
    expect(usersId.rolesManager.itemsLabel).toEqual({ other: 'peran' });
    expect(usersId.policiesManager.itemsLabel).toEqual({ other: 'kebijakan' });
    expect(showing('id', usersId, 'usersManager', 1, 1)).toBe('Menampilkan 1 dari 1 pengguna');
    expect(showing('id', usersId, 'policiesManager', 25, 26)).toBe('Menampilkan 25 dari 26 kebijakan');
  });

  it('the noun is a noun, not a count: it carries no {count} of its own', () => {
    for (const catalog of [usersDefaults, usersId]) {
      for (const list of LISTS) {
        expect(Object.values(catalog[list].itemsLabel).some((form) => hasPlaceholders(form))).toBe(false);
      }
    }
  });

  // The key was one string through 3.2.0; ListFooter shows such a value as it is
  it('a dictionary that still holds one string there is kept as that string', () => {
    const merged = mergeTranslations(usersDefaults, { usersManager: { itemsLabel: 'people' as never } });
    expect(merged.usersManager.itemsLabel).toBe('people');
    expect(merged.rolesManager.itemsLabel).toEqual({ one: 'role', other: 'roles' });
  });
});
