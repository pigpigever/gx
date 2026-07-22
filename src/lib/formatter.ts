import { getUniqueCommits, getLatestCommitMessage, getDiff } from "./git.js";
import { getAiConfig, callAiApi } from "./ai.js";
import { t } from "./i18n.js";

const TITLE_PREFIXES: Record<string, string> = {
  feat: "feat: ",
  fix: "fix: ",
  chore: "chore: ",
  refactor: "refactor: ",
  docs: "docs: ",
  test: "test: ",
  perf: "perf: ",
  ci: "ci: ",
  build: "build: ",
  style: "style: ",
  revert: "revert: ",
  hotfix: "hotfix: ",
  release: "release: ",
};

export function branchToTitle(branch: string): string {
  const parts = branch.split("/");
  const prefix = parts[0].toLowerCase();
  const rest = parts.slice(1).join("/");

  const titlePrefix = TITLE_PREFIXES[prefix];
  if (titlePrefix && rest) {
    return `${titlePrefix}${rest}`;
  }
  if (titlePrefix) {
    return `${titlePrefix}${branch}`;
  }
  return branch;
}

export async function getPrTitle(sourceBranch: string): Promise<string> {
  const lastMsg = await getLatestCommitMessage(sourceBranch);
  return lastMsg || branchToTitle(sourceBranch);
}

// ── Commit parsing ──

interface ParsedCommit {
  hash: string;
  type: string;
  scope: string;
  message: string;
}

function parseCommit(line: string): ParsedCommit {
  const match = line.match(/^(\S+)\s+(.+)$/);
  const hash = match?.[1] ?? "";
  const fullMsg = match?.[2] ?? line;

  const ccMatch = fullMsg.match(/^(\w+)(?:\((.+?)\))?:\s*(.+)/);
  if (ccMatch) {
    return { hash, type: ccMatch[1], scope: ccMatch[2] ?? "", message: ccMatch[3] };
  }
  return { hash, type: "other", scope: "", message: fullMsg };
}

function isFeature(type: string): boolean {
  return type === "feat" || type === "feature";
}

function isBugfix(type: string): boolean {
  return type === "fix" || type === "bugfix" || type === "hotfix";
}

// ── Body generation ──

export async function generateBody(
  sourceBranch: string,
  targetBranch: string
): Promise<string> {
  const rawCommits = await getUniqueCommits(sourceBranch, targetBranch);

  if (rawCommits.length === 0) {
    return [
      `## ${t("formatter.summary")}`,
      t("formatter.noUniqueCommits"),
      ``,
      `${t("formatter.source")}: \`${sourceBranch}\` → \`${targetBranch}\``,
    ].join("\n");
  }

  const commits = rawCommits.map(parseCommit);
  const features = commits.filter((c) => isFeature(c.type));
  const fixes = commits.filter((c) => isBugfix(c.type));
  const others = commits.filter((c) => !isFeature(c.type) && !isBugfix(c.type));

  const summaryParts: string[] = [];
  if (features.length > 0) summaryParts.push(`${t("formatter.featTag")}: ${features.map((c) => c.message).join(", ")}`);
  if (fixes.length > 0) summaryParts.push(`${t("formatter.fixTag")}: ${fixes.map((c) => c.message).join(", ")}`);
  const summary = (summaryParts.join("; ") || commits[0]?.message) ?? "-";

  const sections: string[] = [];
  sections.push(`## ${t("formatter.summary")}`);
  sections.push(summary);
  sections.push("");

  if (features.length > 0) {
    sections.push(`### ${t("formatter.features")}`);
    for (const c of features) sections.push(`- ${c.hash.slice(0, 7)} ${c.message}`);
    sections.push("");
  }
  if (fixes.length > 0) {
    sections.push(`### ${t("formatter.bugfixes")}`);
    for (const c of fixes) sections.push(`- ${c.hash.slice(0, 7)} ${c.message}`);
    sections.push("");
  }
  if (others.length > 0) {
    sections.push(`### ${t("formatter.other")}`);
    for (const c of others) sections.push(`- ${c.hash.slice(0, 7)} ${c.message}`);
    sections.push("");
  }

  sections.push(`${t("formatter.source")}: \`${sourceBranch}\` → \`${targetBranch}\``);
  return sections.join("\n");
}

// ── AI generation ──

export async function generatePrContentWithAI(
  sourceBranch: string,
  targetBranch: string
): Promise<{ title: string; body: string }> {
  const aiConfig = getAiConfig();
  if (!aiConfig) {
    throw new Error(t("pr.aiNoKey"));
  }

  const [diff, commits] = await Promise.all([
    getDiff(sourceBranch, targetBranch),
    getUniqueCommits(sourceBranch, targetBranch),
  ]);

  const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;
  const commitLog = commits.join("\n");

  const prompt = [
    "You are a pull request description generator for a Git workflow tool.",
    "Given the git diff and commit log below, generate a PR title and body.",
    "",
    "Requirements:",
    "- Title: conventional commit format (type(scope): description), under 72 chars",
    "- Body: include Summary, Changes, and Testing sections",
    "- Use markdown formatting",
    "- Be concise but informative",
    "",
    `Source branch: ${sourceBranch}`,
    `Target branch: ${targetBranch}`,
    "",
    "Git diff:",
    truncatedDiff || "(no diff available)",
    "",
    "Commits:",
    commitLog || "(no commits)",
    "",
    'Return ONLY JSON: {"title": "...", "body": "..."}',
  ].join("\n");

  const response = await callAiApi(aiConfig.endpoint, aiConfig.apiKey, aiConfig.model, prompt);

  // Parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title || `${sourceBranch} → ${targetBranch}`,
    body: parsed.body || "",
  };
}
