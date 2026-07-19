import { Command } from "commander";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runMerge } from "./run-merge.js";
import { continueMerge } from "./continue-merge.js";
import { abortMerge } from "./abort-merge.js";

export function mergeCommand(): Command {
  const cmd = new Command("merge")
    .description(t("merge.description"))
    .option("--into <target>", t("merge.optionInto"))
    .option("-s, --source <branch>", t("merge.optionSource"))
    .option("--continue", t("merge.optionContinue"))
    .option("--abort", t("merge.optionAbort"))
    .option("--dry-run", t("merge.optionDryRun"))
    .action(async (opts) => {
      try {
        if (opts.continue) {
          await continueMerge();
        } else if (opts.abort) {
          await abortMerge();
        } else {
          await runMerge(opts);
        }
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
