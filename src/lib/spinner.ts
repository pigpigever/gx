import ora, { type Ora } from "ora";

const SPINNER_STYLE = {
  spinner: "dots",
  color: "cyan",
} as const;

export function startSpinner(text: string): Ora {
  return ora({ text, ...SPINNER_STYLE }).start();
}

export function succeed(spinner: Ora, text?: string): Ora {
  return spinner.succeed(text || spinner.text);
}

export function fail(spinner: Ora, text?: string): Ora {
  return spinner.fail(text || spinner.text);
}

export function warnSpinner(spinner: Ora, text?: string): Ora {
  return spinner.warn(text || spinner.text);
}

export function updateText(spinner: Ora, text: string): void {
  spinner.text = text;
}
