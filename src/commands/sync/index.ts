import { Command } from "commander";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runSync } from "./run-sync.js";

export function syncCommand(): Command {
  const cmd = new Command("sync")
    .description(t("sync.description"))
    .option("--from <branch>", t("sync.optionFrom"))
    .option("--rebase", t("sync.optionRebase"))
    .option("-y, --yes", t("sync.optionYes"))
    .action(async (opts) => {
      try { await runSync(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}
