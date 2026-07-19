import { execSync } from "node:child_process";
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
    execSync("git merge --abort", { stdio: "inherit" });
  }

  // Switch back to source branch
  const sourceMatch = tempBranch.match(/merge\/(.+?)-to-/);
  const sourceBranch = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "main";

  try {
    checkoutBranch(sourceBranch);
  } catch {
    // If source branch doesn't exist locally, go to main
    checkoutBranch("main");
  }

  // Delete temp branch
  deleteLocalBranch(tempBranch);

  out.success(t("merge.mergeAborted", { temp: tempBranch, branch: sourceBranch }));
  out.blank();
}
