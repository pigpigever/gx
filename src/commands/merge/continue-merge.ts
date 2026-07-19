import { execSync } from "node:child_process";
import chalk from "chalk";
import {
  getGitContext,
  pushBranch,
  commitMerge,
  isMergeInProgress,
  getConflictedFiles,
  isOnGxMergeBranch,
  allConflictsResolved,
} from "@/lib/git.js";
import { createPR } from "@/lib/github.js";
import { generateBody, getPrTitle } from "@/lib/formatter.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";

export async function continueMerge(): Promise<void> {
  if (!isOnGxMergeBranch()) {
    throw new Error(t("merge.notOnMergeBranch"));
  }

  if (isMergeInProgress() && !allConflictsResolved()) {
    const files = getConflictedFiles();
    throw new Error(
      t("merge.conflictsUnresolved", { count: files.length, files: files.join("\n  ") })
    );
  }

  const tempBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();

  out.blank();
  console.log(chalk.bold(t("merge.continuing")));

  if (isMergeInProgress()) {
    const s = startSpinner(t("merge.committingResolution"));
    commitMerge();
    succeed(s, t("merge.committedResolution"));
  }

  let s = startSpinner(t("merge.pushing"));
  pushBranch(tempBranch);
  succeed(s, t("merge.pushed", { name: chalk.cyan(tempBranch) }));

  const ctx = getGitContext();
  const targetMatch = tempBranch.match(/merge\/.+?-to-(.+?)-\d{12}$/);
  const targetBranch = targetMatch ? targetMatch[1] : "develop";
  const sourceMatch = tempBranch.match(/merge\/(.+?)-to-/);
  const sourceBranch = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "unknown";

  s = startSpinner(t("merge.creatingPr"));
  const title = getPrTitle(sourceBranch);
  const body = generateBody(sourceBranch, targetBranch);

  const pr = createPR({
    owner: ctx.owner,
    repo: ctx.repo,
    head: tempBranch,
    base: targetBranch,
    title,
    body: `Merges \`${sourceBranch}\` into \`${targetBranch}\`\n\n${body}`,
    draft: false,
  });

  succeed(s, t("merge.prCreated", { url: pr.url }));
  out.blank();
  console.log(
    chalk.dim(t("cleanup.afterCleanupNote", { number: pr.number }))
  );
  out.blank();
}
