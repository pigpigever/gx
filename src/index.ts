#!/usr/bin/env node

import { Command } from "commander";
import pkg from "../package.json";

import { prCommand } from "./commands/pr.command.js";
import { mergeCommand } from "./commands/merge.command.js";
import { configCommand } from "./commands/config.command.js";
import { statusCommand } from "./commands/status.command.js";
import { syncCommand } from "./commands/sync.command.js";
import { cleanupCommand } from "./commands/cleanup.command.js";

const program = new Command();

program
  .name("gx")
  .description("Git Extended — batch PRs, safe merge, and git workflow automation")
  .version(pkg.version, "-V, --version", "Output version")
  .addHelpText(
    "after",
    `
Examples:
  $ gx pr                          Create PRs (interactive target selection)
  $ gx pr --all                    PR to all configured targets
  $ gx pr --draft --dry-run        Dry-run draft PRs
  $ gx merge --into develop        Safe merge via temp branch
  $ gx merge --continue            Continue after resolving conflicts
  $ gx merge --abort               Abort merge in progress
  $ gx status                      Show open PRs and merge state
  $ gx sync                        Sync current branch with base
  $ gx cleanup --dry-run           Preview branches to delete
  $ gx config add main             Add target branch for current repo
  $ gx config init                 Interactive config setup
  `
  );

// Register commands
program.addCommand(prCommand());
program.addCommand(mergeCommand());
program.addCommand(configCommand());
program.addCommand(statusCommand());
program.addCommand(syncCommand());
program.addCommand(cleanupCommand());

// Default behavior: if no args, show status
program.action(() => {
  console.log("Run 'gx --help' to see available commands.");
  console.log("Quick actions: gx pr | gx status | gx sync | gx merge");
});

program.parse();
