import chalk from "chalk";

export function prStateIcon(state: string): string {
  switch (state) {
    case "MERGED": return chalk.magenta("◆");
    case "OPEN": return chalk.green("●");
    case "CLOSED": return chalk.red("✗");
    default: return chalk.dim("?");
  }
}
