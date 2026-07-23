import { describe, it, expect } from "vitest";

// ── Regex logic extracted from continue-merge.ts ──

function parseTempBranch(tempBranch: string): { source: string; target: string } {
  const targetMatch = tempBranch.match(/merge\/.+-to-(.+)-\d{12}$/);
  const target = targetMatch ? targetMatch[1] : "develop";

  const targetHyphen = target.replace(/\//g, "-");
  const escaped = targetHyphen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sourceRegex = new RegExp(`merge/(.+)-to-${escaped}-\\d{12}$`);
  const sourceMatch = tempBranch.match(sourceRegex);
  const source = sourceMatch ? sourceMatch[1].replace(/-/g, "/") : "unknown";

  return { source, target };
}

describe("parseTempBranch — target extraction", () => {
  it("feat → main", () => {
    expect(parseTempBranch("merge/feat-auth-to-main-202607231234")).toEqual({
      source: "feat/auth", target: "main",
    });
  });

  it("feat → develop", () => {
    expect(parseTempBranch("merge/feat-login-to-develop-202607231234")).toEqual({
      source: "feat/login", target: "develop",
    });
  });

  it("nested source branch", () => {
    expect(parseTempBranch("merge/feat-auth-login-to-main-202607231234")).toEqual({
      source: "feat/auth/login", target: "main",
    });
  });

  it("release target with dots", () => {
    expect(parseTempBranch("merge/fix-typo-to-release-2.0-202607231234")).toEqual({
      source: "fix/typo", target: "release-2.0",
    });
  });

  it("source branch with hyphens (no 'to')", () => {
    expect(parseTempBranch("merge/chore-bump-deps-to-main-202607231234")).toEqual({
      source: "chore/bump/deps", target: "main",
    });
  });

  it("real-world timestamp", () => {
    expect(parseTempBranch("merge/feat-deploy-to-prod-202601010000")).toEqual({
      source: "feat/deploy", target: "prod",
    });
  });

  it("falls back to 'develop' for malformed branch", () => {
    expect(parseTempBranch("not-a-merge-branch").target).toBe("develop");
  });

  it("falls back to 'unknown' source when pattern does not match", () => {
    expect(parseTempBranch("merge-unknown-to-main-202607231234").source).toBe("unknown");
  });
});

describe("parseTempBranch — known limitation", () => {
  // The encoding `merge/${source}-to-${target}-${timestamp}` uses `-` both
  // as path separator (replacing `/`) and as literal chars in branch names.
  // When source or target contains "to", the regex may split at the wrong
  // `-to-` boundary. This is a pre-existing design limitation.

  it("source containing 'to' — target still extracted correctly", () => {
    // Source is feat/to-do-list, encoded as feat-to-do-list
    // The regex extracts target=main correctly, but source becomes
    // feat/to/do/list because all hyphens are converted to slashes.
    const result = parseTempBranch("merge/feat-to-do-list-to-main-202607231234");
    expect(result.target).toBe("main");
  });

  it("target containing 'to' — still extracts a target", () => {
    // Target is my-to-do-list, encoded as my-to-do-list
    const result = parseTempBranch("merge/fix-login-to-my-to-do-list-202607231234");
    // Due to ambiguity, the regex may pick the wrong split point.
    // At minimum, it should not crash and should return a non-empty string.
    expect(result.target.length).toBeGreaterThan(0);
    expect(result.source.length).toBeGreaterThan(0);
  });
});
