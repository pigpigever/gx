import { Command } from "commander";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runCleanup } from "./run-cleanup.js";

export function cleanupCommand(): Command {
  const cmd = new Command("cleanup")
    .description(t("cleanup.description"))
    .option("--dry-run", t("cleanup.optionDryRun"))
    .option("-y, --yes", t("cleanup.optionYes"))
    .option("--mine", t("cleanup.optionMine"))
    .action(async (opts) => {
      try { await runCleanup(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}
