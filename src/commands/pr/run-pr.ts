import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
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
import { generateBody, getPrTitle, generatePrContentWithAI } from "@/lib/formatter.js";
import { getAiConfig } from "@/lib/ai.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import type { PRResult } from "@/types.js";
import * as out from "@/lib/output.js";

export function translatePrError(err: string, head: string, base: string): string {
  if (err.startsWith("errorNoCommits|")) {
    return t("pr.errorNoCommits", { head, base });
  }
  if (err.startsWith("errorBranchNotFound|")) {
    return t("pr.errorBranchNotFound", { head });
  }
  if (err === "errorPermissionDenied") {
    return t("pr.errorPermissionDenied");
  }
  if (err === "errorRateLimit") {
    return t("pr.errorRateLimit");
  }
  if (err === "errorNetwork") {
    return t("pr.errorNetwork");
  }
  // Unknown error — return cleaned-up message from parseGhPrError
  return err;
}

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
      await checkoutBranch(sourceBranch);
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

  if (!await isGhAuthenticated()) {
    fail(spinner, t("pr.preflightFailed"));
    throw new Error(t("pr.authError"));
  }

  if (configuredTargets.includes(sourceBranch)) {
    fail(spinner, t("pr.invalidSource"));
    throw new Error(t("pr.sourceIsTarget", { source: sourceBranch }));
  }

  if (await hasUnpushedCommits(sourceBranch)) {
    succeed(spinner, t("pr.preflightUnpushed"));
  } else {
    succeed(spinner, t("pr.preflightPassed"));
  }

  if (await hasUnpushedCommits(sourceBranch)) {
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
  const fetchSpinner = startSpinner(t("pr.fetching"));
  await fetchAll();
  succeed(fetchSpinner, t("pr.fetched"));

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
    let checked = 0;
    for (const branch of configuredTargets) {
      hintSpinner.text = t("pr.checkingTargetProgress", { branch, current: checked + 1, total: configuredTargets.length });
      const existing = await checkExistingPR(ctx.owner, ctx.repo, sourceBranch, branch);
      if (existing) {
        hints.set(branch, t("pr.existingPrHint", { number: existing.number }));
      } else if (!(await branchExistsOnRemote(branch))) {
        hints.set(branch, chalk.red(t("pr.notFoundHint")));
      } else if (!(await hasDiff(sourceBranch, branch))) {
        hints.set(branch, t("pr.noDiffHint"));
      } else {
        hints.set(branch, t("pr.readyHint"));
      }
      checked++;
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
  const validateSpinner = startSpinner(t("pr.validatingTargets"));

  for (const target of targets) {
    validateSpinner.text = t("pr.validatingTarget", { target });
    if (!(await branchExistsOnRemote(target))) {
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
  succeed(validateSpinner, t("pr.validatedTargets", { count: targets.length }));

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
      const title = opts.title || await getPrTitle(sourceBranch);
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
    createSpinner.text = t("pr.checkingExisting", { target });
    const existing = await checkExistingPR(ctx.owner, ctx.repo, sourceBranch, target);
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
      createSpinner.text = t("pr.generatingBody", { target });
      
      // Determine if we should use AI
      const aiConfig = getAiConfig();
      const useAi = opts.ai === true || (opts.ai !== false && aiConfig);
      
      let title: string;
      let body: string;
      
      if (useAi && aiConfig) {
        // AI generation
        createSpinner.text = t("pr.aiGenerating");
        const aiContent = await generatePrContentWithAI(sourceBranch, target);
        title = opts.title || aiContent.title;
        body = opts.body || aiContent.body;
        
        // Show AI result for confirmation (unless --yes)
        if (!opts.yes && !opts.title && !opts.body) {
          succeed(createSpinner, t("pr.aiGenerated"));
          out.blank();
          console.log(chalk.bold(t("pr.aiTitle") + ": ") + title);
          console.log(chalk.dim("───"));
          console.log(body);
          console.log(chalk.dim("───"));
          out.blank();
          
          const proceed = await confirm({ message: t("pr.aiConfirm"), default: true });
          if (!proceed) {
            out.info(t("pr.aiFallback"));
            title = opts.title || await getPrTitle(sourceBranch);
            body = opts.body || await generateBody(sourceBranch, target);
          }
          createSpinner.text = t("pr.creatingForTarget", { target });
          createSpinner.start();
        }
      } else {
        // Traditional generation
        title = opts.title || await getPrTitle(sourceBranch);
        body = opts.body || await generateBody(sourceBranch, target);
      }
      
      createSpinner.text = t("pr.creatingForTarget", { target });
      const created = await createPR({
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
      return { target, status: "error", url: "", number: null, error: translatePrError(err.message, sourceBranch, target) };
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
      conflictSpinner.text = t("pr.checkingConflictProgress", { target: r.target, current: conflicts.length + 1, total: prsToCheck.length });
      if (r.number && await checkPRConflicts(ctx.owner, ctx.repo, r.number)) {
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
