#!/usr/bin/env node

import { Command } from "commander";
import pkg from "../package.json";

import { registerLocale, initI18n, loadLocale, t } from "./lib/i18n.js";
import { loadConfig } from "./lib/config-store.js";
import { prCommand } from "./commands/pr.command.js";
import { mergeCommand } from "./commands/merge.command.js";
import { configCommand } from "./commands/config.command.js";
import { statusCommand } from "./commands/status.command.js";
import { syncCommand } from "./commands/sync.command.js";
import { cleanupCommand } from "./commands/cleanup.command.js";

// Register locales (lazy-loaded)
registerLocale("en", () => import("./locales/en.js"));

// Bootstrap i18n and run CLI
async function main() {
  const config = loadConfig();
  initI18n(config);
  await loadLocale();

  const program = new Command();

  program
    .name("gx")
    .description(t("home.description"))
    .version(pkg.version, "-V, --version", "Output version")
    .addHelpText("after", t("home.examples"));

  // Register commands
  program.addCommand(prCommand());
  program.addCommand(mergeCommand());
  program.addCommand(configCommand());
  program.addCommand(statusCommand());
  program.addCommand(syncCommand());
  program.addCommand(cleanupCommand());

  // Default behavior: if no args, show status
  program.action(() => {
    console.log(t("home.helpHint"));
    console.log(t("home.quickActions"));
  });

  program.parse();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
