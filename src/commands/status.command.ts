import { Command } from "commander";
import { getGitContext, isMergeInProgress, isOnGxMergeBranch } from "../lib/git.js";
import { listOpenPRs, isGhAuthenticated } from "../lib/github.js";
import { t } from "../lib/i18n.js";
import * as out from "../lib/output.js";

export function statusCommand(): Command {
  const cmd = new Command("status")
    .description(t("status.description"))
    .action(async () => {
      try {
        const ctx = getGitContext();
        out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);
        out.blank();

        if (!isGhAuthenticated()) {
          out.warning(t("status.notAuth"));
        } else {
          const prs = listOpenPRs(ctx.owner, ctx.repo);
          for (const pr of prs) {
            if (pr.head === ctx.currentBranch) pr.author = "me";
          }
          out.printStatus(prs, isMergeInProgress());
        }

        if (isMergeInProgress()) {
          if (isOnGxMergeBranch()) {
            out.warning(t("status.mergeInProgressOn", { branch: ctx.currentBranch }));
            console.log(`   ${t("status.mergeContinueHint")}`);
          } else {
            out.warning(t("status.mergeInProgressOn", { branch: ctx.currentBranch }));
          }
          out.blank();
        }
      } catch (err: any) {
        out.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
