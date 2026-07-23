import { execSync } from "node:child_process";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";

const execAsync = promisify(execCb);

// ── helpers ──

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

// ── Types ──

export type CommitType = "feat" | "fix" | "chore" | "docs" | "refactor" | "test" | "perf" | "ci" | "build" | "style" | "revert";

export const COMMIT_TYPES: CommitType[] = [
  "feat", "fix", "chore", "docs", "refactor", "test", "perf", "ci", "build", "style", "revert",
];

export interface StagedAnalysis {
  files: string[];
  added: number;
  modified: number;
  deleted: number;
  /** Inferred scope from file paths */
  suggestedScope: string;
  /** Inferred type */
  suggestedType: CommitType;
  /** Branch name hint (feat/xxx → feat, fix/xxx → fix) */
  branchHint: CommitType | null;
}

// ── Type inference from branch name ──

const BRANCH_TYPE_PREFIXES: Record<string, CommitType> = {
  feat: "feat",
  feature: "feat",
  fix: "fix",
  bugfix: "fix",
  hotfix: "fix",
  chore: "chore",
  refactor: "refactor",
  docs: "docs",
  test: "test",
  perf: "perf",
  ci: "ci",
  build: "build",
  style: "style",
  revert: "revert",
};

export function inferTypeFromBranch(branch: string): CommitType | null {
  const prefix = branch.split("/")[0].toLowerCase();
  return BRANCH_TYPE_PREFIXES[prefix] ?? null;
}

// ── Scope inference from file paths ──

export function inferScope(files: string[]): string {
  if (files.length === 0) return "";

  const dirs = files.map((f) => {
    const parts = f.split("/");
    if (parts.length === 1) return ""; // root file
    return parts[0]; // top-level dir
  }).filter(Boolean);

  if (dirs.length === 0) return "";

  // Most common top-level dir
  const counts = new Map<string, number>();
  for (const d of dirs) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  let best = "";
  let bestCount = 0;
  for (const [dir, count] of counts) {
    if (count > bestCount || (count === bestCount && dir < best)) {
      best = dir;
      bestCount = count;
    }
  }

  // Only suggest scope if majority of files share it
  return bestCount >= files.length * 0.5 ? best : "";
}

// ── Type inference from file content ──

export function inferTypeFromFiles(files: string[]): CommitType {
  const hasDocs = files.every((f) => f.endsWith(".md") || f.startsWith("docs/"));
  if (hasDocs) return "docs";

  const hasTests = files.some((f) => f.includes(".test.") || f.includes(".spec.") || f.startsWith("test/") || f.startsWith("tests/") || f.startsWith("__tests__/"));
  if (hasTests) return "test";

  const hasCI = files.some((f) => f.startsWith(".github/") || f.startsWith("ci/") || f === "Dockerfile");
  if (hasCI) return "ci";

  const hasConfig = files.every((f) => f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".toml"));
  if (hasConfig) return "chore";

  return "feat"; // default
}

// ── Main analysis ──

export function analyzeStaged(): StagedAnalysis {
  const files = exec("git diff --staged --name-only")
    .split("\n")
    .filter(Boolean);

  const _stats = exec("git diff --staged --stat");

  // Count new/modified/deleted by whether file exists in HEAD
  let newFiles = 0, modFiles = 0, delFiles = 0;
  for (const file of files) {
    const _exists = exec(`git ls-files --error-unmatch "${file}" 2>/dev/null && echo "exists"`);
    const staged = exec(`git diff --staged --name-only --diff-filter=A -- "${file}"`);
    const deleted = exec(`git diff --staged --name-only --diff-filter=D -- "${file}"`);
    if (deleted) delFiles++;
    else if (staged) newFiles++;
    else modFiles++;
  }

  const branchHint = inferTypeFromBranch(exec("git branch --show-current"));
  const fileType = inferTypeFromFiles(files);
  const suggestedScope = inferScope(files);
  const suggestedType = branchHint ?? fileType;

  return {
    files,
    added: newFiles,
    modified: modFiles,
    deleted: delFiles,
    suggestedScope,
    suggestedType,
    branchHint,
  };
}

export function hasStagedChanges(): boolean {
  return exec("git diff --staged --name-only") !== "";
}

export function getStagedDiff(): string {
  return exec("git diff --staged");
}

// ── Commit ──

export async function runCommit(message: string): Promise<void> {
  const escaped = message
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`");
  await execAsync(`git commit -m "${escaped}"`);
}
