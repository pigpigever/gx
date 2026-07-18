import { Command } from "commander";
import chalk from "chalk";
import { getGitContext, getRemoteBranches } from "../lib/git.js";
import {
  addTarget,
  removeTarget,
  getRepoTargets,
  setTargets,
  getConfigPath,
  setLanguage,
} from "../lib/config-store.js";
import { promptForConfig } from "../lib/interactor.js";
import { switchLanguage, t } from "../lib/i18n.js";
import * as out from "../lib/output.js";

export function configCommand(): Command {
  const cmd = new Command("config")
    .description(t("config.description"));

  cmd
    .command("add")
    .description(t("config.addDesc"))
    .argument("<branch>", "Target branch name")
    .action(async (branch: string) => {
      try {
        const ctx = getGitContext();
        addTarget(ctx.owner, ctx.repo, branch);
        out.success(t("config.added", { branch, repo: `${ctx.owner}/${ctx.repo}` }));
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("remove")
    .description(t("config.removeDesc"))
    .argument("<branch>", "Target branch name")
    .action(async (branch: string) => {
      try {
        const ctx = getGitContext();
        removeTarget(ctx.owner, ctx.repo, branch);
        out.success(t("config.removed", { branch, repo: `${ctx.owner}/${ctx.repo}` }));
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("list")
    .description(t("config.listDesc"))
    .action(async () => {
      try {
        const ctx = getGitContext();
        const targets = getRepoTargets(ctx.owner, ctx.repo);

        out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);

        if (targets.length === 0) {
          console.log(chalk.dim(`\n  ${t("config.noTargets")}`));
          console.log(chalk.dim(`  ${t("config.configPath", { path: getConfigPath() })}`));
          console.log(chalk.dim(`  ${t("config.configHint")}`));
        } else {
          console.log(chalk.bold(`\n  ${t("config.targetsHeader")}`));
          for (const branch of targets) {
            console.log(`    ${chalk.green("•")} ${branch}`);
          }
          console.log(chalk.dim(`\n  ${t("config.configPath", { path: getConfigPath() })}`));
        }
        out.blank();
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("init")
    .description(t("config.initDesc"))
    .action(async () => {
      try {
        const ctx = getGitContext();
        const remoteBranches = getRemoteBranches();

        out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);
        out.blank();

        console.log(
          chalk.dim(t("config.detecting"))
        );
        out.blank();

        const selected = await promptForConfig(remoteBranches);

        if (selected.length === 0) {
          console.log(chalk.yellow(t("config.noInitTargets")));
          return;
        }

        setTargets(ctx.owner, ctx.repo, selected);
        out.blank();
        out.success(t("config.saved", { count: selected.length, repo: `${ctx.owner}/${ctx.repo}` }));
        console.log(
          chalk.dim(t("config.configPath", { path: getConfigPath() }))
        );
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command("set-lang")
    .description(t("config.setLangDesc"))
    .argument("<lang>", "Language code (e.g. en)")
    .action(async (lang: string) => {
      try {
        setLanguage(lang);
        await switchLanguage(lang);
        out.success(t("config.langSet", { lang }));
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
