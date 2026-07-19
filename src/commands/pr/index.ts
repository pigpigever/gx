import { Command } from "commander";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runPr } from "./run-pr.js";

export function prCommand(): Command {
  const cmd = new Command("pr")
    .description(t("pr.description"))
    .option("-b, --branch <name>", t("pr.optionBranch"))
    .option("-a, --all", t("pr.optionAll"))
    .option("-t, --targets <list>", t("pr.optionTargets"))
    .option("--title <text>", t("pr.optionTitle"))
    .option("--body <text>", t("pr.optionBody"))
    .option("--draft", t("pr.optionDraft"))
    .option("--dry-run", t("pr.optionDryRun"))
    .option("-y, --yes", t("pr.optionYes"))
    .action(async (opts) => {
      try {
        await runPr(opts);
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
