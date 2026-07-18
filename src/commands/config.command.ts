import { Command } from "commander";
import chalk from "chalk";
import { getGitContext, getRemoteBranches } from "../lib/git.js";
import {
  addTarget,
  removeTarget,
  getRepoTargets,
  setTargets,
  getConfigPath,
} from "../lib/config-store.js";
import { promptForConfig } from "../lib/interactor.js";
import * as out from "../lib/output.js";

export function configCommand(): Command {
  const cmd = new Command("config")
    .description("Manage per-repo target branch configuration");

  cmd
    .command("add")
    .description("Add a target branch")
    .argument("<branch>", "Target branch name")
    .action(async (branch: string) => {
      try {
        const ctx = getGitContext();
        addTarget(ctx.owner, ctx.repo, branch);
        out.success(`Added '${branch}' to targets for ${ctx.owner}/${ctx.repo}`);
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("remove")
    .description("Remove a target branch")
    .argument("<branch>", "Target branch name")
    .action(async (branch: string) => {
      try {
        const ctx = getGitContext();
        removeTarget(ctx.owner, ctx.repo, branch);
        out.success(`Removed '${branch}' from targets for ${ctx.owner}/${ctx.repo}`);
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("list")
    .description("List configured target branches")
    .action(async () => {
      try {
        const ctx = getGitContext();
        const targets = getRepoTargets(ctx.owner, ctx.repo);

        out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);

        if (targets.length === 0) {
          console.log(chalk.dim("\n  No targets configured."));
          console.log(chalk.dim(`  Config: ${getConfigPath()}`));
          console.log(chalk.dim('  Run: gx config add <branch>'));
        } else {
          console.log(chalk.bold("\n  Targets:"));
          for (const t of targets) {
            console.log(`    ${chalk.green("•")} ${t}`);
          }
          console.log(chalk.dim(`\n  Config: ${getConfigPath()}`));
        }
        out.blank();
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("init")
    .description("Interactive config setup for current repo")
    .action(async () => {
      try {
        const ctx = getGitContext();
        const remoteBranches = getRemoteBranches();

        out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);
        out.blank();

        console.log(
          chalk.dim("Detecting remote branches to suggest targets...")
        );
        out.blank();

        const selected = await promptForConfig(remoteBranches);

        if (selected.length === 0) {
          console.log(chalk.yellow("No targets selected. Config not saved."));
          return;
        }

        setTargets(ctx.owner, ctx.repo, selected);
        out.blank();
        out.success(`Saved ${selected.length} targets for ${ctx.owner}/${ctx.repo}`);
        console.log(
          chalk.dim(`Config: ${getConfigPath()}`)
        );
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
