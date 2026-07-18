import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { GitContext, BranchToClean } from "../types.js";

// ── helpers ──

function exec(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
    }).trim();
  } catch {
    return "";
  }
}

function execOrThrow(cmd: string, cwd?: string): string {
  return execSync(cmd, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    cwd,
  }).trim();
}

// ── Git context ──

export function getGitContext(): GitContext {
  const rootDir = execOrThrow("git rev-parse --show-toplevel");
  const currentBranch = execOrThrow("git branch --show-current");
  const remoteUrl = execOrThrow("git remote get-url origin");

  // Parse owner/repo from remote URL
  // Supports: git@github.com:owner/repo.git / https://github.com/owner/repo.git
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Could not parse GitHub owner/repo from remote URL: ${remoteUrl}`);
  }
  const [owner, repo] = match[1].split("/");

  return { rootDir, currentBranch, remoteUrl, owner, repo };
}

// ── Pre-flight checks ──

export function isInGitRepo(): boolean {
  return exec("git rev-parse --git-dir") !== "";
}

export function hasOriginRemote(): boolean {
  return exec("git remote get-url origin") !== "";
}

export function branchExistsOnRemote(branch: string): boolean {
  return exec(`git ls-remote --heads origin ${branch}`) !== "";
}

export function hasUnpushedCommits(branch: string): boolean {
  const result = exec(`git rev-list --count origin/${branch}..${branch}`);
  if (result === "") return false;
  return parseInt(result, 10) > 0;
}

export function hasDiff(head: string, base: string): boolean {
  const result = exec(`git diff --stat origin/${base}...origin/${head}`);
  return result !== "";
}

// ── Remote branches ──

export function getRemoteBranches(): string[] {
  const output = exec("git branch -r --format='%(refname:short)'");
  if (!output) return [];
  return output
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b.startsWith("origin/"))
    .map((b) => b.replace("origin/", ""))
    .filter((b) => b && !b.includes("HEAD"));
}

// ── Merge operations ──

export function fetchBranch(branch: string): void {
  execSync(`git fetch origin ${branch}`, { stdio: "inherit" });
}

export function createBranch(name: string, from: string): void {
  execSync(`git checkout -b ${name} origin/${from}`, { stdio: "inherit" });
}

export function checkoutBranch(branch: string): void {
  execSync(`git checkout ${branch}`, { stdio: "inherit" });
}

export function mergeBranch(source: string): { hasConflicts: boolean; conflictedFiles: string[] } {
  try {
    execSync(`git merge ${source} --no-edit`, { stdio: "inherit" });
    return { hasConflicts: false, conflictedFiles: [] };
  } catch {
    // Merge conflict — extract conflicted files
    const files = getConflictedFiles();
    return { hasConflicts: true, conflictedFiles: files };
  }
}

export function commitMerge(): void {
  execSync("git commit --no-edit", { stdio: "inherit" });
}

export function pushBranch(branch: string, setUpstream = true): void {
  const flag = setUpstream ? "-u" : "";
  execSync(`git push ${flag} origin ${branch}`, { stdio: "inherit" });
}

export function deleteLocalBranch(branch: string): void {
  execSync(`git branch -D ${branch}`, { stdio: "inherit" });
}

export function deleteRemoteBranch(branch: string): void {
  execSync(`git push origin --delete ${branch}`, { stdio: "inherit" });
}

// ── Merge state detection (using git native state, no extra files) ──

export function isMergeInProgress(): boolean {
  // Check .git/MERGE_HEAD existence
  const root = execOrThrow("git rev-parse --show-toplevel");
  return existsSync(`${root}/.git/MERGE_HEAD`);
}

export function getConflictedFiles(): string[] {
  const output = exec("git diff --name-only --diff-filter=U");
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

export function allConflictsResolved(): boolean {
  return getConflictedFiles().length === 0;
}

export function isOnGxMergeBranch(): boolean {
  const branch = exec("git branch --show-current");
  return branch.startsWith("merge/");
}

export function getMergeHead(): string {
  return exec("cat .git/MERGE_HEAD").trim();
}

// ── Sync ──

export function getLatestCommit(branch: string): string {
  return exec(`git rev-parse origin/${branch}`);
}

export function getCurrentCommit(): string {
  return exec("git rev-parse HEAD");
}

export function isBehindRemote(localBranch: string, remoteBranch: string): boolean {
  const behind = exec(`git rev-list --count ${localBranch}..origin/${remoteBranch}`);
  if (behind === "") return false;
  return parseInt(behind, 10) > 0;
}

export function getBehindCommits(localBranch: string, remoteBranch: string): string[] {
  const output = exec(
    `git log --oneline ${localBranch}..origin/${remoteBranch}`
  );
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

// ── Cleanup ──

export function getMergedBranches(targets: string[]): BranchToClean[] {
  const branches: BranchToClean[] = [];
  const localBranches = exec("git branch --format='%(refname:short)'")
    .split("\n")
    .filter(Boolean);

  // Get all remote branches that have been merged into any target
  for (const branch of localBranches) {
    if (branch === "main" || branch === "master" || branch === "develop") continue;

    for (const target of targets) {
      const merged = exec(`git branch --merged origin/${target} --format='%(refname:short)'`);
      if (merged.includes(branch)) {
        const onRemote = exec(`git ls-remote --heads origin ${branch}`) !== "";
        branches.push({
          name: branch,
          mergedInto: target,
          isLocal: true,
          isRemote: onRemote,
          isGxTemp: branch.startsWith("merge/"),
        });
        break; // Only record once per branch
      }
    }
  }

  return branches;
}

// ── Commit log ──

export function getRecentCommits(branch: string, count = 5): string[] {
  const output = exec(`git log --oneline -${count} ${branch}`);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

export function getCommitLogBetween(head: string, base: string): string[] {
  const output = exec(`git log --oneline origin/${base}..origin/${head}`);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

export function getUniqueCommits(source: string, target: string): string[] {
  const output = exec(`git log --oneline ${target}..${source}`);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

export function getLatestCommitMessage(branch: string): string | null {
  const output = exec(`git log -1 --format=%s ${branch}`);
  return output || null;
}
