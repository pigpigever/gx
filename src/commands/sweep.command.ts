import { Command } from "commander";
import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import { execSync } from "node:child_process";
import { getGitContext, deleteLocalBranch, deleteRemoteBranch, isUserBranch } from "../lib/git.js";
import { getRepoTargets } from "../lib/config-store.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import { getPRsForBranch, type BranchPRInfo } from "../lib/github.js";
import { t } from "../lib/i18n.js";
import * as out from "../lib/output.js";

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

interface TempBranch {
  name: string;
  isLocal: boolean;
  isRemote: boolean;
}

function getTempBranches(): TempBranch[] {
  const local = exec("git branch --format='%(refname:short)'")
    .split("\n")
    .filter((b) => b.startsWith("merge/"));
  const remote = exec("git branch -r --format='%(refname:short)'")
    .split("\n")
    .filter((b) => b.startsWith("origin/merge/"))
    .map((b) => b.replace("origin/", ""));

  const names = new Set([...local, ...remote]);
  return [...names].map((name) => ({
    name,
    isLocal: local.includes(name),
    isRemote: remote.includes(name),
  }));
}

export function sweepCommand(): Command {
  const cmd = new Command("sweep")
    .description(t("sweep.description"))
    .option("--dry-run", t("sweep.optionDryRun"))
    .option("-y, --yes", t("sweep.optionYes"))
    .option("--mine", t("sweep.optionMine"))
    .action(async (opts) => {
      try { await runSweep(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}

async function runSweep(opts: any): Promise<void> {
  const ctx = getGitContext();

  out.blank();
  console.log(chalk.bold(t("sweep.title")));
  out.blank();

  const spinner = startSpinner(t("sweep.scanning"));
  const branches = getTempBranches();

  if (branches.length === 0) {
    succeed(spinner, t("sweep.noneFound"));
    return;
  }
  succeed(spinner, t("sweep.foundCount", { count: branches.length }));

  // ── Filter: only user's branches ──
  if (opts.mine) {
    const targets = getRepoTargets(ctx.owner, ctx.repo);
    if (targets.length === 0) targets.push("main");
    const filtered = branches.filter((b) => isUserBranch(b.name, targets));
    out.info(t("sweep.mineFilter", { total: branches.length, mine: filtered.length }));
    if (filtered.length === 0) return;
    branches.length = 0;
    branches.push(...filtered);
  }

  // ── Fetch PR info ──
  const prSpinner = startSpinner(t("sweep.fetchingPrs"));
  const branchPRs = new Map<string, BranchPRInfo[]>();
  for (const b of branches) {
    branchPRs.set(b.name, getPRsForBranch(ctx.owner, ctx.repo, b.name));
  }
  succeed(prSpinner, t("sweep.prsFetched"));

  out.blank();

  // ── Show branches ──
  for (const b of branches) {
    const prs = branchPRs.get(b.name) ?? [];
    const tags = [
      b.isRemote ? chalk.dim(" [remote]") : "",
    ].join("");
    console.log(`  ${chalk.red("✗")} ${chalk.bold(b.name)}${tags}`);
    for (const pr of prs) {
      const icon = prStateIcon(pr.state);
      console.log(`     ${icon} #${pr.number} ${chalk.dim(pr.title)}  ${chalk.underline(pr.url)}`);
    }
  }

  out.blank();

  if (opts.dryRun) {
    console.log(chalk.bold.cyan(`[DRY RUN] Would delete ${branches.length} temp branches.`));
    out.blank();
    return;
  }

  // ── Multi-select ──
  const choices = branches.map((b) => ({
    name: `${b.name} ${b.isRemote ? "[remote]" : ""}`,
    value: b.name,
    checked: true,
    description: branchPRs.get(b.name)?.map((p) => `#${p.number} ${p.state}`).join(", "),
  }));

  const selected = await checkbox({
    message: t("sweep.selectBranches"),
    choices,
    pageSize: 12,
    instructions: t("interactor.checkboxInstructions"),
  });

  if (selected.length === 0) {
    console.log(chalk.dim(t("general.aborted")));
    return;
  }

  if (!opts.yes) {
    const proceed = await checkbox({
      message: t("sweep.confirmDelete", { count: selected.length }),
      choices: [{ name: t("general.proceed"), value: "yes" }],
    });
    if (proceed.length === 0) { console.log(chalk.dim(t("general.aborted"))); return; }
  }

  out.blank();

  // ── Delete ──
  const selectedSet = new Set(selected);
  const toDelete = branches.filter((b) => selectedSet.has(b.name));

  const remotes = Array.from(new Set(toDelete.filter((b) => b.isRemote).map((b) => b.name)));
  for (const name of remotes) {
    const s = startSpinner(t("sweep.deletingRemote", { name }));
    try { deleteRemoteBranch(name); succeed(s, t("sweep.deletedRemote", { name })); }
    catch { fail(s, t("sweep.deleteRemoteFailed", { name })); }
  }

  for (const b of toDelete.filter((b) => b.isLocal)) {
    if (b.name === ctx.currentBranch) { out.warning(t("sweep.skippingCurrent", { name: b.name })); continue; }
    const s = startSpinner(t("sweep.deletingLocal", { name: b.name }));
    try { deleteLocalBranch(b.name); succeed(s, t("sweep.deletedLocal", { name: b.name })); }
    catch { fail(s, t("sweep.deleteLocalFailed", { name: b.name })); }
  }

  out.blank();
  out.success(t("sweep.complete"));
  out.blank();
}

function prStateIcon(state: string): string {
  switch (state) {
    case "MERGED": return chalk.magenta("◆");
    case "OPEN": return chalk.green("●");
    case "CLOSED": return chalk.red("✗");
    default: return chalk.dim("?");
  }
}
