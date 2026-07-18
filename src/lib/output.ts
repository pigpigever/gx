import chalk from "chalk";
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
  console.log(chalk.bold(`\n📦 Repo:   ${chalk.cyan(`${owner}/${repo}`)}`));
  console.log(chalk.bold(`📤 Source: ${chalk.green(sourceBranch)}`));
}

// ── PR results ──

export function printPRResults(results: PRResult[]): void {
  blank();
  console.log(chalk.bold("Results:"));
  blank();

  for (const r of results) {
    if (r.status === "created") {
      console.log(
        `  ${chalk.green("✓")} ${chalk.bold(r.target.padEnd(12))} ${chalk.underline(r.url)}`
      );
    } else if (r.status === "skipped") {
      console.log(
        `  ${chalk.dim("⊘")} ${chalk.bold(r.target.padEnd(12))} ${chalk.dim(`skipped (${r.error})`)}`
      );
    } else {
      console.log(
        `  ${chalk.red("✗")} ${chalk.bold(r.target.padEnd(12))} ${chalk.red(`error: ${r.error}`)}`
      );
    }
  }

  blank();
  const created = results.filter((r) => r.status === "created").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(
    chalk.bold(
      `Done. ${chalk.green(`${created} created`)}, ${chalk.yellow(`${skipped} skipped`)}, ${chalk.red(`${errors} errors`)}`
    )
  );
  blank();
}

// ── Status display ──

export function printStatus(prs: PROverview[], mergeInProgress: boolean): void {
  if (prs.length === 0) {
    console.log(chalk.dim("  No open PRs found."));
    blank();
    if (mergeInProgress) {
      console.log(
        chalk.yellow("  ⚠ Merge in progress. Run gx merge --continue or --abort.")
      );
    }
    return;
  }

  console.log(chalk.bold(`\nOpen PRs (${prs.length}):`));
  blank();

  for (const pr of prs) {
    const num = chalk.dim(`#${String(pr.number).padStart(3)}`);
    const ci = ciIcon(pr.ciStatus);
    const draft = pr.draft ? chalk.dim(" [draft]") : "";
    const author = pr.author === "me" ? "" : chalk.dim(` @${pr.author}`);

    console.log(
      `  ${num} ${ci} ${chalk.bold(pr.title)} ${chalk.dim(`→ ${pr.base}`)}${draft}${author}`
    );
    console.log(`      ${chalk.dim(pr.url)}`);
  }

  blank();

  if (mergeInProgress) {
    console.log(
      chalk.yellow("  ⚠ Merge in progress — run gx merge --continue or --abort")
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
  console.log(chalk.dim(`\nStep ${current}/${total}:`), chalk.bold(description));
}
