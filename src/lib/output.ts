import chalk from "chalk";
import { t } from "./i18n.js";
import type { PRResult, PROverview } from "../types.js";

// ── General ──

export function header(text: string): void {
  console.log(chalk.bold.cyan(`\n${text}`));
}

export function subheader(text: string): void {
  console.log(chalk.dim(text));
}

export function success(text: string): void {
  console.log(`  ${chalk.green("✓")} ${text}`);
}

export function error(text: string): void {
  console.log(`  ${chalk.red("✗")} ${text}`);
}

export function warning(text: string): void {
  console.log(`  ${chalk.yellow("⚠")} ${text}`);
}

export function skip(text: string): void {
  console.log(`  ${chalk.dim("⊘")} ${chalk.dim(text)}`);
}

export function info(text: string): void {
  console.log(`  ${chalk.blue("ℹ")} ${text}`);
}

export function blank(): void {
  console.log();
}

// ── PR context display ──

export function printContext(
  owner: string,
  repo: string,
  sourceBranch: string
): void {
  console.log(chalk.bold(`\n📦 ${t("context.repo", { repo: `${owner}/${repo}` })}`));
  console.log(chalk.bold(`📤 ${t("context.source", { branch: sourceBranch })}`));
}

// ── PR results ──

export function printPRResults(results: PRResult[]): void {
  blank();
  console.log(chalk.bold(t("pr.results")));
  blank();

  for (const r of results) {
    if (r.status === "created") {
      console.log(
        `  ${chalk.green("✓")} ${chalk.bold(r.target.padEnd(12))} ${chalk.underline(r.url)}`
      );
    } else if (r.status === "skipped") {
      if (r.url) {
        console.log(
          `  ${chalk.dim("⊘")} ${chalk.bold(r.target.padEnd(12))} ${chalk.dim(t("pr.skippedExisting"))} ${chalk.underline(r.url)}`
        );
      } else {
        console.log(
          `  ${chalk.dim("⊘")} ${chalk.bold(r.target.padEnd(12))} ${chalk.dim(t("pr.skippedReason", { reason: r.error }))}`
        );
      }
    } else {
      console.log(
        `  ${chalk.red("✗")} ${chalk.bold(r.target.padEnd(12))} ${chalk.red(t("pr.errorPrefix", { msg: r.error }))}`
      );
    }
  }

  blank();
  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(
    chalk.bold(
      t("pr.resultSummary", { created, skipped, errors })
    )
  );
  blank();
}

// ── Status display ──

export function printStatus(prs: PROverview[], mergeInProgress: boolean): void {
  if (prs.length === 0) {
    console.log(chalk.dim(`  ${t("status.noOpenPrs")}`));
    blank();
    if (mergeInProgress) {
      console.log(
        chalk.yellow(`  ⚠ ${t("status.mergeInProgressWarn")}`)
      );
    }
    return;
  }

  console.log(chalk.bold(`\n${t("status.openPrs", { count: prs.length })}`));
  blank();

  for (const pr of prs) {
    const num = chalk.dim(`#${String(pr.number).padStart(3)}`);
    const ci = ciIcon(pr.ciStatus);
    const draft = pr.draft ? chalk.dim(t("status.draftTag")) : "";
    const author = pr.author === "me" ? "" : chalk.dim(` @${pr.author}`);

    console.log(
      `  ${num} ${ci} ${chalk.bold(pr.title)} ${chalk.dim(`→ ${pr.base}`)}${draft}${author}`
    );
    console.log(`      ${chalk.dim(pr.url)}`);
  }

  blank();

  if (mergeInProgress) {
    console.log(
      chalk.yellow(`  ⚠ ${t("status.mergeInProgressWarn")}`)
    );
    blank();
  }
}

function ciIcon(status: string): string {
  switch (status) {
    case "passing":
      return chalk.green("✓");
    case "failing":
      return chalk.red("✗");
    case "pending":
      return chalk.yellow("⏳");
    default:
      return chalk.dim("?");
  }
}

// ── Step indicator ──

export function step(current: number, total: number, description: string): void {
  console.log(chalk.dim(`\n${t("step.indicator", { current, total })}`), chalk.bold(description));
}
