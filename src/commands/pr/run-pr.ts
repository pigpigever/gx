import chalk from "chalk";
import {
  getGitContext,
  getRemoteBranches,
  hasUnpushedCommits,
  branchExistsOnRemote,
  hasDiff,
  checkoutBranch,
  fetchAll,
} from "@/lib/git.js";
import {
  setTargets,
  getRepoConfig,
} from "@/lib/config-store.js";
import { isGhAuthenticated, checkExistingPR, createPR, checkPRConflicts } from "@/lib/github.js";
import { selectTargets, promptForConfig, confirmAction, selectSourceBranch } from "@/lib/interactor.js";
import { generateBody, getPrTitle } from "@/lib/formatter.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import type { PRResult } from "@/types.js";
import * as out from "@/lib/output.js";

export async function runPr(opts: any): Promise<void> {
  const ctx = getGitContext();
  let sourceBranch = opts.branch || ctx.currentBranch;

  // If no explicit --branch and current is a target, let user pick a source
  const repoConfig = getRepoConfig(ctx.owner, ctx.repo);
  const configuredTargets = repoConfig?.targets ?? [];

  if (!opts.branch && configuredTargets.includes(sourceBranch)) {
    out.blank();
    console.log(chalk.dim(t("pr.onTargetBranch", { branch: sourceBranch })));
    const remoteBranches = getRemoteBranches()
      .filter((b) => !configuredTargets.includes(b) && b !== "HEAD");
    if (remoteBranches.length === 0) {
      throw new Error(t("pr.noSourceBranches"));
    }
    out.blank();
    sourceBranch = await selectSourceBranch(remoteBranches);

    const checkoutSpinner = startSpinner(t("pr.checkingOut", { branch: sourceBranch }));
    try {
      checkoutBranch(sourceBranch);
      succeed(checkoutSpinner, t("pr.checkedOut", { branch: sourceBranch }));
    } catch {
      fail(checkoutSpinner, t("pr.checkoutFailed", { branch: sourceBranch }));
      throw new Error(t("pr.checkoutFailed", { branch: sourceBranch }));
    }
  }

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  out.blank();

  // ── Pre-flight checks ──
  const spinner = startSpinner(t("pr.preflight"));

  if (!isGhAuthenticated()) {
    fail(spinner, t("pr.preflightFailed"));
    throw new Error(t("pr.authError"));
  }

  if (configuredTargets.includes(sourceBranch)) {
    fail(spinner, t("pr.invalidSource"));
    throw new Error(t("pr.sourceIsTarget", { source: sourceBranch }));
  }

  if (hasUnpushedCommits(sourceBranch)) {
    succeed(spinner, t("pr.preflightUnpushed"));
  } else {
    succeed(spinner, t("pr.preflightPassed"));
  }

  if (hasUnpushedCommits(sourceBranch)) {
    if (!opts.yes) {
      const proceed = await confirmAction(
        t("pr.unpushedConfirm", { branch: sourceBranch }),
        false
      );
      if (!proceed) {
        console.log(chalk.dim(t("general.aborted")));
        return;
      }
    } else {
      out.warning(t("pr.unpushedWarn", { branch: sourceBranch }));
    }
  }

  // ── Determine targets ──
  let targets: string[];
  fetchAll();

  if (opts.targets) {
    targets = opts.targets.split(",").map((t: string) => t.trim()).filter(Boolean);
    out.info(t("pr.usingCliTargets", { targets: targets.join(", ") }));
  } else if (configuredTargets.length === 0) {
    out.warning(t("pr.noTargets"));
    const remoteBranches = getRemoteBranches().filter((b) => b !== sourceBranch);

    if (remoteBranches.length === 0) {
      throw new Error(t("pr.noRemoteBranches"));
    }

    const save = await confirmAction(t("pr.setupConfig"), true);

    if (save) {
      out.blank();
      const selected = await promptForConfig(remoteBranches);
      if (selected.length > 0) {
        setTargets(ctx.owner, ctx.repo, selected);
        out.success(t("pr.savedTargets", { count: selected.length }));
        targets = selected;
      } else {
        console.log(chalk.yellow(t("pr.noTargetsSelected")));
        return;
      }
    } else {
      targets = await selectTargets(remoteBranches);
    }
  } else if (opts.all) {
    targets = configuredTargets;
    out.info(t("pr.usingAllTargets", { targets: targets.join(", ") }));
  } else {
    out.blank();
    const hints = new Map<string, string>();
    const hintSpinner = startSpinner(t("pr.checkingTargets"));
    for (const branch of configuredTargets) {
      const existing = checkExistingPR(ctx.owner, ctx.repo, sourceBranch, branch);
      if (existing) {
        hints.set(branch, t("pr.existingPrHint", { number: existing.number }));
      } else if (!branchExistsOnRemote(branch)) {
        hints.set(branch, chalk.red(t("pr.notFoundHint")));
      } else if (!hasDiff(sourceBranch, branch)) {
        hints.set(branch, t("pr.noDiffHint"));
      } else {
        hints.set(branch, t("pr.readyHint"));
      }
    }
    succeed(hintSpinner, t("pr.targetsChecked"));
    targets = await selectTargets(configuredTargets, hints);
  }

  if (targets.length === 0) {
    console.log(chalk.yellow(`\n${t("pr.noTargetsChosen")}`));
    return;
  }

  // ── Validate targets ──
  const validTargets: string[] = [];
  const skippedTargets: PRResult[] = [];

  for (const target of targets) {
    if (!branchExistsOnRemote(target)) {
      out.warning(`${target} — ${t("pr.branchNotFoundSkip")}, skipping`);
      skippedTargets.push({
        target,
        status: "skipped",
        url: "",
        number: null,
        error: t("pr.branchNotFoundSkip"),
      });
    } else {
      validTargets.push(target);
    }
  }

  if (validTargets.length === 0) {
    out.printPRResults(skippedTargets);
    return;
  }

  // ── Dry run ──
  if (opts.dryRun) {
    out.blank();
    console.log(chalk.bold.cyan(`${t("general.dryRunPrefix")} ${t("pr.dryRunWouldCreate")}`));
    out.blank();
    for (const target of validTargets) {
      const title = opts.title || getPrTitle(sourceBranch);
      console.log(
        `  ${chalk.dim("→")} ${chalk.bold(sourceBranch)} ${chalk.dim("→")} ${chalk.bold(target)}  "${title}"`
      );
    }
    out.blank();
    console.log(chalk.dim(t("general.totalPrs", { count: validTargets.length })));
    return;
  }

  // ── Confirm ──
  if (!opts.yes) {
    out.blank();
    console.log(chalk.bold(t("pr.readyToCreate", { count: validTargets.length })));
    for (const target of validTargets) {
      console.log(`  ${chalk.dim("→")} ${sourceBranch} → ${target}`);
    }
    out.blank();
    const proceed = await confirmAction(t("general.proceed"), true);
    if (!proceed) {
      console.log(chalk.dim(t("general.aborted")));
      return;
    }
  }

  // ── Create PRs in parallel with spinner ──
  const createSpinner = startSpinner(t("pr.creating", { count: validTargets.length }));

  const results: PRResult[] = [...skippedTargets];

  const prPromises = validTargets.map(async (target): Promise<PRResult> => {
    const existing = checkExistingPR(ctx.owner, ctx.repo, sourceBranch, target);
    if (existing) {
      return {
        target,
        status: "skipped",
        url: existing.url,
        number: existing.number,
        error: `${t("pr.existingPrHint", { number: existing.number })}`,
      };
    }

    try {
      const title = opts.title || getPrTitle(sourceBranch);
      const body = opts.body || generateBody(sourceBranch, target);
      const created = createPR({
        owner: ctx.owner,
        repo: ctx.repo,
        head: sourceBranch,
        base: target,
        title,
        body,
        draft: opts.draft || false,
      });
      return { target, status: "created", url: created.url, number: created.number, error: "" };
    } catch (err: any) {
      return { target, status: "error", url: "", number: null, error: err.message };
    }
  });

  const prResults = await Promise.all(prPromises);
  results.push(...prResults);

  const created = prResults.filter((r) => r.status === "created").length;
  const skipped = prResults.filter((r) => r.status === "skipped").length;
  const errors = prResults.filter((r) => r.status === "error").length;

  if (errors > 0) {
    fail(createSpinner, t("pr.createdSkippedFailed", { created, skipped, failed: errors }));
  } else {
    succeed(createSpinner, t("pr.createdSkipped", { created, skipped }));
  }

  // ── Print results ──
  out.printPRResults(results);

  // ── Conflict check ──
  const prsToCheck = results.filter((r) => r.number && (r.status === "created" || r.status === "skipped"));
  if (prsToCheck.length > 0) {
    const conflictSpinner = startSpinner(t("pr.checkingConflicts"));
    const conflicts: PRResult[] = [];
    for (const r of prsToCheck) {
      if (r.number && checkPRConflicts(ctx.owner, ctx.repo, r.number)) {
        conflicts.push(r);
      }
    }
    if (conflicts.length > 0) {
      fail(conflictSpinner, t("pr.conflictsFound", { count: conflicts.length }));
      out.blank();
      for (const r of conflicts) {
        console.log(
          chalk.yellow(`  ⚠ ${r.target}:`) + chalk.dim(" conflicts detected — run")
        );
        console.log(
          chalk.dim(`     gx merge --into ${r.target} --source ${sourceBranch}`)
        );
        console.log(chalk.dim(`     ${r.url}`));
      }
      out.blank();
    } else {
      succeed(conflictSpinner, t("pr.noConflicts"));
    }
  }
}
