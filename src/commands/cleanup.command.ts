import { Command } from "commander";
import chalk from "chalk";
import {
  getGitContext,
  getMergedBranches,
  deleteLocalBranch,
  deleteRemoteBranch,
} from "../lib/git.js";
import { getRepoTargets } from "../lib/config-store.js";
import { confirmAction } from "../lib/interactor.js";
import * as out from "../lib/output.js";

export function cleanupCommand(): Command {
  const cmd = new Command("cleanup")
    .description("Delete branches that have been merged into target branches")
    .option("--dry-run", "Show what would be deleted without deleting")
    .option("-y, --yes", "Skip confirmation")
    .action(async (opts) => {
      try {
        await runCleanup(opts);
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runCleanup(opts: any): Promise<void> {
  const ctx = getGitContext();

  // Get targets from config or default to common branches.
  let targets = getRepoTargets(ctx.owner, ctx.repo);
  if (targets.length === 0) {
    targets = ["main", "master", "develop"];
  }

  out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);
  out.blank();

  console.log(chalk.dim(`Checking branches merged into: ${targets.join(", ")}...`));
  out.blank();

  const branches = getMergedBranches(targets);

  if (branches.length === 0) {
    out.success("No merged branches found to clean up.");
    return;
  }

  console.log(chalk.bold("Merged branches (safe to delete):"));
  out.blank();

  for (const b of branches) {
    const gxTag = b.isGxTemp ? chalk.yellow(" [gx temp]") : "";
    const localTag = b.isLocal ? "" : chalk.dim(" [remote only]");
    const remoteTag = b.isRemote ? chalk.dim(" [remote]") : "";
    console.log(
      `  ${chalk.red("✗")} ${chalk.bold(b.name)} → ${chalk.dim(b.mergedInto)}${gxTag}${localTag}${remoteTag}`
    );
  }

  out.blank();

  if (opts.dryRun) {
    console.log(
      chalk.bold.cyan(`[DRY RUN] Would delete ${branches.length} branches.`)
    );
    out.blank();
    return;
  }

  const localOnly = branches.filter((b) => b.isLocal);
  const remoteOnly = branches.filter((b) => b.isRemote);

  const proceed = opts.yes || (await confirmAction(
    `Delete ${localOnly.length} local and ${remoteOnly.length} remote branches?`,
    false
  ));

  if (!proceed) {
    console.log(chalk.dim("Aborted."));
    return;
  }

  out.blank();

  // Delete remote first, then local
  const uniqueRemotes = Array.from(new Set(remoteOnly.map((b) => b.name)));
  for (const name of uniqueRemotes) {
    try {
      deleteRemoteBranch(name);
      out.success(`Deleted remote: ${name}`);
    } catch {
      out.warning(`Failed to delete remote: ${name}`);
    }
  }

  // Don't delete current branch
  for (const b of localOnly) {
    if (b.name === ctx.currentBranch) {
      out.warning(`Skipping current branch: ${b.name}`);
      continue;
    }
    try {
      deleteLocalBranch(b.name);
      out.success(`Deleted local: ${b.name}`);
    } catch {
      out.warning(`Failed to delete local: ${b.name}`);
    }
  }

  out.blank();
  out.success("Cleanup complete.");
  out.blank();
}
