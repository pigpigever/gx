import { Command } from "commander";
import chalk from "chalk";
import {
  getGitContext,
  getRemoteBranches,
  hasUnpushedCommits,
  branchExistsOnRemote,
  hasDiff,
} from "../lib/git.js";
import {
  getRepoTargets,
  setTargets,
  getRepoConfig,
} from "../lib/config-store.js";
import { isGhAuthenticated, checkExistingPR, createPR } from "../lib/github.js";
import { selectTargets, promptForConfig, confirmAction } from "../lib/interactor.js";
import { branchToTitle, generateBody } from "../lib/formatter.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import { t } from "../lib/i18n.js";
import type { PRResult } from "../types.js";
import * as out from "../lib/output.js";

export function prCommand(): Command {
  const cmd = new Command("pr")
    .description(t("pr.description"))
    .option("-b, --branch <name>", t("pr.optionBranch"))
    .option("-a, --all", t("pr.optionAll"))
    .option("-t, --targets <list>", t("pr.optionTargets"))
    .option("--title <text>", t("pr.optionTitle"))
    .option("--body <text>", t("pr.optionBody"))
    .option("--draft", t("pr.optionDraft"))
    .option("--dry-run", t("pr.optionDryRun"))
    .option("-y, --yes", t("pr.optionYes"))
    .action(async (opts) => {
      try {
        await runPr(opts);
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runPr(opts: any): Promise<void> {
  const ctx = getGitContext();
  const sourceBranch = opts.branch || ctx.currentBranch;

  out.printContext(ctx.owner, ctx.repo, sourceBranch);
  out.blank();

  // ── Pre-flight checks ──
  const spinner = startSpinner(t("pr.preflight"));

  if (!isGhAuthenticated()) {
    fail(spinner, t("pr.preflightFailed"));
    throw new Error(t("pr.authError"));
  }

  const repoConfig = getRepoConfig(ctx.owner, ctx.repo);
  const configuredTargets = repoConfig?.targets ?? [];

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
      const title = opts.title || branchToTitle(sourceBranch);
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
      const title = opts.title || branchToTitle(sourceBranch);
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
}
