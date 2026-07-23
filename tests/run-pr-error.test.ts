import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/i18n.js", () => ({
  t: (key: string, vars?: Record<string, string>) => {
    const map: Record<string, string> = {
      "pr.errorNoCommits": "no new commits to PR from '{{head}}' into '{{base}}'",
      "pr.errorBranchNotFound": "branch '{{head}}' not found on remote — push it first",
      "pr.errorPermissionDenied": "insufficient permissions — check repo access",
      "pr.errorRateLimit": "GitHub API rate limit exceeded — try again later",
      "pr.errorNetwork": "network error — check your connection",
    };
    let str = map[key] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
      }
    }
    return str;
  },
}));

vi.mock("@/lib/git.js", () => ({}));
vi.mock("@/lib/config-store.js", () => ({}));
vi.mock("@/lib/github.js", () => ({}));
vi.mock("@/lib/interactor.js", () => ({}));
vi.mock("@/lib/formatter.js", () => ({}));
vi.mock("@/lib/ai.js", () => ({}));
vi.mock("@/lib/spinner.js", () => ({}));
vi.mock("@/lib/output.js", () => ({}));
vi.mock("@inquirer/prompts", () => ({}));

import { translatePrError } from "../src/commands/pr/run-pr.js";

describe("translatePrError", () => {
  it("translates errorNoCommits with head and base", () => {
    const result = translatePrError("errorNoCommits|feat/x|main", "feat/x", "main");
    expect(result).toBe("no new commits to PR from 'feat/x' into 'main'");
  });

  it("translates errorBranchNotFound with head", () => {
    const result = translatePrError("errorBranchNotFound|feat/x", "feat/x", "main");
    expect(result).toBe("branch 'feat/x' not found on remote — push it first");
  });

  it("translates errorPermissionDenied", () => {
    const result = translatePrError("errorPermissionDenied", "feat/x", "main");
    expect(result).toBe("insufficient permissions — check repo access");
  });

  it("translates errorRateLimit", () => {
    const result = translatePrError("errorRateLimit", "feat/x", "main");
    expect(result).toBe("GitHub API rate limit exceeded — try again later");
  });

  it("translates errorNetwork", () => {
    const result = translatePrError("errorNetwork", "feat/x", "main");
    expect(result).toBe("network error — check your connection");
  });

  it("returns unknown errors as-is", () => {
    const result = translatePrError("something unexpected happened", "feat/x", "main");
    expect(result).toBe("something unexpected happened");
  });

  it("returns empty string as-is", () => {
    const result = translatePrError("", "feat/x", "main");
    expect(result).toBe("");
  });
});
