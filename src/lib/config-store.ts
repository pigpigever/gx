import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { GxConfig, RepoConfig } from "../types.js";

const CONFIG_DIR = join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".config",
  "gx"
);
const CONFIG_PATH = join(CONFIG_DIR, "config.yaml");

const DEFAULT_CONFIG: GxConfig = {
  version: 1,
  repos: {},
};

let _cache: GxConfig | null = null;

// ── Load / Save ──

export function loadConfig(): GxConfig {
  if (!existsSync(CONFIG_PATH)) {
    return structuredClone(DEFAULT_CONFIG);
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  try {
    const parsed = parse(raw) as GxConfig;
    return parsed && parsed.repos ? parsed : structuredClone(DEFAULT_CONFIG);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: GxConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const yaml = stringify(config, { lineWidth: 120 });
  writeFileSync(CONFIG_PATH, yaml, "utf-8");
  _cache = null;
}

// ── Repo targets ──

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function getRepoTargets(owner: string, repo: string): string[] {
  const config = loadConfig();
  return config.repos[repoKey(owner, repo)]?.targets ?? [];
}

export function getRepoConfig(owner: string, repo: string): RepoConfig | null {
  const config = loadConfig();
  return config.repos[repoKey(owner, repo)] ?? null;
}

export function getDefaultMergeTarget(owner: string, repo: string): string | null {
  const config = loadConfig();
  const repoConf = config.repos[repoKey(owner, repo)];
  if (repoConf?.defaultMergeTarget) return repoConf.defaultMergeTarget;
  // Fall back to first target, or commonly "develop"
  const targets = repoConf?.targets ?? [];
  if (targets.length > 0) return targets[0];
  return null;
}

export function addTarget(owner: string, repo: string, target: string): void {
  const config = loadConfig();
  const key = repoKey(owner, repo);
  if (!config.repos[key]) {
    config.repos[key] = { targets: [] };
  }
  if (!config.repos[key].targets.includes(target)) {
    config.repos[key].targets.push(target);
  }
  saveConfig(config);
}

export function removeTarget(owner: string, repo: string, target: string): void {
  const config = loadConfig();
  const key = repoKey(owner, repo);
  if (config.repos[key]) {
    config.repos[key].targets = config.repos[key].targets.filter(
      (t) => t !== target
    );
    saveConfig(config);
  }
}

export function setTargets(owner: string, repo: string, targets: string[]): void {
  const config = loadConfig();
  const key = repoKey(owner, repo);
  if (!config.repos[key]) {
    config.repos[key] = { targets: [] };
  }
  config.repos[key].targets = targets;
  saveConfig(config);
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

// ── Language ──

export function getLanguage(): string {
  const config = loadConfig();
  return config.language || "en";
}

export function setLanguage(lang: string): void {
  const config = loadConfig();
  config.language = lang;
  saveConfig(config);
}
