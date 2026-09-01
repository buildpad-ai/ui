/**
 * Add Command — Staleness Detection Tests
 *
 * Unit tests for the already-installed handling in `add`:
 * - getInstalledStaleness: registry sourceSha256 vs the hash recorded at install
 * - isInstallPristine: recorded sha256 manifest vs on-disk content
 *
 * Together these drive the self-heal behavior: a component whose upstream
 * content changed and whose copies are unmodified is refreshed in place; one
 * with local edits is kept and a `buildpad upgrade` hint is emitted.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { getInstalledStaleness, isInstallPristine } from "../src/commands/add.js";
import { hashTransformed, addOriginHeader } from "../src/commands/transformer.js";
import type { Config } from "../src/commands/init.js";
import type { ComponentEntry, Registry } from "../src/resolver.js";

const TARGET = "components/ui/system-permissions.tsx";
const SOURCE = "ui-interfaces/src/system-permissions/SystemPermissions.tsx";

/** Registry hash of the upstream source, as build-registry.mjs would record it. */
const UPSTREAM_SHA = "a".repeat(64);
/** A different upstream revision of the same file. */
const UPSTREAM_SHA_NEW = "b".repeat(64);

const COMPONENT: ComponentEntry = {
  name: "system-permissions",
  title: "SystemPermissions",
  description: "",
  category: "relational",
  files: [{ source: SOURCE, target: TARGET, sourceSha256: UPSTREAM_SHA }],
  dependencies: [],
  internalDependencies: ["services"],
  sourcePackage: "@buildpad/ui-interfaces",
  lastChangedIn: "1.6.0",
};

const REGISTRY = {
  schemaVersion: 2,
  version: "1.6.0",
  packages: {
    "@buildpad/ui-interfaces": { version: "1.6.0", changelogUrl: "" },
  },
  components: [COMPONENT],
  lib: {},
} as unknown as Registry;

/** A v3 install record whose file is at `sourceSha256`. */
function makeConfig(overrides: Partial<Config> = {}, sourceSha256 = UPSTREAM_SHA): Config {
  return {
    schemaVersion: 3,
    release: "1.6.0",
    installedComponents: ["system-permissions"],
    installedLib: [],
    components: {
      "system-permissions": {
        release: "1.6.0",
        ref: "v1.6.0",
        sourcePackage: "@buildpad/ui-interfaces",
        installedAt: "2026-01-01T00:00:00.000Z",
        files: [
          { target: TARGET, sourceSha256, sha256: "deadbeef", ref: "v1.6.0", state: "clean" },
        ],
      },
    },
    ...overrides,
  } as unknown as Config;
}

describe("getInstalledStaleness", () => {
  test("flags a file whose upstream hash moved", () => {
    // Installed at UPSTREAM_SHA; the registry now ships UPSTREAM_SHA_NEW.
    const component = {
      ...COMPONENT,
      files: [{ source: SOURCE, target: TARGET, sourceSha256: UPSTREAM_SHA_NEW }],
    };
    const result = getInstalledStaleness(component, REGISTRY, makeConfig());
    expect(result).toEqual({
      stale: true,
      installedRelease: "1.6.0",
      latestRelease: "1.6.0",
    });
  });

  test("not stale when the upstream hash is unchanged", () => {
    expect(getInstalledStaleness(COMPONENT, REGISTRY, makeConfig()).stale).toBe(false);
  });

  test("a lockstep bump with byte-identical files is not stale", () => {
    // The whole point of hash-based detection: the release moved, the file did not.
    const registry = { ...REGISTRY, version: "1.9.0" } as unknown as Registry;
    expect(getInstalledStaleness(COMPONENT, registry, makeConfig()).stale).toBe(false);
  });

  test("flags a file the registry has added since install", () => {
    const component = {
      ...COMPONENT,
      files: [
        { source: SOURCE, target: TARGET, sourceSha256: UPSTREAM_SHA },
        { source: "ui-interfaces/src/system-permissions/styles.css", target: "components/ui/system-permissions.css", sourceSha256: UPSTREAM_SHA_NEW },
      ],
    };
    expect(getInstalledStaleness(component, REGISTRY, makeConfig()).stale).toBe(true);
  });

  test("flags a file the registry no longer ships", () => {
    const component = { ...COMPONENT, files: [] };
    expect(getInstalledStaleness(component, REGISTRY, makeConfig()).stale).toBe(true);
  });

  test("flags a file a previous upgrade left pending", () => {
    const config = makeConfig();
    config.components!["system-permissions"].files[0].state = "pending";
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(true);
  });

  test("never stale for v1 configs (no schemaVersion tracking)", () => {
    const config = makeConfig({ schemaVersion: 1 });
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("never stale without an install record (pre-tracking installs)", () => {
    const config = makeConfig({ components: {} });
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("a v2 record with no upstream hash is not reported stale — migrate handles it", () => {
    // Comparing against `undefined` would mark every file stale on the first
    // v3 run; `migrate` backfills the baseline instead.
    const config = makeConfig();
    delete (config.components!["system-permissions"].files[0] as any).sourceSha256;
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("a registry with no file hashes (v1) cannot decide, so is not stale", () => {
    const component = { ...COMPONENT, files: [{ source: SOURCE, target: TARGET }] };
    expect(getInstalledStaleness(component, REGISTRY, makeConfig()).stale).toBe(false);
  });
});

describe("isInstallPristine", () => {
  let tmpDir: string;
  const CONTENT = "export const SystemPermissions = () => null;\n";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "buildpad-staleness-"));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  function configWithManifest(sha256: string): Config {
    const config = makeConfig();
    config.components!["system-permissions"].files = [
      { target: TARGET, sourceSha256: UPSTREAM_SHA, sha256, ref: "v1.6.0", state: "clean" },
    ];
    return config;
  }

  test("pristine when on-disk content matches the recorded hash", async () => {
    await fs.outputFile(path.join(tmpDir, TARGET), CONTENT);
    const config = configWithManifest(hashTransformed(CONTENT));
    expect(isInstallPristine("system-permissions", config, tmpDir)).toBe(true);
  });

  test("pristine is insensitive to the origin header and line endings", async () => {
    // Simulate what the CLI writes: header + CRLF content; hash recorded on canonical form
    const withHeader = addOriginHeader(
      CONTENT.replace(/\n/g, "\r\n"),
      "system-permissions",
      "@buildpad/ui-interfaces",
      "1.5.0",
    );
    await fs.outputFile(path.join(tmpDir, TARGET), withHeader);
    const config = configWithManifest(hashTransformed(CONTENT));
    expect(isInstallPristine("system-permissions", config, tmpDir)).toBe(true);
  });

  test("not pristine when the file was edited", async () => {
    await fs.outputFile(path.join(tmpDir, TARGET), CONTENT + "// my customization\n");
    const config = configWithManifest(hashTransformed(CONTENT));
    expect(isInstallPristine("system-permissions", config, tmpDir)).toBe(false);
  });

  test("missing files are refresh-safe (nothing to lose)", async () => {
    const config = configWithManifest(hashTransformed(CONTENT));
    expect(isInstallPristine("system-permissions", config, tmpDir)).toBe(true);
  });

  test("not pristine without a file manifest (cannot verify)", () => {
    const config = makeConfig();
    config.components!["system-permissions"].files = [];
    expect(isInstallPristine("system-permissions", config, tmpDir)).toBe(false);
  });
});
