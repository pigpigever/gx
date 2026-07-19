#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import pkg from "../package.json";

import { registerLocale, initI18n, loadLocale, t } from "./lib/i18n.js";
import { loadConfig } from "./lib/config-store.js";
import { prCommand } from "./commands/pr/index.js";
import { mergeCommand } from "./commands/merge/index.js";
import { configCommand } from "./commands/config/index.js";
import { statusCommand } from "./commands/status/index.js";
import { syncCommand } from "./commands/sync/index.js";
import { cleanupCommand } from "./commands/cleanup/index.js";
import { commitCommand } from "./commands/commit/index.js";
import { sweepCommand } from "./commands/sweep/index.js";

// Register locales (lazy-loaded)
registerLocale("en", () => import("./locales/en.js"));
registerLocale("zh", () => import("./locales/zh.js"));

const LOGO = chalk.cyan(`
 ██████╗   ██╗  ██╗
██╔════╝   ╚██╗██╔╝
██║  ███╗   ╚███╔╝
██║   ██║   ██╔██╗
╚██████╔╝  ██╔╝ ██╗
 ╚═════╝   ╚═╝  ╚═╝
`);

// Bootstrap i18n and run CLI
async function main() {
  const config = loadConfig();
  initI18n(config);
  await loadLocale();

  const program = new Command();

  program
    .name("gx")
    .description(t("home.description"))
    .version(pkg.version, "-V, --version", t("home.versionFlag"))
    .addHelpText("beforeAll", LOGO)
    .addHelpText("after", `\n${chalk.dim(t("home.examples"))}`)
    .configureHelp({
      styleTitle: (str) => chalk.bold.cyan(str),
      styleCommandText: (str) => `${chalk.cyan(str)}`,
      styleCommandDescription: (str) => chalk.dim(str),
      styleDescriptionText: (str) => chalk.dim(str),
      styleOptionText: (str) => chalk.yellow(str),
    });

  // Register commands
  program.addCommand(prCommand());
  program.addCommand(mergeCommand());
  program.addCommand(configCommand());
  program.addCommand(statusCommand());
  program.addCommand(syncCommand());
  program.addCommand(cleanupCommand());
  program.addCommand(commitCommand());
  program.addCommand(sweepCommand());

  // Default behavior: show help
  program.action(() => {
    program.outputHelp();
  });

  program.parse();
}

main().catch((err) => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
