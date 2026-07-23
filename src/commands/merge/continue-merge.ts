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

  const ctx = getGitContext();
  const tempBranch = ctx.currentBranch;

  out.blank();
  console.log(chalk.bold(t("merge.continuing")));

  if (isMergeInProgress()) {
    const s = startSpinner(t("merge.committingResolution"));
    await commitMerge();
    succeed(s, t("merge.committedResolution"));
  }

  let s = startSpinner(t("merge.pushing"));
  await pushBranch(tempBranch);
  succeed(s, t("merge.pushed", { name: chalk.cyan(tempBranch) }));

  const targetMatch = tempBranch.match(/merge\/.+-to-(.+)-\d{12}$/);
  const targetBranch = targetMatch ? targetMatch[1] : "develop";
  const targetHyphen = targetBranch.replace(/\//g, "-");
  const sourceMatch = tempBranch.match(new RegExp(`merge/(.+)-to-${targetHyphen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{12}$`));
  const sourceBranch = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "unknown";

  s = startSpinner(t("merge.creatingPr"));
  const title = await getPrTitle(sourceBranch);
  const body = await generateBody(sourceBranch, targetBranch);

  const pr = await createPR({
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
