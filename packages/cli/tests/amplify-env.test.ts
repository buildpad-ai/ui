/**
 * utils/amplify-env: the `amplify.yml` line that writes a lib module's server
 * variables (registry `serverEnv`) into `.env.production`, where a Next.js
 * server on Amplify Hosting reads them at run time.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { addServerEnvToAmplify, ensureAmplifyServerEnv, envProductionLine } from '../src/utils/amplify-env.js';

const HOSTS_LINE = `- '[ -z "$BUILDPAD_CUSTOMER_HOSTS" ] || echo "BUILDPAD_CUSTOMER_HOSTS=$BUILDPAD_CUSTOMER_HOSTS" >> .env.production'`;
const KEY_LINE = `- '[ -z "$BUILDPAD_ONBOARDING_KEY" ] || echo "BUILDPAD_ONBOARDING_KEY=$BUILDPAD_ONBOARDING_KEY" >> .env.production'`;

/** An app's amplify.yml as the Platform's starter kit writes it, with the self-onboarding lines. */
const WITH_KEY = [
  'version: 1',
  'frontend:',
  '  phases:',
  '    preBuild:',
  '      commands:',
  '        - npm ci',
  '    build:',
  '      commands:',
  `        - env | grep -E '^(NEXT_PUBLIC_|OAUTH_)' >> .env.production`,
  `        ${KEY_LINE}`,
  `        - '[ -z "$BUILDPAD_SIGNUP_MAIL" ] || echo "BUILDPAD_SIGNUP_MAIL=$BUILDPAD_SIGNUP_MAIL" >> .env.production'`,
  '        - npm run build',
  '  artifacts:',
  '    baseDirectory: .next',
  '',
].join('\n');

describe('envProductionLine', () => {
  test('is the onboarding key line, for the given name', () => {
    expect(envProductionLine('BUILDPAD_CUSTOMER_HOSTS')).toBe(HOSTS_LINE);
    expect(envProductionLine('BUILDPAD_ONBOARDING_KEY')).toBe(KEY_LINE);
  });

  test('writes a JSON value through the shell unchanged', async () => {
    const { execFileSync } = await import('node:child_process');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-amplify-line-'));
    try {
      const value = '{"acme":"aaaaaaaa-0000-4000-8000-000000000001"}';
      // The YAML item is a single-quoted scalar: the command is its inside.
      const command = HOSTS_LINE.slice(3, -1);
      execFileSync('bash', ['-c', command], { cwd: dir, env: { PATH: process.env.PATH, BUILDPAD_CUSTOMER_HOSTS: value } });
      expect(await fs.readFile(path.join(dir, '.env.production'), 'utf8')).toBe(`BUILDPAD_CUSTOMER_HOSTS=${value}\n`);

      // Unset: nothing is written (Amplify drops an empty variable).
      await fs.remove(path.join(dir, '.env.production'));
      execFileSync('bash', ['-c', command], { cwd: dir, env: { PATH: process.env.PATH } });
      expect(await fs.pathExists(path.join(dir, '.env.production'))).toBe(false);
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('addServerEnvToAmplify', () => {
  test('puts the line right after BUILDPAD_ONBOARDING_KEY, at its indentation', () => {
    const { text, added } = addServerEnvToAmplify(WITH_KEY, ['BUILDPAD_CUSTOMER_HOSTS']);

    expect(added).toEqual(['BUILDPAD_CUSTOMER_HOSTS']);
    const lines = text.split('\n');
    const key = lines.findIndex(line => line.includes('BUILDPAD_ONBOARDING_KEY'));
    expect(lines[key + 1]).toBe(`        ${HOSTS_LINE}`);
    // Nothing else moved.
    expect(lines.filter((_, i) => i !== key + 1).join('\n')).toBe(WITH_KEY);
  });

  test('without an onboarding key line, after the last step that writes .env.production', () => {
    const plain = [
      'frontend:',
      '  phases:',
      '    build:',
      '      commands:',
      `        - env | grep -E '^(NEXT_PUBLIC_|OAUTH_)' >> .env.production`,
      '        - echo "COOKIE_SECRET=$COOKIE_SECRET" >> .env.production',
      '        - npm run build',
    ].join('\n');

    const { text } = addServerEnvToAmplify(plain, ['BUILDPAD_CUSTOMER_HOSTS']);

    expect(text.split('\n')).toEqual([
      ...plain.split('\n').slice(0, 6),
      `        ${HOSTS_LINE}`,
      '        - npm run build',
    ]);
  });

  test('leaves a file that writes the variable already as it is', () => {
    const once = addServerEnvToAmplify(WITH_KEY, ['BUILDPAD_CUSTOMER_HOSTS']).text;
    const twice = addServerEnvToAmplify(once, ['BUILDPAD_CUSTOMER_HOSTS']);
    expect(twice.text).toBe(once);
    expect(twice).toMatchObject({ added: [], present: ['BUILDPAD_CUSTOMER_HOSTS'] });

    const grep = `      - env | grep -E '^(NEXT_PUBLIC_|BUILDPAD_CUSTOMER_HOSTS)=' >> .env.production\n`;
    expect(addServerEnvToAmplify(grep, ['BUILDPAD_CUSTOMER_HOSTS'])).toMatchObject({ text: grep, present: ['BUILDPAD_CUSTOMER_HOSTS'] });
  });

  test('a file with no step that writes .env.production is left for the developer', () => {
    const text = 'frontend:\n  phases:\n    build:\n      commands:\n        - npm run build\n';
    expect(addServerEnvToAmplify(text, ['BUILDPAD_CUSTOMER_HOSTS'])).toEqual({
      text,
      added: [],
      present: [],
      unplaced: ['BUILDPAD_CUSTOMER_HOSTS'],
    });
  });

  test('keeps CRLF line endings, and adds several variables in order', () => {
    const crlf = WITH_KEY.replace(/\n/g, '\r\n');
    const { text, added } = addServerEnvToAmplify(crlf, ['BUILDPAD_CUSTOMER_HOSTS', 'OTHER_SERVER_VAR']);

    expect(added).toEqual(['BUILDPAD_CUSTOMER_HOSTS', 'OTHER_SERVER_VAR']);
    expect(text).not.toMatch(/[^\r]\n/);
    const lines = text.split('\r\n');
    const key = lines.findIndex(line => line.includes('BUILDPAD_ONBOARDING_KEY'));
    expect(lines.slice(key + 1, key + 3)).toEqual([`        ${HOSTS_LINE}`, `        ${envProductionLine('OTHER_SERVER_VAR')}`]);
  });
});

describe('ensureAmplifyServerEnv', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-amplify-'));
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  test('writes the line into <cwd>/amplify.yml', async () => {
    await fs.writeFile(path.join(dir, 'amplify.yml'), WITH_KEY);
    expect(await ensureAmplifyServerEnv(dir, ['BUILDPAD_CUSTOMER_HOSTS'])).toEqual({
      file: path.join(dir, 'amplify.yml'),
      added: ['BUILDPAD_CUSTOMER_HOSTS'],
      manual: [],
    });
    expect(await fs.readFile(path.join(dir, 'amplify.yml'), 'utf8')).toContain(HOSTS_LINE);
  });

  test('with no amplify.yml, the variable is for the developer to add', async () => {
    expect(await ensureAmplifyServerEnv(dir, ['BUILDPAD_CUSTOMER_HOSTS'])).toEqual({
      file: null,
      added: [],
      manual: ['BUILDPAD_CUSTOMER_HOSTS'],
    });
    expect(await fs.pathExists(path.join(dir, 'amplify.yml'))).toBe(false);
  });

  test('a module with no server variables does nothing', async () => {
    await fs.writeFile(path.join(dir, 'amplify.yml'), WITH_KEY);
    expect(await ensureAmplifyServerEnv(dir, [])).toEqual({ file: null, added: [], manual: [] });
    expect(await fs.readFile(path.join(dir, 'amplify.yml'), 'utf8')).toBe(WITH_KEY);
  });
});
