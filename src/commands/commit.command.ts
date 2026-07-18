import { Command } from "commander";
import chalk from "chalk";
import { select, input, confirm } from "@inquirer/prompts";
import {
  analyzeStaged,
  hasStagedChanges,
  getStagedDiff,
  runCommit,
  COMMIT_TYPES,
  type CommitType,
} from "../lib/commit-analyzer.js";
import { loadConfig } from "../lib/config-store.js";
import { startSpinner, succeed, fail } from "../lib/spinner.js";
import { t } from "../lib/i18n.js";
import * as out from "../lib/output.js";

// ── Sub-command: gx commit ──

export function commitCommand(): Command {
  const cmd = new Command("commit")
    .description(t("commit.description"))
    .option("-m, --message <text>", t("commit.optionMessage"))
    .option("--ai", t("commit.optionAi"))
    .option("--dry-run", t("commit.optionDryRun"))
    .action(async (opts) => {
      try { await runCommitCmd(opts); }
      catch (err: any) { out.error(err.message); process.exit(1); }
    });
  return cmd;
}

async function runCommitCmd(opts: any): Promise<void> {
  // ── Shortcut: direct message ──
  if (opts.message) {
    if (!hasStagedChanges()) {
      throw new Error(t("commit.noStaged"));
    }
    const msg = opts.message;
    if (opts.dryRun) {
      console.log(chalk.bold.cyan(`[DRY RUN] git commit -m "${msg}"`));
      return;
    }
    runCommit(msg);
    out.success(t("commit.committed", { msg }));
    return;
  }

  // ── Pre-flight ──
  if (!hasStagedChanges()) {
    throw new Error(t("commit.noStaged"));
  }

  const analysis = analyzeStaged();
  printAnalysis(analysis);

  // ── Route ──
  if (opts.ai) {
    await runAiCommit(analysis, opts.dryRun);
  } else {
    await runInteractiveCommit(analysis, opts.dryRun);
  }
}

// ── Interactive (方案 A) ──

async function runInteractiveCommit(
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

  runCommit(fullMessage);
  out.success(t("commit.committed", { msg: formatShort(type, scope, msg) }));
}

// ── AI mode (方案 B) ──

async function runAiCommit(
  analysis: ReturnType<typeof analyzeStaged>,
  dryRun: boolean
): Promise<void> {
  const config = loadConfig();
  const aiConfig = config.commit?.ai;

  if (!aiConfig?.apiKey && !process.env.GX_AI_KEY) {
    throw new Error(t("commit.aiNoKey"));
  }

  const apiKey = aiConfig?.apiKey || process.env.GX_AI_KEY || "";
  const model = aiConfig?.model || "gpt-4o-mini";
  const endpoint = aiConfig?.endpoint || "https://api.openai.com/v1/chat/completions";

  const diff = getStagedDiff();
  if (diff.length > 8000) {
    out.warning(t("commit.aiDiffTruncated"));
  }
  const truncatedDiff = diff.slice(0, 8000);

  const spinner = startSpinner(t("commit.aiGenerating"));
  try {
    const msg = await callAiApi(endpoint, apiKey, model, truncatedDiff);
    succeed(spinner, t("commit.aiGenerated"));

    out.blank();
    console.log(chalk.dim("───"));
    console.log(chalk.bold(msg));
    console.log(chalk.dim("───"));
    out.blank();

    if (dryRun) {
      console.log(chalk.bold.cyan(`[DRY RUN] Would commit with above message`));
      return;
    }

    const proceed = await confirm({ message: t("commit.aiConfirm"), default: false });
    if (!proceed) {
      // Fall back to interactive mode
      out.info(t("commit.aiFallback"));
      await runInteractiveCommit(analysis, dryRun);
      return;
    }

    runCommit(msg);
    out.success(t("commit.committed", { msg: msg.split("\n")[0] }));
  } catch (err: any) {
    fail(spinner, t("commit.aiFailed"));
    out.warning(err.message);
    out.info(t("commit.aiFallback"));
    await runInteractiveCommit(analysis, dryRun);
  }
}

// ── AI API call ──

async function callAiApi(
  endpoint: string,
  apiKey: string,
  model: string,
  diff: string
): Promise<string> {
  const prompt = [
    "You are a git commit message generator. Return ONLY the commit message, no explanation.",
    "Follow conventional commit format: type(scope): description",
    "Types: feat, fix, chore, docs, refactor, test, perf, ci, build, style, revert",
    "Keep the subject line under 72 characters.",
    "Include a body only if the diff warrants additional explanation.",
    "",
    "Git diff:",
    diff,
  ].join("\n");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from AI");

  return text;
}

// ── Formatting ──

function buildCommitMessage(type: string, scope: string, msg: string, body: string): string {
  const prefix = scope ? `${type}(${scope}): ${msg}` : `${type}: ${msg}`;
  return body ? `${prefix}\n\n${body}` : prefix;
}

function formatShort(type: string, scope: string, msg: string): string {
  return scope ? `${type}(${scope}): ${msg}` : `${type}: ${msg}`;
}

// ── Display ──

function printAnalysis(analysis: ReturnType<typeof analyzeStaged>): void {
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
