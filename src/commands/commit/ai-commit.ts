import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import {
  analyzeStaged,
  getStagedDiff,
  runCommit,
} from "@/lib/commit-analyzer.js";
import { getAiConfig, callAiApi } from "@/lib/ai.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runInteractiveCommit } from "./interactive.js";

export async function runAiCommit(
  analysis: ReturnType<typeof analyzeStaged>,
  dryRun: boolean
): Promise<void> {
  const aiConfig = getAiConfig();

  if (!aiConfig) {
    throw new Error(t("commit.aiNoKey"));
  }

  const diff = getStagedDiff();
  if (diff.length > 8000) {
    out.warning(t("commit.aiDiffTruncated"));
  }
  const truncatedDiff = diff.slice(0, 8000);

  const prompt = [
    "You are a git commit message generator. Return ONLY the commit message, no explanation.",
    "Follow conventional commit format: type(scope): description",
    "Types: feat, fix, chore, docs, refactor, test, perf, ci, build, style, revert",
    "Keep the subject line under 72 characters.",
    "Include a body only if the diff warrants additional explanation.",
    "",
    "Git diff:",
    truncatedDiff,
  ].join("\n");

  const spinner = startSpinner(t("commit.aiGenerating"));
  try {
    const msg = await callAiApi(aiConfig.endpoint, aiConfig.apiKey, aiConfig.model, prompt);
    succeed(spinner, t("commit.aiGenerated"));

    out.blank();
    console.log(chalk.dim("───"));
    console.log(chalk.bold(msg));
    console.log(chalk.dim("───"));
    out.blank();

    if (dryRun) {
      console.log(chalk.bold.cyan(`[DRY RUN] Would commit with above message`));
      return;
    }

    const proceed = await confirm({ message: t("commit.aiConfirm"), default: false });
    if (!proceed) {
      out.info(t("commit.aiFallback"));
      await runInteractiveCommit(analysis, dryRun);
      return;
    }

    await runCommit(msg);
    out.success(t("commit.committed", { msg: msg.split("\n")[0] }));
  } catch (err: any) {
    fail(spinner, t("commit.aiFailed"));
    out.warning(err.message);
    out.info(t("commit.aiFallback"));
    await runInteractiveCommit(analysis, dryRun);
  }
}
