import { Command } from "commander";
import { execSync } from "node:child_process";
import chalk from "chalk";
import {
  getGitContext,
  fetchBranch,
  createBranch,
  checkoutBranch,
  mergeBranch,
  pushBranch,
  deleteLocalBranch,
  commitMerge,
  isMergeInProgress,
  getConflictedFiles,
  isOnGxMergeBranch,
  allConflictsResolved,
} from "../lib/git.js";
import { getDefaultMergeTarget } from "../lib/config-store.js";
import { createPR, isGhAuthenticated } from "../lib/github.js";
import { confirmAction } from "../lib/interactor.js";
import { branchToTitle, generateBody } from "../lib/formatter.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import { t } from "../lib/i18n.js";
import * as out from "../lib/output.js";

export function mergeCommand(): Command {
  const cmd = new Command("merge")
    .description(t("merge.description"))
    .option("--into <target>", t("merge.optionInto"))
    .option("-s, --source <branch>", t("merge.optionSource"))
    .option("--continue", t("merge.optionContinue"))
    .option("--abort", t("merge.optionAbort"))
    .option("--dry-run", t("merge.optionDryRun"))
    .action(async (opts) => {
      try {
        if (opts.continue) {
          await continueMerge();
        } else if (opts.abort) {
          await abortMerge();
        } else {
          await runMerge(opts);
        }
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runMerge(opts: any): Promise<void> {
  // ── Pre-flight ──
  if (isMergeInProgress()) {
    throw new Error(t("merge.inProgress"));
  }

  if (!isGhAuthenticated()) {
    throw new Error(t("pr.authError"));
  }

  const ctx = getGitContext();
  const sourceBranch = opts.source || ctx.currentBranch;
  const targetBranch =
    opts.into || getDefaultMergeTarget(ctx.owner, ctx.repo) || "develop";

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  console.log(chalk.bold(`🎯 ${t("merge.targetLabel", { branch: targetBranch })}`));
  out.blank();

  // Validate
  if (sourceBranch === targetBranch) {
    throw new Error(t("merge.sameBranch"));
  }

  if (opts.dryRun) {
    console.log(chalk.bold.cyan(`${t("general.dryRunPrefix")} ${t("merge.dryRunWould")}`));
    console.log(`  1. ${t("merge.dryRunStep1", { branch: targetBranch })}`);
    console.log(`  2. ${t("merge.dryRunStep2")}`);
    console.log(`  3. ${t("merge.dryRunStep3", { source: sourceBranch })}`);
    console.log(`  4. ${t("merge.dryRunStep4")}`);
    console.log(`  5. ${t("merge.dryRunStep5", { target: targetBranch })}`);
    return;
  }

  // ── Step 1: Fetch target ──
  let spinner = startSpinner(t("merge.fetching", { branch: targetBranch }));
  fetchBranch(targetBranch);
  succeed(spinner, t("merge.fetched", { branch: targetBranch }));

  // ── Step 2: Create temp merge branch ──
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const tempBranch = `merge/${sourceBranch.replace(/\//g, "-")}-to-${targetBranch.replace(/\//g, "-")}-${timestamp}`;

  spinner = startSpinner(t("merge.creatingTemp", { name: tempBranch }));
  createBranch(tempBranch, targetBranch);
  succeed(spinner, t("merge.createdTemp", { name: chalk.cyan(tempBranch) }));

  // ── Step 3: Merge source into temp ──
  spinner = startSpinner(t("merge.merging", { source: sourceBranch, temp: tempBranch }));
  const mergeResult = mergeBranch(sourceBranch);

  if (mergeResult.hasConflicts) {
    fail(spinner, t("merge.conflicts", { count: mergeResult.conflictedFiles.length }));
    out.blank();
    console.log(
      chalk.yellow.bold(
        `  ⚠️  ${t("merge.conflictsHeader", { count: mergeResult.conflictedFiles.length })}`
      )
    );
    out.blank();
    for (const f of mergeResult.conflictedFiles) {
      console.log(`      ${chalk.red(f)}`);
    }
    out.blank();
    console.log(chalk.dim("  ──────────────────────────────────"));
    console.log(chalk.bold(`  ${t("merge.resolvePrompt")}`));
    out.blank();
    console.log(
      chalk.bold(`  ${t("merge.whenReady")} `) +
        chalk.green(` ${t("merge.continueCmd")}`)
    );
    console.log(
      chalk.bold(`  ${t("merge.toCancel")} `) + chalk.red(` ${t("merge.abortCmd")}`)
    );
    console.log(chalk.dim("  ──────────────────────────────────"));
    out.blank();
    return;
  }

  succeed(spinner, t("merge.mergedClean"));

  // ── Step 4: Push ──
  spinner = startSpinner(t("merge.pushing"));
  pushBranch(tempBranch);
  succeed(spinner, t("merge.pushed", { name: chalk.cyan(tempBranch) }));

  // ── Step 5: Create PR ──
  spinner = startSpinner(t("merge.creatingPr"));
  const title = branchToTitle(sourceBranch);
  const body = generateBody(sourceBranch, targetBranch);

  const pr = createPR({
    owner: ctx.owner,
    repo: ctx.repo,
    head: tempBranch,
    base: targetBranch,
    title,
    body: `Merges \`${sourceBranch}\` into \`${targetBranch}\`\n\n${body}`,
    draft: false,
  });

  succeed(spinner, t("merge.prCreated", { url: pr.url }));
  out.blank();
  console.log(
    chalk.dim(t("merge.afterMergeNote", { number: pr.number }))
  );
  out.blank();
}

async function continueMerge(): Promise<void> {
  if (!isOnGxMergeBranch()) {
    throw new Error(t("merge.notOnMergeBranch"));
  }

  if (isMergeInProgress() && !allConflictsResolved()) {
    const files = getConflictedFiles();
    throw new Error(
      t("merge.conflictsUnresolved", { count: files.length, files: files.join("\n  ") })
    );
  }

  const tempBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();

  out.blank();
  console.log(chalk.bold(t("merge.continuing")));

  if (isMergeInProgress()) {
    const s = startSpinner(t("merge.committingResolution"));
    commitMerge();
    succeed(s, t("merge.committedResolution"));
  }

  let s = startSpinner(t("merge.pushing"));
  pushBranch(tempBranch);
  succeed(s, t("merge.pushed", { name: chalk.cyan(tempBranch) }));

  const ctx = getGitContext();
  const targetMatch = tempBranch.match(/merge\/.+?-to-(.+?)-[\dT]{10,13}$/);
  const targetBranch = targetMatch ? targetMatch[1] : "develop";
  const sourceMatch = tempBranch.match(/merge\/(.+?)-to-/);
  const sourceBranch = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "unknown";

  s = startSpinner(t("merge.creatingPr"));
  const title = branchToTitle(sourceBranch);
  const body = generateBody(sourceBranch, targetBranch);

  const pr = createPR({
    owner: ctx.owner,
    repo: ctx.repo,
    head: tempBranch,
    base: targetBranch,
    title,
    body: `Merges \`${sourceBranch}\` into \`${targetBranch}\`\n\n${body}`,
    draft: false,
  });

  succeed(s, t("merge.prCreated", { url: pr.url }));
  out.blank();
  console.log(
    chalk.dim(t("cleanup.afterCleanupNote", { number: pr.number }))
  );
  out.blank();
}

async function abortMerge(): Promise<void> {
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
