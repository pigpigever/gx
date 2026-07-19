export function buildCommitMessage(type: string, scope: string, msg: string, body: string): string {
  const prefix = scope ? `${type}(${scope}): ${msg}` : `${type}: ${msg}`;
  return body ? `${prefix}\n\n${body}` : prefix;
}

export function formatShort(type: string, scope: string, msg: string): string {
  return scope ? `${type}(${scope}): ${msg}` : `${type}: ${msg}`;
}
