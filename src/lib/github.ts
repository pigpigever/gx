import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PRCreateOptions, PROverview } from "../types.js";

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

export function isGhAuthenticated(): boolean {
  try {
    execSync("gh auth status", { stdio: "pipe" });
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

export function checkExistingPR(
  owner: string,
  repo: string,
  head: string,
  base: string
): ExistingPR | null {
  try {
    const json = execSync(
      `gh pr list --head "${head}" --base "${base}" --state open --json number,url --limit 1`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!json || json === "[]") return null;

    const parsed = JSON.parse(json);
    if (parsed.length > 0) {
      return { number: parsed[0].number, url: parsed[0].url };
    }
    return null;
  } catch {
    // REST fallback done synchronously is complex; if gh CLI fails, return null
    // (the caller can handle this gracefully)
    return null;
  }
}

// ── Create PR ──

export interface CreatedPR {
  url: string;
  number: number;
}

export function createPR(opts: PRCreateOptions): CreatedPR {
  const { owner, repo, head, base, title, body, draft } = opts;

  let cmd = `gh pr create --repo "${owner}/${repo}" --head "${head}" --base "${base}"`;
  cmd += ` --title "${escapeShell(title)}"`;
  cmd += ` --body "${escapeShell(body)}"`;
  if (draft) cmd += " --draft";

  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const numMatch = output.match(/\/pull\/(\d+)/);
    const number = numMatch ? parseInt(numMatch[1], 10) : 0;

    return { url: output, number };
  } catch (err: any) {
    // Try REST API fallback
    const token = getAuthToken();
    if (token) {
      const result = createPRRestSync(opts, token);
      if (result) return result;
    }
    throw new Error(
      `Failed to create PR to ${base}: ${err?.stderr || err?.message || err}`
    );
  }
}

function createPRRestSync(opts: PRCreateOptions, token: string): CreatedPR | null {
  // Use synchronous HTTP via child_process curl
  try {
    const body = JSON.stringify({
      title: opts.title,
      body: opts.body,
      head: opts.head,
      base: opts.base,
      draft: opts.draft,
    });

    const cmd = `curl -s -X POST "https://api.github.com/repos/${opts.owner}/${opts.repo}/pulls" -H "Authorization: token ${token}" -H "Accept: application/vnd.github.v3+json" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

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
    // REST fallback
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
// OLD version change — conflicts with main's escapeShell fix
