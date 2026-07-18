import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Module-level constants in config-store read HOME at import time,
// so we must set HOME before import and reset modules between tests.

const originalHome = process.env.HOME;

describe("config-store", () => {
  let configDir: string;

  async function initStore(dir: string) {
    vi.stubEnv("HOME", dir);
    delete process.env.XDG_CONFIG_HOME;
    return await import("../src/lib/config-store.js");
  }

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "gx-config-test-"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(configDir, { recursive: true, force: true });
  });

  it("loadConfig returns default when no config file exists", async () => {
    const store = await initStore(configDir);
    const config = store.loadConfig();
    expect(config.version).toBe(1);
    expect(config.repos).toEqual({});
  });

  it("saveConfig and loadConfig round-trip", async () => {
    const store = await initStore(configDir);
    const config = store.loadConfig();
    config.language = "zh";
    config.repos["test/repo"] = { targets: ["main", "develop"] };
    store.saveConfig(config);

    const reloaded = store.loadConfig();
    expect(reloaded.language).toBe("zh");
    expect(reloaded.repos["test/repo"]?.targets).toEqual(["main", "develop"]);
  });

  it("addTarget creates repo entry and adds target", async () => {
    const store = await initStore(configDir);
    store.addTarget("pigpigever", "gx", "main");
    expect(store.getRepoTargets("pigpigever", "gx")).toEqual(["main"]);

    store.addTarget("pigpigever", "gx", "develop");
    expect(store.getRepoTargets("pigpigever", "gx")).toEqual(["main", "develop"]);

    store.addTarget("pigpigever", "gx", "main");
    expect(store.getRepoTargets("pigpigever", "gx")).toEqual(["main", "develop"]);
  });

  it("removeTarget removes target", async () => {
    const store = await initStore(configDir);
    store.addTarget("x", "y", "main");
    store.addTarget("x", "y", "develop");
    store.removeTarget("x", "y", "main");
    expect(store.getRepoTargets("x", "y")).toEqual(["develop"]);
  });

  it("setTargets replaces all targets", async () => {
    const store = await initStore(configDir);
    store.addTarget("a", "b", "old");
    store.setTargets("a", "b", ["new1", "new2"]);
    expect(store.getRepoTargets("a", "b")).toEqual(["new1", "new2"]);
  });

  it("getLanguage returns en by default", async () => {
    const store = await initStore(configDir);
    expect(store.getLanguage()).toBe("en");
  });

  it("setLanguage and getLanguage round-trip", async () => {
    const store = await initStore(configDir);
    store.setLanguage("zh");
    expect(store.getLanguage()).toBe("zh");
  });

  it("getRepoConfig returns null for unknown repo", async () => {
    const store = await initStore(configDir);
    expect(store.getRepoConfig("nope", "nope")).toBeNull();
  });

  it("configExists returns false when no config", async () => {
    const store = await initStore(configDir);
    expect(store.configExists()).toBe(false);
  });

  it("configExists returns true after save", async () => {
    const store = await initStore(configDir);
    store.saveConfig(store.loadConfig());
    expect(store.configExists()).toBe(true);
  });
});
