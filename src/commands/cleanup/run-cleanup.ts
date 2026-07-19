import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import { getGitContext, getMergedBranches, deleteLocalBranch, deleteRemoteBranch, isUserBranch } from "@/lib/git.js";
import { getRepoTargets } from "@/lib/config-store.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { confirmAction } from "@/lib/interactor.js";
import { getPRsForBranch, type BranchPRInfo } from "@/lib/github.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { prStateIcon } from "@/commands/shared/pr-icons.js";

export async function runCleanup(opts: any): Promise<void> {
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

  // ── Filter: only user's branches ──
  if (opts.mine || (!opts.yes && await confirmAction(t("cleanup.filterMinePrompt"), false))) {
    const filtered = branches.filter((b) => isUserBranch(b.name, targets));
    out.info(t("cleanup.mineFilter", { total: branches.length, mine: filtered.length }));
    if (filtered.length === 0) return;
    branches.length = 0;
    branches.push(...filtered);
  }

  // ── Fetch PR info for each branch ──
  const prSpinner = startSpinner(t("cleanup.fetchingPrs"));
  const branchPRs = new Map<string, BranchPRInfo[]>();
  for (const b of branches) {
    branchPRs.set(b.name, getPRsForBranch(ctx.owner, ctx.repo, b.name));
  }
  succeed(prSpinner, t("cleanup.prsFetched"));

  out.blank();

  // ── Show branches with PR info ──
  console.log(chalk.bold(t("cleanup.mergedHeader")));
  out.blank();

  for (const b of branches) {
    const prs = branchPRs.get(b.name) ?? [];
    const tags = [
      b.isGxTemp ? chalk.yellow(t("cleanup.tagGx")) : "",
      b.isRemote ? chalk.dim(t("cleanup.tagRemote")) : "",
    ].join("");
    console.log(`  ${chalk.red("✗")} ${chalk.bold(b.name)} → ${chalk.dim(b.mergedInto)}${tags}`);
    for (const pr of prs) {
      const stateIcon = prStateIcon(pr.state);
      console.log(`     ${stateIcon} #${pr.number} ${chalk.dim(pr.title)}  ${chalk.underline(pr.url)}`);
    }
    if (prs.length === 0 && !b.isGxTemp) {
      console.log(`     ${chalk.dim(t("cleanup.noPr"))}`);
    }
  }

  out.blank();

  if (opts.dryRun) {
    console.log(chalk.bold.cyan(`${t("general.dryRunPrefix")} ${t("cleanup.dryRunWouldDelete", { count: branches.length })}`));
    out.blank();
    return;
  }

  // ── Multi-select which branches to delete ──
  const choices = branches.map((b) => ({
    name: `${b.name} ${b.isRemote ? t("cleanup.tagRemote") : ""}`,
    value: b.name,
    checked: true,
    description: branchPRs.get(b.name)?.map((p) => `#${p.number} ${p.state}`).join(", "),
  }));

  const selected = await checkbox({
    message: t("cleanup.selectBranches"),
    choices,
    pageSize: 12,
    instructions: t("interactor.checkboxInstructions"),
  });

  if (selected.length === 0) {
    console.log(chalk.dim(t("general.aborted")));
    return;
  }

  if (!opts.yes) {
    out.blank();
    const proceed = await checkbox({
      message: t("cleanup.confirmDelete", { count: selected.length }),
      choices: [{ name: t("general.proceed"), value: "yes" }],
    });
    if (proceed.length === 0) { console.log(chalk.dim(t("general.aborted"))); return; }
  }

  out.blank();

  // ── Delete selected branches ──
  const selectedSet = new Set(selected);
  const toDelete = branches.filter((b) => selectedSet.has(b.name));

  const uniqueRemotes = Array.from(new Set(
    toDelete.filter((b) => b.isRemote).map((b) => b.name)
  ));
  for (const name of uniqueRemotes) {
    const s = startSpinner(t("cleanup.deletingRemote", { name }));
    try { deleteRemoteBranch(name); succeed(s, t("cleanup.deletedRemote", { name })); }
    catch { fail(s, t("cleanup.deleteRemoteFailed", { name })); }
  }

  for (const b of toDelete.filter((b) => b.isLocal)) {
    if (b.name === ctx.currentBranch) { out.warning(t("cleanup.skippingCurrent", { name: b.name })); continue; }
    const s = startSpinner(t("cleanup.deletingLocal", { name: b.name }));
    try { deleteLocalBranch(b.name); succeed(s, t("cleanup.deletedLocal", { name: b.name })); }
    catch { fail(s, t("cleanup.deleteLocalFailed", { name: b.name })); }
  }

  out.blank();
  out.success(t("cleanup.complete"));
  out.blank();
}
