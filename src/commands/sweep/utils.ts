import { execSync } from "node:child_process";

export interface TempBranch {
  name: string;
  isLocal: boolean;
  isRemote: boolean;
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

export function getTempBranches(): TempBranch[] {
  const local = exec("git branch --format='%(refname:short)'")
    .split("\n")
    .filter((b) => b.startsWith("merge/") || b.startsWith("temp/"));
  const remote = exec("git branch -r --format='%(refname:short)'")
    .split("\n")
    .filter((b) => b.startsWith("origin/merge/") || b.startsWith("origin/temp/"))
    .map((b) => b.replace("origin/", ""));

  const names = new Set([...local, ...remote]);
  return [...names].map((name) => ({
    name,
    isLocal: local.includes(name),
    isRemote: remote.includes(name),
  }));
}
