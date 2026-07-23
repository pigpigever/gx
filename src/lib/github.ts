import { execSync, exec as execCb } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PRCreateOptions, PROverview } from "../types.js";

function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execCb(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

// ── Auth ──

export function getAuthToken(): string | null {
  // 1. gh CLI token
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (token) return token;
  } catch {
    // gh not available or not logged in
  }

  // 2. GITHUB_TOKEN env var
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // 3. gh hosts.yml
  const ghHostsPath = join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".config",
    "gh",
    "hosts.yml"
  );
  if (existsSync(ghHostsPath)) {
    try {
      const content = readFileSync(ghHostsPath, "utf-8");
      const match = content.match(/oauth_token:\s*(\S+)/);
      if (match) return match[1];
    } catch {
      // ignore
    }
  }

  return null;
}

export function isGhInstalled(): boolean {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function isGhAuthenticated(): Promise<boolean> {
  try {
    await execAsync("gh auth status");
    return true;
  } catch {
    return getAuthToken() !== null;
  }
}

// ── PR checks ──

export interface ExistingPR {
  number: number;
  url: string;
}

export async function checkExistingPR(
  owner: string,
  repo: string,
  head: string,
  base: string
): Promise<ExistingPR | null> {
  try {
    const json = await execAsync(
      `gh pr list --head "${head}" --base "${base}" --state open --json number,url --limit 1`
    );

    if (!json || json === "[]") return null;

    const parsed = JSON.parse(json);
    if (parsed.length > 0) {
      return { number: parsed[0].number, url: parsed[0].url };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Create PR ──

export interface CreatedPR {
  url: string;
  number: number;
}

function parseGhPrError(stderr: string, head: string, base: string): string {
  const lower = stderr.toLowerCase();

  if (lower.includes("no commits between")) {
    return `errorNoCommits|${head}|${base}`;
  }
  if (
    lower.includes("head ref must be a valid ref") ||
    lower.includes("branch not found") ||
    (lower.includes("not found") && lower.includes("head"))
  ) {
    return `errorBranchNotFound|${head}`;
  }
  if (
    lower.includes("resource not accessible") ||
    lower.includes("403") ||
    lower.includes("forbidden")
  ) {
    return `errorPermissionDenied`;
  }
  if (lower.includes("rate limit")) {
    return `errorRateLimit`;
  }
  if (
    lower.includes("net::err") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound")
  ) {
    return `errorNetwork`;
  }

  // Strip the raw gh command from the error for a cleaner fallback
  const cmdMatch = stderr.match(/gh pr create\s+[\s\S]*?(?:\n|$)/);
  const cleaned = cmdMatch
    ? stderr.replace(cmdMatch[0], "").trim()
    : stderr.trim();
  return cleaned || "Unknown error";
}

export async function createPR(opts: PRCreateOptions): Promise<CreatedPR> {
  const { owner, repo, head, base, title, body, draft } = opts;

  let cmd = `gh pr create --repo "${owner}/${repo}" --head "${head}" --base "${base}"`;
  cmd += ` --title "${escapeShell(title)}"`;
  cmd += ` --body "${escapeShell(body)}"`;
  if (draft) cmd += " --draft";

  try {
    const output = await execAsync(cmd);

    const numMatch = output.match(/\/pull\/(\d+)/);
    const number = numMatch ? parseInt(numMatch[1], 10) : 0;

    return { url: output, number };
  } catch (err: any) {
    const token = getAuthToken();
    if (token) {
      const result = await createPRRestAsync(opts, token);
      if (result) return result;
    }

    const raw = err?.stderr || err?.message || String(err);
    const parsed = parseGhPrError(raw, head, base);
    throw new Error(parsed);
  }
}

async function createPRRestAsync(opts: PRCreateOptions, token: string): Promise<CreatedPR | null> {
  try {
    const body = JSON.stringify({
      title: opts.title,
      body: opts.body,
      head: opts.head,
      base: opts.base,
      draft: opts.draft,
    });

    const cmd = `curl -s -X POST "https://api.github.com/repos/${opts.owner}/${opts.repo}/pulls" -H "Authorization: token ${token}" -H "Accept: application/vnd.github.v3+json" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`;
    const output = await execAsync(cmd);

    const data = JSON.parse(output);
    if (data.html_url) {
      return { url: data.html_url, number: data.number };
    }
    return null;
  } catch {
    return null;
  }
}

// ── List PRs ──

export function listOpenPRs(
  owner: string,
  repo: string
): PROverview[] {
  try {
    const json = execSync(
      `gh pr list --repo "${owner}/${repo}" --state open --json number,title,headRefName,baseRefName,state,url,author,isDraft,statusCheckRollup --limit 50`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!json || json === "[]") return [];

    const raw = JSON.parse(json);
    return raw.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      head: pr.headRefName,
      base: pr.baseRefName,
      state: pr.state,
      url: pr.url,
      ciStatus: parseCIStatus(pr.statusCheckRollup),
      author: pr.author?.login || "unknown",
      draft: pr.isDraft || false,
    }));
  } catch {
    const token = getAuthToken();
    if (token) return listOpenPRsRestSync(owner, repo, token);
    return [];
  }
}

function listOpenPRsRestSync(
  owner: string,
  repo: string,
  token: string
): PROverview[] {
  try {
    const cmd = `curl -s "https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=50" -H "Authorization: token ${token}" -H "Accept: application/vnd.github.v3+json"`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const data = JSON.parse(output);
    if (!Array.isArray(data)) return [];

    return data.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      head: pr.head?.ref || pr.head?.label?.split(":")[1] || "",
      base: pr.base?.ref || "",
      state: pr.state,
      url: pr.html_url,
      ciStatus: "unknown" as const,
      author: pr.user?.login || "unknown",
      draft: pr.draft || false,
    }));
  } catch {
    return [];
  }
}

// ── Helpers ──

function escapeShell(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`");
}

function parseCIStatus(
  rollup: any
): PROverview["ciStatus"] {
  if (!rollup || rollup.length === 0) return "unknown";

  const allPassed = rollup.every((c: any) => c.conclusion === "SUCCESS");
  const anyFailed = rollup.some(
    (c: any) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED"
  );
  const anyPending = rollup.some(
    (c: any) => c.status === "IN_PROGRESS" || c.status === "QUEUED"
  );

  if (anyFailed) return "failing";
  if (anyPending) return "pending";
  if (allPassed) return "passing";
  return "unknown";
}

// ── PR conflict check ──

export async function checkPRConflicts(owner: string, repo: string, number: number): Promise<boolean> {
  try {
    const json = await execAsync(
      `gh pr view ${number} --repo "${owner}/${repo}" --json mergeable`
    );
    const data = JSON.parse(json);
    return data.mergeable === "CONFLICTING";
  } catch {
    return false;
  }
}

// ── PR info for cleanup ──

export interface BranchPRInfo {
  number: number;
  title: string;
  state: string;
  url: string;
}

export function getPRsForBranch(owner: string, repo: string, head: string): BranchPRInfo[] {
  try {
    const json = execSync(
      `gh pr list --head "${head}" --repo "${owner}/${repo}" --json number,title,state,url`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    if (!json || json === "[]") return [];
    return JSON.parse(json) as BranchPRInfo[];
  } catch {
    return [];
  }
}
