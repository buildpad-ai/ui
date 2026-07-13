/**
 * Add Command — Staleness Detection Tests
 *
 * Unit tests for the already-installed handling in `add`:
 * - getInstalledStaleness: installed version vs the registry's lastChangedIn
 * - isInstallPristine: recorded sha256 manifest vs on-disk content
 *
 * Together these drive the self-heal behavior: an outdated component whose
 * copies are unmodified is refreshed in place; an outdated component with
 * local edits is kept and a `buildpad upgrade` hint is emitted.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { getInstalledStaleness, isInstallPristine } from "../src/commands/add.js";
import { hashTransformed, addOriginHeader } from "../src/commands/transformer.js";
import type { Config } from "../src/commands/init.js";
import type { ComponentEntry, Registry } from "../src/resolver.js";

const COMPONENT: ComponentEntry = {
  name: "system-permissions",
  title: "SystemPermissions",
  description: "",
  category: "relational",
  files: [
    { source: "ui-interfaces/src/system-permissions/SystemPermissions.tsx", target: "components/ui/system-permissions.tsx" },
  ],
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

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    schemaVersion: 2,
    installedComponents: ["system-permissions"],
    installedLib: [],
    components: {
      "system-permissions": {
        version: "1.5.0",
        sourcePackage: "@buildpad/ui-interfaces",
        installedAt: "2026-01-01T00:00:00.000Z",
        files: [],
      },
    },
    ...overrides,
  } as unknown as Config;
}

describe("getInstalledStaleness", () => {
  test("flags installed version older than lastChangedIn", () => {
    const result = getInstalledStaleness(COMPONENT, REGISTRY, makeConfig());
    expect(result).toEqual({ stale: true, installedVersion: "1.5.0", lastChangedIn: "1.6.0" });
  });

  test("not stale when installed version equals lastChangedIn", () => {
    const config = makeConfig();
    config.components!["system-permissions"].version = "1.6.0";
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("not stale when installed version is newer", () => {
    const config = makeConfig();
    config.components!["system-permissions"].version = "1.7.0";
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("component untouched since an older release is not stale (lastChangedIn semantics)", () => {
    // Installed at 1.5.0; package is now 1.6.0 but this component last changed in 1.4.0.
    const component = { ...COMPONENT, lastChangedIn: "1.4.0" };
    expect(getInstalledStaleness(component, REGISTRY, makeConfig()).stale).toBe(false);
  });

  test("falls back to the package version when lastChangedIn is missing", () => {
    const component = { ...COMPONENT, lastChangedIn: undefined };
    const result = getInstalledStaleness(component, REGISTRY, makeConfig());
    expect(result.stale).toBe(true);
    expect(result.lastChangedIn).toBe("1.6.0");
  });

  test("never stale for v1 configs (no schemaVersion tracking)", () => {
    const config = makeConfig({ schemaVersion: 1 });
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("never stale without an install record (pre-tracking installs)", () => {
    const config = makeConfig({ components: {} });
    expect(getInstalledStaleness(COMPONENT, REGISTRY, config).stale).toBe(false);
  });

  test("never stale for v1 registries (no packages map)", () => {
    const registry = { ...REGISTRY, packages: undefined } as unknown as Registry;
    expect(getInstalledStaleness(COMPONENT, registry, makeConfig()).stale).toBe(false);
  });
});

describe("isInstallPristine", () => {
  let tmpDir: string;
  const TARGET = "components/ui/system-permissions.tsx";
  const CONTENT = "export const SystemPermissions = () => null;\n";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "buildpad-staleness-"));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  function configWithManifest(sha256: string): Config {
    const config = makeConfig();
    config.components!["system-permissions"].files = [{ target: TARGET, sha256 }];
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
    const config = makeConfig(); // files: []
    expect(isInstallPristine("system-permissions", config, tmpDir)).toBe(false);
  });
});
