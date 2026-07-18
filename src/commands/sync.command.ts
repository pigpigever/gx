import { Command } from "commander";
import { execSync } from "node:child_process";
import chalk from "chalk";
import {
  getGitContext,
  fetchBranch,
  mergeBranch,
  isBehindRemote,
  getBehindCommits,
} from "../lib/git.js";
import { getDefaultMergeTarget } from "../lib/config-store.js";
import { confirmAction } from "../lib/interactor.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import * as out from "../lib/output.js";

export function syncCommand(): Command {
  const cmd = new Command("sync")
    .description("Sync current branch with its base target branch")
    .option("--from <branch>", "Branch to sync from (default: from config or 'develop')")
    .option("--rebase", "Use rebase instead of merge")
    .option("-y, --yes", "Skip confirmation")
    .action(async (opts) => {
      try { await runSync(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}

async function runSync(opts: any): Promise<void> {
  const ctx = getGitContext();
  const sourceBranch = ctx.currentBranch;
  const fromBranch = opts.from || getDefaultMergeTarget(ctx.owner, ctx.repo) || "develop";

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  console.log(chalk.bold(`🎯 Syncing from: ${chalk.yellow(fromBranch)}`));
  out.blank();

  let spinner = startSpinner(`Fetching origin/${fromBranch}`);
  fetchBranch(fromBranch);
  succeed(spinner, `Fetched origin/${fromBranch}`);

  if (!isBehindRemote(sourceBranch, fromBranch)) {
    out.success(`Already up to date with origin/${fromBranch}`);
    return;
  }

  const commits = getBehindCommits(sourceBranch, fromBranch);
  out.blank();
  console.log(chalk.yellow(`New commits on origin/${fromBranch} (${commits.length}):`));
  for (const c of commits) console.log(`  ${chalk.dim(c)}`);
  out.blank();

  if (!opts.yes) {
    const proceed = await confirmAction(
      `${opts.rebase ? "Rebase" : "Merge"} origin/${fromBranch} into ${sourceBranch}?`, true
    );
    if (!proceed) { console.log(chalk.dim("Aborted.")); return; }
  }

  if (opts.rebase) {
    spinner = startSpinner(`Rebasing onto origin/${fromBranch}`);
    try {
      execSync(`git rebase origin/${fromBranch}`, { stdio: "pipe" });
      succeed(spinner, `Rebased ${sourceBranch} onto origin/${fromBranch}`);
    } catch {
      fail(spinner, "Rebase conflicts detected");
      out.error("Resolve conflicts, then run 'git rebase --continue'.");
    }
  } else {
    spinner = startSpinner(`Merging origin/${fromBranch} into ${sourceBranch}`);
    const result = mergeBranch(`origin/${fromBranch}`);
    if (result.hasConflicts) {
      fail(spinner, `${result.conflictedFiles.length} conflict(s)`);
      for (const f of result.conflictedFiles) console.log(`  ${chalk.red(f)}`);
      out.blank();
      console.log(chalk.yellow("Resolve conflicts, then commit. Run 'gx sync' again to verify."));
    } else {
      succeed(spinner, `Merged origin/${fromBranch} into ${sourceBranch}`);
    }
  }
}
