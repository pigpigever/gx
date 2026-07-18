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
import * as out from "../lib/output.js";

export function mergeCommand(): Command {
  const cmd = new Command("merge")
    .description("Safe-merge feature branch via temp branch")
    .option("--into <target>", "Target branch (default: from config or 'develop')")
    .option("-s, --source <branch>", "Source branch (default: current branch)")
    .option("--continue", "Continue after resolving conflicts")
    .option("--abort", "Abort the merge")
    .option("--dry-run", "Show what would be done")
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
    throw new Error(
      "A merge is already in progress. Run 'gx merge --continue' or 'gx merge --abort'."
    );
  }

  if (!isGhAuthenticated()) {
    throw new Error(
      "Not authenticated with GitHub. Run 'gh auth login' or set GITHUB_TOKEN."
    );
  }

  const ctx = getGitContext();
  const sourceBranch = opts.source || ctx.currentBranch;
  const targetBranch =
    opts.into || getDefaultMergeTarget(ctx.owner, ctx.repo) || "develop";

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  console.log(chalk.bold(`🎯 Target: ${chalk.yellow(targetBranch)}`));
  out.blank();

  // Validate
  if (sourceBranch === targetBranch) {
    throw new Error("Source and target branches are the same.");
  }

  if (opts.dryRun) {
    console.log(chalk.bold.cyan("[DRY RUN] Would:"));
    console.log(`  1. Fetch origin/${targetBranch}`);
    console.log(`  2. Create temp merge branch`);
    console.log(`  3. Merge ${sourceBranch} into temp branch`);
    console.log(`  4. Push temp branch`);
    console.log(`  5. Create PR: temp branch → ${targetBranch}`);
    return;
  }

  // ── Step 1: Fetch target ──
  out.step(1, 5, `Fetching latest ${targetBranch}...`);
  fetchBranch(targetBranch);
  out.success(`Fetched origin/${targetBranch}`);

  // ── Step 2: Create temp merge branch ──
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 12);
  const tempBranch = `merge/${sourceBranch.replace(/\//g, "-")}-to-${targetBranch.replace(/\//g, "-")}-${timestamp}`;

  out.step(2, 5, `Creating temp branch: ${tempBranch}`);
  createBranch(tempBranch, targetBranch);
  out.success(`Created ${tempBranch}`);

  // ── Step 3: Merge source into temp ──
  out.step(3, 5, `Merging ${sourceBranch} → ${tempBranch}`);
  const mergeResult = mergeBranch(sourceBranch);

  if (mergeResult.hasConflicts) {
    out.blank();
    console.log(
      chalk.yellow.bold(
        `  ⚠️  CONFLICTS DETECTED (${mergeResult.conflictedFiles.length} files):`
      )
    );
    out.blank();
    for (const f of mergeResult.conflictedFiles) {
      console.log(`      ${chalk.red(f)}`);
    }
    out.blank();
    console.log(chalk.dim("  ──────────────────────────────────"));
    console.log(chalk.bold("  Please resolve the conflicts in your editor."));
    out.blank();
    console.log(
      chalk.bold("  When ready:") +
        chalk.green("  gx merge --continue")
    );
    console.log(
      chalk.bold("  To cancel: ") + chalk.red("  gx merge --abort")
    );
    console.log(chalk.dim("  ──────────────────────────────────"));
    out.blank();
    return;
  }

  out.success("No conflicts — clean merge");

  // ── Step 4: Push ──
  out.step(4, 5, "Pushing temp branch...");
  pushBranch(tempBranch);
  out.success(`Pushed ${tempBranch}`);

  // ── Step 5: Create PR ──
  out.step(5, 5, "Creating PR...");
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

  out.success(`PR created: ${chalk.underline(pr.url)}`);
  out.blank();
  console.log(
    chalk.dim(`After PR #${pr.number} is merged, the temp branch can be deleted with 'gx cleanup'.`)
  );
  out.blank();
}

async function continueMerge(): Promise<void> {
  // Check we're in a valid state
  if (!isOnGxMergeBranch()) {
    throw new Error(
      "Not on a gx merge branch. Run 'gx merge' to start a new merge."
    );
  }

  if (isMergeInProgress() && !allConflictsResolved()) {
    const files = getConflictedFiles();
    throw new Error(
      `Conflicts still unresolved in ${files.length} file(s):\n  ${files.join("\n  ")}\n\nResolve all conflicts before continuing.`
    );
  }

  const tempBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();

  out.blank();
  console.log(chalk.bold("Continuing merge..."));

  // Commit any staged changes (if merge was in progress and conflicts resolved)
  if (isMergeInProgress()) {
    commitMerge();
    out.success("Committed merge resolution");
  }

  // Push
  out.step(4, 5, "Pushing temp branch...");
  pushBranch(tempBranch);
  out.success(`Pushed ${tempBranch}`);

  // Create PR
  const ctx = getGitContext();
  // Extract target from branch name: merge/feat-x-to-develop-20250718 → develop
  const targetMatch = tempBranch.match(/merge\/.+?-to-(.+?)-\d{12}$/);
  const targetBranch = targetMatch ? targetMatch[1] : "develop";

  // Extract source from branch name
  const sourceMatch = tempBranch.match(/merge\/(.+?)-to-/);
  const sourceBranch = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "unknown";

  out.step(5, 5, "Creating PR...");
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

  out.success(`PR created: ${chalk.underline(pr.url)}`);
  out.blank();
  console.log(
    chalk.dim(`After PR #${pr.number} is merged, clean up with 'gx cleanup'.`)
  );
  out.blank();
}

async function abortMerge(): Promise<void> {
  if (!isOnGxMergeBranch()) {
    throw new Error(
      "Not on a gx merge branch. Nothing to abort."
    );
  }

  const confirmed = await confirmAction(
    "Abort merge and delete the temp branch?",
    false
  );
  if (!confirmed) {
    console.log(chalk.dim("Aborted."));
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

  out.success(`Merge aborted. Deleted ${tempBranch}, back on ${sourceBranch}.`);
  out.blank();
}
