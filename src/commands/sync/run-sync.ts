import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import chalk from "chalk";
import {
  getGitContext,
  fetchBranch,
  mergeBranch,
  isBehindRemote,
  getBehindCommits,
} from "@/lib/git.js";
import { getDefaultMergeTarget } from "@/lib/config-store.js";
import { confirmAction } from "@/lib/interactor.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";

const execAsync = promisify(execCb);

async function rebaseAsync(branch: string): Promise<void> {
  await execAsync(`git rebase origin/${branch}`);
}

export async function runSync(opts: any): Promise<void> {
  const ctx = getGitContext();
  const sourceBranch = ctx.currentBranch;
  const fromBranch = opts.from || getDefaultMergeTarget(ctx.owner, ctx.repo) || "develop";

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  console.log(chalk.bold(`🎯 ${t("sync.syncingFrom", { branch: fromBranch })}`));
  out.blank();

  let spinner = startSpinner(t("sync.fetching", { branch: fromBranch }));
  await fetchBranch(fromBranch);
  succeed(spinner, t("sync.fetched", { branch: fromBranch }));

  if (!isBehindRemote(sourceBranch, fromBranch)) {
    out.success(t("sync.alreadyUpToDate", { branch: fromBranch }));
    return;
  }

  const commits = getBehindCommits(sourceBranch, fromBranch);
  out.blank();
  console.log(chalk.yellow(t("sync.newCommits", { branch: fromBranch, count: commits.length })));
  for (const c of commits) console.log(`  ${chalk.dim(c)}`);
  out.blank();

  if (!opts.yes) {
    const proceed = await confirmAction(
      opts.rebase
        ? t("sync.rebaseConfirm", { from: fromBranch, into: sourceBranch })
        : t("sync.mergeConfirm", { from: fromBranch, into: sourceBranch }),
      true
    );
    if (!proceed) { console.log(chalk.dim(t("general.aborted"))); return; }
  }

  if (opts.rebase) {
    spinner = startSpinner(t("sync.rebasing", { branch: fromBranch }));
    try {
      await rebaseAsync(fromBranch);
      succeed(spinner, t("sync.rebased", { branch: sourceBranch, from: fromBranch }));
    } catch {
      fail(spinner, t("sync.rebaseConflicts"));
      out.error(t("sync.resolveRebase"));
    }
  } else {
    spinner = startSpinner(t("sync.merging", { from: fromBranch, into: sourceBranch }));
    const result = await mergeBranch(`origin/${fromBranch}`);
    if (result.hasConflicts) {
      fail(spinner, t("sync.mergeConflicts", { count: result.conflictedFiles.length }));
      for (const f of result.conflictedFiles) console.log(`  ${chalk.red(f)}`);
      out.blank();
      console.log(chalk.yellow(t("sync.resolveMerge")));
    } else {
      succeed(spinner, t("sync.merged", { from: fromBranch, into: sourceBranch }));
    }
  }
}
