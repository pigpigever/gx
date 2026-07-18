import { getUniqueCommits } from "./git.js";
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

// ── Body generation ──

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

export function generateBody(
  sourceBranch: string,
  targetBranch: string
): string {
  const rawCommits = getUniqueCommits(sourceBranch, targetBranch);

  if (rawCommits.length === 0) {
    return [
      t("formatter.noUniqueCommits"),
      ``,
      `${t("formatter.source")}: \`${sourceBranch}\` → \`${targetBranch}\``,
    ].join("\n");
  }

  const commits = rawCommits.map(parseCommit);
  const features = commits.filter((c) => isFeature(c.type));
  const fixes = commits.filter((c) => isBugfix(c.type));
  const others = commits.filter((c) => !isFeature(c.type) && !isBugfix(c.type));

  const sections: string[] = [];

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
