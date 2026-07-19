import { Command } from "commander";
import chalk from "chalk";
import {
  analyzeStaged,
  hasStagedChanges,
  runCommit,
} from "@/lib/commit-analyzer.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runInteractiveCommit, printAnalysis } from "./interactive.js";
import { runAiCommit } from "./ai-commit.js";

export function commitCommand(): Command {
  const cmd = new Command("commit")
    .description(t("commit.description"))
    .option("-m, --message <text>", t("commit.optionMessage"))
    .option("--ai", t("commit.optionAi"))
    .option("--dry-run", t("commit.optionDryRun"))
    .action(async (opts) => {
      try { await runCommitCmd(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}

async function runCommitCmd(opts: any): Promise<void> {
  // ── Shortcut: direct message ──
  if (opts.message) {
    if (!hasStagedChanges()) {
      throw new Error(t("commit.noStaged"));
    }
    const msg = opts.message;
    if (opts.dryRun) {
      console.log(chalk.bold.cyan(`[DRY RUN] git commit -m "${msg}"`));
      return;
    }
    runCommit(msg);
    out.success(t("commit.committed", { msg }));
    return;
  }

  // ── Pre-flight ──
  if (!hasStagedChanges()) {
    throw new Error(t("commit.noStaged"));
  }

  const analysis = analyzeStaged();
  printAnalysis(analysis);

  // ── Route ──
  if (opts.ai) {
    await runAiCommit(analysis, opts.dryRun);
  } else {
    await runInteractiveCommit(analysis, opts.dryRun);
  }
}
