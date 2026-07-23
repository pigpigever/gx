import chalk from "chalk";
import { select, input, confirm } from "@inquirer/prompts";
import {
  analyzeStaged,
  runCommit,
  COMMIT_TYPES,
  type CommitType,
} from "@/lib/commit-analyzer.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { buildCommitMessage, formatShort } from "./format.js";

export async function runInteractiveCommit(
  analysis: ReturnType<typeof analyzeStaged>,
  dryRun: boolean
): Promise<void> {
  out.blank();

  // Type selection
  const type = await select<CommitType>({
    message: t("commit.selectType"),
    choices: COMMIT_TYPES.map((t) => ({
      name: t === analysis.suggestedType ? `${t}  ${chalk.dim("(auto)")}` : t,
      value: t,
    })),
    default: COMMIT_TYPES.indexOf(analysis.suggestedType),
    pageSize: 12,
  });

  // Scope input
  const scope = await input({
    message: t("commit.scopePrompt"),
    default: analysis.suggestedScope || "",
  });

  // Message input
  const msg = await input({
    message: t("commit.messagePrompt"),
    validate: (v: string) => v.trim().length > 0 || t("commit.messageRequired"),
  });

  // Optional body
  const hasBody = await confirm({
    message: t("commit.bodyPrompt"),
    default: false,
  });
  let body = "";
  if (hasBody) {
    body = await input({
      message: t("commit.bodyInput"),
    });
  }

  const fullMessage = buildCommitMessage(type, scope, msg, body);

  out.blank();
  console.log(chalk.dim("───"));
  console.log(chalk.bold(fullMessage));
  console.log(chalk.dim("───"));
  out.blank();

  if (dryRun) {
    console.log(chalk.bold.cyan(`[DRY RUN] Would commit with above message`));
    return;
  }

  const proceed = await confirm({ message: t("general.proceed"), default: true });
  if (!proceed) {
    console.log(chalk.dim(t("general.aborted")));
    return;
  }

  await runCommit(fullMessage);
  out.success(t("commit.committed", { msg: formatShort(type, scope, msg) }));
}

export function printAnalysis(analysis: ReturnType<typeof analyzeStaged>): void {
  out.blank();
  const parts: string[] = [];
  if (analysis.added > 0) parts.push(chalk.green(`+${analysis.added}`));
  if (analysis.modified > 0) parts.push(chalk.yellow(`~${analysis.modified}`));
  if (analysis.deleted > 0) parts.push(chalk.red(`-${analysis.deleted}`));
  console.log(chalk.bold(`${t("commit.staged")}: ${analysis.files.length} files (${parts.join(" ")})`));

  for (const f of analysis.files.slice(0, 8)) {
    console.log(`  ${chalk.dim(f)}`);
  }
  if (analysis.files.length > 8) {
    console.log(chalk.dim(`  ... and ${analysis.files.length - 8} more`));
  }

  console.log(
    chalk.dim(
      `  ${t("commit.detected")}: ${chalk.cyan(analysis.suggestedType)}` +
      (analysis.suggestedScope ? `(${chalk.cyan(analysis.suggestedScope)})` : "") +
      (analysis.branchHint ? `  (${t("commit.fromBranch")}: ${analysis.branchHint})` : "")
    )
  );
}
