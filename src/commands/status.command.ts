import { Command } from "commander";
import { getGitContext, isMergeInProgress, isOnGxMergeBranch } from "../lib/git.js";
import { listOpenPRs, isGhAuthenticated } from "../lib/github.js";
import * as out from "../lib/output.js";

export function statusCommand(): Command {
  const cmd = new Command("status")
    .description("Show open PRs and merge state for the current repo")
    .action(async () => {
      try {
        const ctx = getGitContext();
        out.printContext(ctx.owner, ctx.repo, ctx.currentBranch);
        out.blank();

        if (!isGhAuthenticated()) {
          out.warning("Not authenticated. PR status may be incomplete.");
        } else {
          const prs = listOpenPRs(ctx.owner, ctx.repo);
          for (const pr of prs) {
            if (pr.head === ctx.currentBranch) pr.author = "me";
          }
          out.printStatus(prs, isMergeInProgress());
        }

        if (isMergeInProgress()) {
          if (isOnGxMergeBranch()) {
            out.warning(`Merge in progress on ${ctx.currentBranch}`);
            console.log(`   gx merge --continue  |  gx merge --abort`);
          } else {
            out.warning(`Merge in progress on ${ctx.currentBranch}`);
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
