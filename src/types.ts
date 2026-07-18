// ── Git context ──

export interface GitContext {
  rootDir: string;
  currentBranch: string;
  remoteUrl: string;
  owner: string;
  repo: string;
}

// ── Configuration ──

export interface RepoConfig {
  targets: string[];
  defaultMergeTarget?: string;
}

export interface GxConfig {
  version: number;
  language?: string;
  repos: Record<string, RepoConfig>; // "owner/repo" → RepoConfig
}

// ── PR operations ──

export interface PRResult {
  target: string;
  status: "created" | "skipped" | "error";
  url: string;
  number: number | null;
  error: string;
}

export interface PRCreateOptions {
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
  draft: boolean;
}

// ── PR status display ──

export interface PROverview {
  number: number;
  title: string;
  head: string;
  base: string;
  state: string;
  url: string;
  ciStatus: "passing" | "failing" | "pending" | "unknown";
  author: string;
  draft: boolean;
}

// ── Cleanup ──

export interface BranchToClean {
  name: string;
  mergedInto: string;
  isLocal: boolean;
  isRemote: boolean;
  isGxTemp: boolean;
}
