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
import { startSpinner, fail } from "../lib/spinner.js";
import { succeed } from "../lib/succeed.js";
import type { PRResult } from "../types.js";
import * as out from "../lib/output.js";

export function prCommand(): Command {
  const cmd = new Command("pr")
    .description("Create PRs to multiple target branches")
    .option("-b, --branch <name>", "Source branch (default: current branch)")
    .option("-a, --all", "Skip selection, PR to all configured targets")
    .option("-t, --targets <list>", "Comma-separated target branches (override config)")
    .option("--title <text>", "PR title override")
    .option("--body <text>", "PR body override")
    .option("--draft", "Create as draft PRs")
    .option("--dry-run", "Show what would be done without creating PRs")
    .option("-y, --yes", "Skip confirmation prompts")
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
  const spinner = startSpinner("Running pre-flight checks");

  if (!isGhAuthenticated()) {
    fail(spinner, "GitHub authentication failed");
    throw new Error(
      "Not authenticated with GitHub. Run 'gh auth login' or set GITHUB_TOKEN."
    );
  }

  const repoConfig = getRepoConfig(ctx.owner, ctx.repo);
  const configuredTargets = repoConfig?.targets ?? [];

  if (configuredTargets.includes(sourceBranch)) {
    fail(spinner, "Invalid source branch");
    throw new Error(
      `Source branch '${sourceBranch}' is also a target. Switch to a feature branch.`
    );
  }

  if (hasUnpushedCommits(sourceBranch)) {
    succeed(spinner, "Pre-flight checks done (unpushed commits detected)");
  } else {
    succeed(spinner, "Pre-flight checks passed");
  }

  if (hasUnpushedCommits(sourceBranch)) {
    if (!opts.yes) {
      const proceed = await confirmAction(
        `Branch '${sourceBranch}' has unpushed commits. Continue anyway?`,
        false
      );
      if (!proceed) {
        console.log(chalk.dim("Aborted."));
        return;
      }
    } else {
      out.warning(`Branch '${sourceBranch}' has unpushed commits — PR creation may fail.`);
    }
  }

  // ── Determine targets ──
  let targets: string[];

  if (opts.targets) {
    targets = opts.targets.split(",").map((t: string) => t.trim()).filter(Boolean);
    out.info(`Using CLI-specified targets: ${targets.join(", ")}`);
  } else if (configuredTargets.length === 0) {
    out.warning("No targets configured for this repo.");
    const remoteBranches = getRemoteBranches().filter((b) => b !== sourceBranch);

    if (remoteBranches.length === 0) {
      throw new Error("No remote branches found to use as targets.");
    }

    const save = await confirmAction(
      "Set up target configuration for this repo?",
      true
    );

    if (save) {
      out.blank();
      const selected = await promptForConfig(remoteBranches);
      if (selected.length > 0) {
        setTargets(ctx.owner, ctx.repo, selected);
        out.success(`Saved ${selected.length} targets.`);
        targets = selected;
      } else {
        console.log(chalk.yellow("No targets selected. Exiting."));
        return;
      }
    } else {
      targets = await selectTargets(remoteBranches);
    }
  } else if (opts.all) {
    targets = configuredTargets;
    out.info(`Using all configured targets: ${targets.join(", ")}`);
  } else {
    out.blank();
    const hints = new Map<string, string>();
    const hintSpinner = startSpinner("Checking target branches");
    for (const t of configuredTargets) {
      const existing = checkExistingPR(ctx.owner, ctx.repo, sourceBranch, t);
      if (existing) {
        hints.set(t, `PR #${existing.number} already exists — will skip`);
      } else if (!branchExistsOnRemote(t)) {
        hints.set(t, chalk.red("branch not found on remote"));
      } else if (!hasDiff(sourceBranch, t)) {
        hints.set(t, "no diff — PR will be empty");
      } else {
        hints.set(t, "ready");
      }
    }
    succeed(hintSpinner, "Target branches checked");
    targets = await selectTargets(configuredTargets, hints);
  }

  if (targets.length === 0) {
    console.log(chalk.yellow("\nNo target branches selected. Exiting."));
    return;
  }

  // ── Validate targets ──
  const validTargets: string[] = [];
  const skippedTargets: PRResult[] = [];

  for (const t of targets) {
    if (!branchExistsOnRemote(t)) {
      out.warning(`${t} — branch not found on remote, skipping`);
      skippedTargets.push({
        target: t,
        status: "skipped",
        url: "",
        number: null,
        error: "branch not found on remote",
      });
    } else {
      validTargets.push(t);
    }
  }

  if (validTargets.length === 0) {
    out.printPRResults(skippedTargets);
    return;
  }

  // ── Dry run ──
  if (opts.dryRun) {
    out.blank();
    console.log(chalk.bold.cyan("[DRY RUN] Would create PRs:"));
    out.blank();
    for (const t of validTargets) {
      const title = opts.title || branchToTitle(sourceBranch);
      console.log(
        `  ${chalk.dim("→")} ${chalk.bold(sourceBranch)} ${chalk.dim("→")} ${chalk.bold(t)}  "${title}"`
      );
    }
    out.blank();
    console.log(chalk.dim(`Total: ${validTargets.length} PR(s)`));
    return;
  }

  // ── Confirm ──
  if (!opts.yes) {
    out.blank();
    console.log(chalk.bold(`Ready to create ${validTargets.length} PR(s):`));
    for (const t of validTargets) {
      console.log(`  ${chalk.dim("→")} ${sourceBranch} → ${t}`);
    }
    out.blank();
    const proceed = await confirmAction("Proceed?", true);
    if (!proceed) {
      console.log(chalk.dim("Aborted."));
      return;
    }
  }

  // ── Create PRs in parallel with spinner ──
  const createSpinner = startSpinner(`Creating ${validTargets.length} PR(s)`);

  const results: PRResult[] = [...skippedTargets];

  const prPromises = validTargets.map(async (target): Promise<PRResult> => {
    const existing = checkExistingPR(ctx.owner, ctx.repo, sourceBranch, target);
    if (existing) {
      return {
        target,
        status: "skipped",
        url: existing.url,
        number: existing.number,
        error: `PR already exists: #${existing.number}`,
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
    fail(createSpinner, `${created} created, ${skipped} skipped, ${errors} failed`);
  } else {
    succeed(createSpinner, `${created} created, ${skipped} skipped`);
  }

  // ── Print results ──
  out.printPRResults(results);
}
