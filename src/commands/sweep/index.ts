import { Command } from "commander";
import chalk from "chalk";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runSweep } from "./run-sweep.js";

export function sweepCommand(): Command {
  const cmd = new Command("sweep")
    .description(t("sweep.description"))
    .option("--dry-run", t("sweep.optionDryRun"))
    .option("-y, --yes", t("sweep.optionYes"))
    .option("--mine", t("sweep.optionMine"))
    .action(async (opts) => {
      try { await runSweep(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}
