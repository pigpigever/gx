import { checkbox, confirm, input } from "@inquirer/prompts";

// ── Target selection ──

export interface TargetChoice {
  name: string;
  value: string;
  checked: boolean;
  hint?: string;
}

export async function selectTargets(
  targets: string[],
  hints?: Map<string, string>
): Promise<string[]> {
  if (targets.length === 0) return [];

  const choices = targets.map((t) => ({
    name: t,
    value: t,
    checked: true,
    description: hints?.get(t),
  }));

  const selected = await checkbox({
    message: "Select target branches to PR into:",
    choices,
    pageSize: 10,
    instructions: "(space to toggle, enter to confirm)",
  });

  return selected;
}

// ── Confirmation ──

export async function confirmAction(message: string, defaultValue = true): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
  });
}

// ── Text input ──

export async function promptInput(message: string, defaultValue?: string): Promise<string> {
  return input({
    message,
    default: defaultValue,
  });
}

// ── Config init ──

export async function promptForConfig(
  detectedBranches: string[]
): Promise<string[]> {
  if (detectedBranches.length === 0) return [];

  const choices = detectedBranches.map((b) => ({
    name: b,
    value: b,
    checked: b === "main" || b === "master" || b === "develop",
  }));

  const selected = await checkbox({
    message: "Select default target branches:",
    choices,
    pageSize: 10,
    instructions: "(space to toggle, enter to confirm)",
  });

  return selected;
}
