import { Command } from "commander";
import chalk from "chalk";
import { getGitContext, getMergedBranches, deleteLocalBranch, deleteRemoteBranch } from "../lib/git.js";
import { getRepoTargets } from "../lib/config-store.js";
import { confirmAction } from "../lib/interactor.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import { t } from "../lib/i18n.js";
import * as out from "../lib/output.js";

export function cleanupCommand(): Command {
  const cmd = new Command("cleanup")
    .description(t("cleanup.description"))
    .option("--dry-run", t("cleanup.optionDryRun"))
    .option("-y, --yes", t("cleanup.optionYes"))
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

  const spinner = startSpinner(t("cleanup.scanning", { targets: targets.join(", ") }));
  const branches = getMergedBranches(targets);

  if (branches.length === 0) {
    succeed(spinner, t("cleanup.noMerged"));
    return;
  }
  succeed(spinner, t("cleanup.foundMerged", { count: branches.length }));

  out.blank();
  console.log(chalk.bold(t("cleanup.mergedHeader")));
  out.blank();

  for (const b of branches) {
    const tags = [
      b.isGxTemp ? chalk.yellow(t("cleanup.tagGx")) : "",
      b.isRemote ? chalk.dim(t("cleanup.tagRemote")) : "",
    ].join("");
    console.log(`  ${chalk.red("✗")} ${chalk.bold(b.name)} → ${chalk.dim(b.mergedInto)}${tags}`);
  }

  out.blank();

  if (opts.dryRun) {
    console.log(chalk.bold.cyan(`${t("general.dryRunPrefix")} ${t("cleanup.dryRunWouldDelete", { count: branches.length })}`));
    out.blank();
    return;
  }

  const localOnly = branches.filter((b) => b.isLocal);
  const remoteOnly = branches.filter((b) => b.isRemote);

  if (!opts.yes) {
    const proceed = await confirmAction(
      t("cleanup.deleteConfirm", { local: localOnly.length, remote: remoteOnly.length }),
      false
    );
    if (!proceed) { console.log(chalk.dim(t("general.aborted"))); return; }
  }

  out.blank();

  const uniqueRemotes = Array.from(new Set(remoteOnly.map((b) => b.name)));
  for (const name of uniqueRemotes) {
    const s = startSpinner(t("cleanup.deletingRemote", { name }));
    try { deleteRemoteBranch(name); succeed(s, t("cleanup.deletedRemote", { name })); }
    catch { fail(s, t("cleanup.deleteRemoteFailed", { name })); }
  }

  for (const b of localOnly) {
    if (b.name === ctx.currentBranch) { out.warning(t("cleanup.skippingCurrent", { name: b.name })); continue; }
    const s = startSpinner(t("cleanup.deletingLocal", { name: b.name }));
    try { deleteLocalBranch(b.name); succeed(s, t("cleanup.deletedLocal", { name: b.name })); }
    catch { fail(s, t("cleanup.deleteLocalFailed", { name: b.name })); }
  }

  out.blank();
  out.success(t("cleanup.complete"));
  out.blank();
}
