import { Command } from "commander";
import chalk from "chalk";
import { getGitContext, getMergedBranches, deleteLocalBranch, deleteRemoteBranch } from "../lib/git.js";
import { getRepoTargets } from "../lib/config-store.js";
import { confirmAction } from "../lib/interactor.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import * as out from "../lib/output.js";

export function cleanupCommand(): Command {
  const cmd = new Command("cleanup")
    .description("Delete branches that have been merged into target branches")
    .option("--dry-run", "Show what would be deleted without deleting")
    .option("-y, --yes", "Skip confirmation")
    .action(async (opts) => {
      try { await runCleanup(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}

async function runCleanup(opts: any): Promise<void> {
  const ctx = getGitContext();
  let targets = getRepoTargets(ctx.owner, ctx.repo);
  if (targets.length === 0) targets = ["main", "master", "develop"];

  out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);
  out.blank();

  const spinner = startSpinner(`Scanning branches merged into ${targets.join(", ")}`);
  const branches = getMergedBranches(targets);

  if (branches.length === 0) {
    succeed(spinner, "No merged branches found");
    return;
  }
  succeed(spinner, `Found ${branches.length} merged branches`);

  out.blank();
  console.log(chalk.bold("Merged branches (safe to delete):"));
  out.blank();

  for (const b of branches) {
    const tags = [
      b.isGxTemp ? chalk.yellow(" [gx]") : "",
      b.isRemote ? chalk.dim(" [remote]") : "",
    ].join("");
    console.log(`  ${chalk.red("✗")} ${chalk.bold(b.name)} → ${chalk.dim(b.mergedInto)}${tags}`);
  }

  out.blank();

  if (opts.dryRun) {
    console.log(chalk.bold.cyan(`[DRY RUN] Would delete ${branches.length} branches.`));
    out.blank();
    return;
  }

  const localOnly = branches.filter((b) => b.isLocal);
  const remoteOnly = branches.filter((b) => b.isRemote);

  if (!opts.yes) {
    const proceed = await confirmAction(
      `Delete ${localOnly.length} local and ${remoteOnly.length} remote branches?`, false
    );
    if (!proceed) { console.log(chalk.dim("Aborted.")); return; }
  }

  out.blank();

  const uniqueRemotes = Array.from(new Set(remoteOnly.map((b) => b.name)));
  for (const name of uniqueRemotes) {
    const s = startSpinner(`Deleting remote: ${name}`);
    try { deleteRemoteBranch(name); succeed(s, `Deleted remote: ${name}`); }
    catch { fail(s, `Failed to delete remote: ${name}`); }
  }

  for (const b of localOnly) {
    if (b.name === ctx.currentBranch) { out.warning(`Skipping current branch: ${b.name}`); continue; }
    const s = startSpinner(`Deleting local: ${b.name}`);
    try { deleteLocalBranch(b.name); succeed(s, `Deleted local: ${b.name}`); }
    catch { fail(s, `Failed to delete local: ${b.name}`); }
  }

  out.blank();
  out.success("Cleanup complete.");
  out.blank();
}
