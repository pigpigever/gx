import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import {
  analyzeStaged,
  getStagedDiff,
  runCommit,
} from "@/lib/commit-analyzer.js";
import { loadConfig } from "@/lib/config-store.js";
import { startSpinner, succeed, fail } from "@/lib/spinner.js";
import { t } from "@/lib/i18n.js";
import * as out from "@/lib/output.js";
import { runInteractiveCommit } from "./interactive.js";

export async function runAiCommit(
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
