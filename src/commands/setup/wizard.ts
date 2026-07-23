import chalk from "chalk";
import { select, confirm } from "@inquirer/prompts";
import { saveConfig, setLanguage, getConfigPath } from "@/lib/config-store.js";
import { switchLanguage, t } from "@/lib/i18n.js";
import { runAiConfig } from "@/commands/config/ai.js";
import * as out from "@/lib/output.js";

export async function runSetupWizard(options?: { skipAll?: boolean }): Promise<void> {
  if (options?.skipAll) {
    saveConfig({ version: 1, repos: {} });
    out.success(t("setup.done"));
    return;
  }

  console.log(chalk.cyan(t("setup.welcome")));
  out.blank();

  const total = 2;
  let current = 1;

  // ── Step 1: Language ──
  out.step(current++, total, t("setup.language"));
  const lang = await select({
    message: t("setup.languagePrompt"),
    choices: [
      { name: "English", value: "en" },
      { name: "中文", value: "zh" },
    ],
  });

  if (lang !== "en") {
    setLanguage(lang);
    await switchLanguage(lang);
  }
  out.success(t("setup.languageSaved", { lang }));
  out.blank();

  // ── Step 2: AI Config ──
  out.step(current++, total, t("setup.aiConfig"));
  const configureAi = await confirm({
    message: t("setup.configureAi"),
    default: true,
  });

  if (configureAi) {
    out.blank();
    await runAiConfig();
  } else {
    out.skip(t("setup.aiSkipped"));
  }

  // ── Summary ──
  out.blank();
  out.success(t("setup.complete"));
  out.blank();
  console.log(chalk.bold(t("setup.summaryTitle")));
  console.log(chalk.dim(t("setup.configPath", { path: getConfigPath() })));
  out.blank();
  console.log(chalk.bold(t("setup.nextSteps")));
  console.log(chalk.cyan(t("setup.nextStepsDetail")));
}
