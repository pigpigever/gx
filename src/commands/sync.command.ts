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
import * as out from "../lib/output.js";

export function syncCommand(): Command {
  const cmd = new Command("sync")
    .description("Sync current branch with its base target branch")
    .option("--from <branch>", "Branch to sync from (default: from config or 'develop')")
    .option("--rebase", "Use rebase instead of merge")
    .option("-y, --yes", "Skip confirmation")
    .action(async (opts) => {
      try {
        await runSync(opts);
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runSync(opts: any): Promise<void> {
  const ctx = getGitContext();
  const sourceBranch = ctx.currentBranch;
  const fromBranch =
    opts.from || getDefaultMergeTarget(ctx.owner, ctx.repo) || "develop";

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  console.log(chalk.bold(`🎯 Syncing from: ${chalk.yellow(fromBranch)}`));
  out.blank();

  // Fetch
  console.log(chalk.dim("Fetching latest..."));
  fetchBranch(fromBranch);
  out.success(`Fetched origin/${fromBranch}`);

  // Check if behind
  if (!isBehindRemote(sourceBranch, fromBranch)) {
    out.success(`Already up to date with origin/${fromBranch}`);
    return;
  }

  // Show what's new
  const commits = getBehindCommits(sourceBranch, fromBranch);
  out.blank();
  console.log(
    chalk.yellow(
      `New commits on origin/${fromBranch} (${commits.length}):`
    )
  );
  for (const c of commits) {
    console.log(`  ${chalk.dim(c)}`);
  }
  out.blank();

  // Confirm
  if (!opts.yes) {
    const proceed = await confirmAction(
      `${opts.rebase ? "Rebase" : "Merge"} origin/${fromBranch} into ${sourceBranch}?`,
      true
    );
    if (!proceed) {
      console.log(chalk.dim("Aborted."));
      return;
    }
  }

  // Merge or rebase
  if (opts.rebase) {
    console.log(chalk.dim(`Rebasing onto origin/${fromBranch}...`));
    try {
      execSync(`git rebase origin/${fromBranch}`, { stdio: "inherit" });
      out.success(`Rebased ${sourceBranch} onto origin/${fromBranch}`);
    } catch {
      out.error(
        "Rebase conflicts detected. Resolve conflicts, then run 'git rebase --continue'."
      );
    }
  } else {
    console.log(chalk.dim(`Merging origin/${fromBranch} into ${sourceBranch}...`));
    const result = mergeBranch(`origin/${fromBranch}`);
    if (result.hasConflicts) {
      out.error(
        `Merge conflicts in ${result.conflictedFiles.length} file(s):`
      );
      for (const f of result.conflictedFiles) {
        console.log(`  ${chalk.red(f)}`);
      }
      out.blank();
      console.log(
        chalk.yellow("Resolve conflicts, then commit. Run 'gx sync' again to verify.")
      );
    } else {
      out.success(`Merged origin/${fromBranch} into ${sourceBranch}`);
    }
  }
}
