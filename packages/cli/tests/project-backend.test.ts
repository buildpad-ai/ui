import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import {
  libBackendMismatch,
  libForBackend,
  readProjectBackend,
} from '../src/utils/project-backend.js';

const REGISTRY = {
  lib: {
    'external-oauth': { name: 'external-oauth', description: '', engineVariant: 'external-oauth-engine' },
    'external-oauth-engine': { name: 'external-oauth-engine', description: '', backend: 'engine' as const },
    'api-routes': { name: 'api-routes', description: '' },
    'dangling': { name: 'dangling', description: '', engineVariant: 'not-in-registry' },
  },
};

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-backend-'));
});
afterEach(async () => {
  await fs.remove(dir);
});

describe('readProjectBackend', () => {
  test('null when nothing records a backend', () => {
    expect(readProjectBackend(dir)).toBeNull();
  });

  test('reads .buildpad/project.json as the Platform writes it', async () => {
    await fs.outputFile(path.join(dir, '.buildpad/project.json'), '{\n  "buildpadProject": 1,\n  "backend": "engine"\n}\n');
    expect(readProjectBackend(dir)).toBe('engine');
  });

  test('project.json wins over the answer file', async () => {
    await fs.outputJSON(path.join(dir, '.buildpad/project.json'), { buildpadProject: 1, backend: 'supabase' });
    await fs.outputJSON(path.join(dir, '.buildpad/backend-answer.json'), { buildpadBackendAnswer: 1, backend: 'engine' });
    expect(readProjectBackend(dir)).toBe('supabase');
  });

  test('falls back to the answer file when project.json is missing, malformed or names no backend', async () => {
    await fs.outputJSON(path.join(dir, '.buildpad/backend-answer.json'), { buildpadBackendAnswer: 1, backend: 'engine' });
    expect(readProjectBackend(dir)).toBe('engine');
    await fs.outputFile(path.join(dir, '.buildpad/project.json'), '{ not json');
    expect(readProjectBackend(dir)).toBe('engine');
    await fs.outputJSON(path.join(dir, '.buildpad/project.json'), { buildpadProject: 1, backend: 'firebase' });
    expect(readProjectBackend(dir)).toBe('engine');
  });
});

describe('libForBackend', () => {
  test('swaps a module for its Engine variant on an Engine project only', () => {
    expect(libForBackend('external-oauth', REGISTRY, 'engine')).toBe('external-oauth-engine');
    expect(libForBackend('external-oauth', REGISTRY, 'supabase')).toBe('external-oauth');
    expect(libForBackend('external-oauth', REGISTRY, null)).toBe('external-oauth');
  });

  test('leaves modules without a variant, and variants missing from the registry, alone', () => {
    expect(libForBackend('api-routes', REGISTRY, 'engine')).toBe('api-routes');
    expect(libForBackend('dangling', REGISTRY, 'engine')).toBe('dangling');
    expect(libForBackend('unknown', REGISTRY, 'engine')).toBe('unknown');
  });
});

describe('libBackendMismatch', () => {
  test('refuses an Engine module only when the project records Supabase', () => {
    expect(libBackendMismatch('external-oauth-engine', REGISTRY, 'supabase')).toContain('Install external-oauth instead');
    expect(libBackendMismatch('external-oauth-engine', REGISTRY, 'engine')).toBeNull();
    expect(libBackendMismatch('external-oauth-engine', REGISTRY, null)).toBeNull();
    expect(libBackendMismatch('api-routes', REGISTRY, 'engine')).toBeNull();
  });
});
