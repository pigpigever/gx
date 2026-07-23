import chalk from "chalk";
import {
  getGitContext,
  fetchBranch,
  createBranch,
  mergeBranch,
  pushBranch,
  isMergeInProgress,
} from "@/lib/git.js";
import { getDefaultMergeTarget } from "@/lib/config-store.js";
import { createPR, isGhAuthenticated } from "@/lib/github.js";
import { generateBody, getPrTitle } from "@/lib/formatter.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";

export async function runMerge(opts: any): Promise<void> {
  // ── Pre-flight ──
  if (isMergeInProgress()) {
    throw new Error(t("merge.inProgress"));
  }

  if (!await isGhAuthenticated()) {
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
  await fetchBranch(targetBranch);
  succeed(spinner, t("merge.fetched", { branch: targetBranch }));

  // ── Step 2: Create temp merge branch ──
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 12);
  const tempBranch = `merge/${sourceBranch.replace(/\//g, "-")}-to-${targetBranch.replace(/\//g, "-")}-${timestamp}`;

  spinner = startSpinner(t("merge.creatingTemp", { name: tempBranch }));
  await createBranch(tempBranch, targetBranch);
  succeed(spinner, t("merge.createdTemp", { name: chalk.cyan(tempBranch) }));

  // ── Step 3: Merge source into temp ──
  spinner = startSpinner(t("merge.merging", { source: sourceBranch, temp: tempBranch }));
  const mergeResult = await mergeBranch(sourceBranch);

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
  await pushBranch(tempBranch);
  succeed(spinner, t("merge.pushed", { name: chalk.cyan(tempBranch) }));

  // ── Step 5: Create PR ──
  spinner = startSpinner(t("merge.creatingPr"));
  const title = await getPrTitle(sourceBranch);
  const body = await generateBody(sourceBranch, targetBranch);

  const pr = await createPR({
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
