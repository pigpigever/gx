import type { Ora } from "ora";


export function succeed(spinner: Ora, text?: string): Ora {
    return spinner.succeed(text || spinner.text);
}
