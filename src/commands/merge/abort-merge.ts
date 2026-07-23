import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import chalk from "chalk";
import {
  getGitContext,
  checkoutBranch,
  deleteLocalBranch,
  isMergeInProgress,
  isOnGxMergeBranch,
} from "@/lib/git.js";
import { confirmAction } from "@/lib/interactor.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";

const execAsync = promisify(execCb);

async function abortGitMerge(): Promise<void> {
  await execAsync("git merge --abort");
}

export async function abortMerge(): Promise<void> {
  if (!isOnGxMergeBranch()) {
    throw new Error(t("merge.nothingToAbort"));
  }

  const confirmed = await confirmAction(t("merge.abortConfirm"), false);
  if (!confirmed) {
    console.log(chalk.dim(t("general.aborted")));
    return;
  }

  const ctx = getGitContext();
  const tempBranch = ctx.currentBranch;

  // Abort git merge if in progress
  if (isMergeInProgress()) {
    await abortGitMerge();
  }

  // Switch back to source branch
  const targetMatch = tempBranch.match(/merge\/.+-to-(.+)-\d{12}$/);
  const targetHyphen = targetMatch ? targetMatch[1].replace(/\//g, "-") : "";
  const sourceMatch = targetHyphen
    ? tempBranch.match(new RegExp(`merge/(.+)-to-${targetHyphen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{12}$`))
    : tempBranch.match(/merge\/(.+)-to-/);
  const sourceBranch = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "main";

  try {
    await checkoutBranch(sourceBranch);
  } catch {
    // If source branch doesn't exist locally, go to main
    await checkoutBranch("main");
  }

  // Delete temp branch
  await deleteLocalBranch(tempBranch);

  out.success(t("merge.mergeAborted", { temp: tempBranch, branch: sourceBranch }));
  out.blank();
}
