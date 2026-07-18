import { Command } from "commander";
import chalk from "chalk";
import { getGitContext, getRemoteBranches, hasUnpushedCommits, branchExistsOnRemote, hasDiff } from "../lib/git.js";
import { getRepoTargets, setTargets, getRepoConfig } from "../lib/config-store.js";
import { isGhAuthenticated, checkExistingPR, createPR, listOpenPRs } from "../lib/github.js";
import { selectTargets, promptForConfig, confirmAction } from "../lib/interactor.js";
import { branchToTitle, generateBody } from "../lib/formatter.js";
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
  // ── 1. Get git context ──
  const ctx = getGitContext();
  const sourceBranch = opts.branch || ctx.currentBranch;

  out.printContext(ctx.owner, ctx.repo, sourceBranch);

  // ── 2. Pre-flight checks ──
  out.blank();
  console.log(chalk.dim("Running pre-flight checks..."));
  out.blank();

  // Check gh auth
  if (!isGhAuthenticated()) {
    throw new Error(
      "Not authenticated with GitHub. Run 'gh auth login' or set GITHUB_TOKEN."
    );
  }
  out.success("GitHub authentication OK");

  // Check source branch is not a target
  const repoConfig = getRepoConfig(ctx.owner, ctx.repo);
  const configuredTargets = repoConfig?.targets ?? [];
  if (configuredTargets.includes(sourceBranch)) {
    throw new Error(
      `Source branch '${sourceBranch}' is also a target. Switch to a feature branch.`
    );
  }

  // Check source branch is pushed
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
      out.warning(
        `Branch '${sourceBranch}' has unpushed commits — PR creation may fail.`
      );
    }
  } else {
    out.success(`Branch '${sourceBranch}' is up to date on remote`);
  }

  // ── 3. Determine targets ──
  let targets: string[];

  if (opts.targets) {
    targets = opts.targets.split(",").map((t: string) => t.trim()).filter(Boolean);
    out.info(`Using CLI-specified targets: ${targets.join(", ")}`);
  } else if (configuredTargets.length === 0) {
    // Auto-detect: scan remote branches and prompt
    out.warning("No targets configured for this repo.");
    const remoteBranches = getRemoteBranches().filter(
      (b) => b !== sourceBranch
    );

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
    // Interactive selection with hints
    out.blank();
    const hints = new Map<string, string>();
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
    targets = await selectTargets(configuredTargets, hints);
  }

  if (targets.length === 0) {
    console.log(chalk.yellow("\nNo target branches selected. Exiting."));
    return;
  }

  // ── 4. Check targets exist on remote (skip those that don't) ──
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

  // ── 5. Dry run ──
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

  // ── 6. Confirm ──
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

  // ── 7. Create PRs in parallel ──
  out.blank();
  console.log(chalk.bold("Creating PRs..."));
  out.blank();

  const results: PRResult[] = [...skippedTargets];

  const prPromises = validTargets.map(async (target): Promise<PRResult> => {
    // Check for existing PR
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

      return {
        target,
        status: "created",
        url: created.url,
        number: created.number,
        error: "",
      };
    } catch (err: any) {
      return {
        target,
        status: "error",
        url: "",
        number: null,
        error: err.message,
      };
    }
  });

  const prResults = await Promise.all(prPromises);
  results.push(...prResults);

  // ── 8. Print results ──
  out.printPRResults(results);
}
