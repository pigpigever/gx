import { getRecentCommits } from "./git.js";
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

export function generateBody(
  sourceBranch: string,
  _targetBranch: string
): string {
  const commits = getRecentCommits(sourceBranch, 5);
  const summary = commits.length > 0
    ? commits.map((c) => `- ${c}`).join("\n")
    : t("formatter.noRecentCommits");

  return [
    t("formatter.prGeneratedBy"),
    ``,
    `**${t("formatter.source")}** \`${sourceBranch}\``,
    ``,
    `## ${t("formatter.recentCommits")}`,
    summary,
  ].join("\n");
}
