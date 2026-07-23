import { Command } from "commander";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runSetupWizard } from "./wizard.js";

export function setupCommand(): Command {
  const cmd = new Command("setup")
    .description(t("setup.description"))
    .option("--skip-all", t("setup.optionSkipAll"))
    .action(async (opts) => {
      try {
        await runSetupWizard({ skipAll: opts.skipAll });
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
