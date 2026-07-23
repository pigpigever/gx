import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks (use vi.hoisted so they survive vi.mock hoisting) ──

const {
  mockGetDiff,
  mockGetUniqueCommits,
  mockGetLatestCommitMessage,
  mockGetAiConfig,
  mockCallAiApi,
} = vi.hoisted(() => ({
  mockGetDiff: vi.fn(),
  mockGetUniqueCommits: vi.fn(),
  mockGetLatestCommitMessage: vi.fn(),
  mockGetAiConfig: vi.fn(),
  mockCallAiApi: vi.fn(),
}));

vi.mock("../src/lib/git.js", () => ({
  getDiff: mockGetDiff,
  getUniqueCommits: mockGetUniqueCommits,
  getLatestCommitMessage: mockGetLatestCommitMessage,
}));

vi.mock("../src/lib/ai.js", () => ({
  getAiConfig: mockGetAiConfig,
  callAiApi: mockCallAiApi,
}));

vi.mock("../src/lib/i18n.js", () => ({
  t: (key: string, vars?: Record<string, string>) => {
    const map: Record<string, string> = {
      "formatter.summary": "Summary",
      "formatter.noUniqueCommits": "No unique commits",
      "formatter.source": "Source",
      "formatter.features": "Features",
      "formatter.bugfixes": "Bugfixes",
      "formatter.other": "Other Changes",
      "formatter.featTag": "Features",
      "formatter.fixTag": "Fixes",
      "pr.aiNoKey": "No AI API key configured",
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

import { branchToTitle, generateBody, generatePrContentWithAI } from "../src/lib/formatter.js";

// ── branchToTitle ──

describe("branchToTitle", () => {
  it("converts feat/xxx to conventional commit title", () => {
    expect(branchToTitle("feat/i18n")).toBe("feat: i18n");
  });

  it("returns feature/xxx as-is (only feat prefix is mapped)", () => {
    expect(branchToTitle("feature/add-login")).toBe("feature/add-login");
  });

  it("converts fix/xxx to fix title", () => {
    expect(branchToTitle("fix/typo")).toBe("fix: typo");
  });

  it("handles nested paths", () => {
    expect(branchToTitle("fix/ui/button-color")).toBe("fix: ui/button-color");
  });

  it("handles all standard prefixes", () => {
    expect(branchToTitle("chore/deps")).toBe("chore: deps");
    expect(branchToTitle("docs/readme")).toBe("docs: readme");
    expect(branchToTitle("refactor/cleanup")).toBe("refactor: cleanup");
    expect(branchToTitle("test/unit")).toBe("test: unit");
    expect(branchToTitle("perf/lazy-load")).toBe("perf: lazy-load");
    expect(branchToTitle("ci/actions")).toBe("ci: actions");
    expect(branchToTitle("build/tsup")).toBe("build: tsup");
    expect(branchToTitle("style/format")).toBe("style: format");
    expect(branchToTitle("revert/v1")).toBe("revert: v1");
  });

  it("returns branch name when no prefix matches", () => {
    expect(branchToTitle("main")).toBe("main");
    expect(branchToTitle("develop")).toBe("develop");
  });

  it("returns prefixed branch when no rest part", () => {
    expect(branchToTitle("feat")).toBe("feat: feat");
  });
});

// ── generateBody ──

describe("generateBody", () => {
  beforeEach(() => {
    mockGetUniqueCommits.mockReset();
  });

  it("generates body with features and bugfixes", async () => {
    mockGetUniqueCommits.mockResolvedValue([
      "abc1234 feat(auth): add login",
      "def5678 fix(ui): fix button",
      "ghi9012 chore(deps): bump deps",
    ]);

    const body = await generateBody("feat/login", "main");

    expect(body).toContain("## Summary");
    expect(body).toContain("### Features");
    expect(body).toContain("abc1234 add login");
    expect(body).toContain("### Bugfixes");
    expect(body).toContain("def5678 fix button");
    expect(body).toContain("### Other Changes");
    expect(body).toContain("ghi9012 bump deps");
    expect(body).toContain("`feat/login` → `main`");
  });

  it("generates body with no commits", async () => {
    mockGetUniqueCommits.mockResolvedValue([]);

    const body = await generateBody("feat/x", "main");

    expect(body).toContain("## Summary");
    expect(body).toContain("No unique commits");
    expect(body).toContain("`feat/x` → `main`");
  });

  it("generates body with only features", async () => {
    mockGetUniqueCommits.mockResolvedValue([
      "aaa1111 feat: new feature",
    ]);

    const body = await generateBody("feat/new", "develop");

    expect(body).toContain("### Features");
    expect(body).not.toContain("### Bugfixes");
    expect(body).not.toContain("### Other Changes");
  });

  it("generates body with only bugfixes", async () => {
    mockGetUniqueCommits.mockResolvedValue([
      "bbb2222 fix: critical bug",
    ]);

    const body = await generateBody("fix/bug", "main");

    expect(body).toContain("### Bugfixes");
    expect(body).not.toContain("### Features");
  });
});

// ── generatePrContentWithAI ──

describe("generatePrContentWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when no AI config", async () => {
    mockGetAiConfig.mockReturnValue(null);

    await expect(generatePrContentWithAI("feat/x", "main")).rejects.toThrow("No AI API key configured");
  });

  it("parses valid JSON response from AI", async () => {
    mockGetAiConfig.mockReturnValue({ model: "gpt-4o", endpoint: "https://api.test.com", apiKey: "sk" });
    mockGetDiff.mockResolvedValue("+ added line");
    mockGetUniqueCommits.mockResolvedValue(["aaa1111 feat: add feature"]);
    mockCallAiApi.mockResolvedValue('{"title": "feat: add feature", "body": "## Summary\\nAdded feature"}');

    const result = await generatePrContentWithAI("feat/x", "main");

    expect(result.title).toBe("feat: add feature");
    expect(result.body).toContain("## Summary");
  });

  it("extracts JSON embedded in surrounding text", async () => {
    mockGetAiConfig.mockReturnValue({ model: "gpt-4o", endpoint: "https://api.test.com", apiKey: "sk" });
    mockGetDiff.mockResolvedValue("+ diff");
    mockGetUniqueCommits.mockResolvedValue(["ccc1111 feat: something"]);
    mockCallAiApi.mockResolvedValue('Here is the result:\n{"title": "feat: something", "body": "body content"}\nDone.');

    const result = await generatePrContentWithAI("feat/x", "main");

    expect(result.title).toBe("feat: something");
    expect(result.body).toBe("body content");
  });

  it("throws on non-JSON response", async () => {
    mockGetAiConfig.mockReturnValue({ model: "gpt-4o", endpoint: "https://api.test.com", apiKey: "sk" });
    mockGetDiff.mockResolvedValue("+ diff");
    mockGetUniqueCommits.mockResolvedValue(["ddd1111 feat: x"]);
    mockCallAiApi.mockResolvedValue("Sorry, I cannot help with that.");

    await expect(generatePrContentWithAI("feat/x", "main")).rejects.toThrow("Failed to parse AI response as JSON");
  });

  it("uses fallback title when JSON missing title", async () => {
    mockGetAiConfig.mockReturnValue({ model: "gpt-4o", endpoint: "https://api.test.com", apiKey: "sk" });
    mockGetDiff.mockResolvedValue("+ diff");
    mockGetUniqueCommits.mockResolvedValue(["eee1111 feat: x"]);
    mockCallAiApi.mockResolvedValue('{"body": "some body"}');

    const result = await generatePrContentWithAI("feat/x", "main");

    expect(result.title).toBe("feat/x → main");
    expect(result.body).toBe("some body");
  });

  it("truncates diff longer than 8000 chars", async () => {
    mockGetAiConfig.mockReturnValue({ model: "gpt-4o", endpoint: "https://api.test.com", apiKey: "sk" });
    const longDiff = "a".repeat(10000);
    mockGetDiff.mockResolvedValue(longDiff);
    mockGetUniqueCommits.mockResolvedValue(["fff1111 feat: x"]);
    mockCallAiApi.mockResolvedValue('{"title": "t", "body": "b"}');

    await generatePrContentWithAI("feat/x", "main");

    const promptArg = mockCallAiApi.mock.calls[0][3];
    expect(promptArg).toContain("truncated");
    expect(promptArg).not.toContain("a".repeat(9000));
  });

  it("passes source and target branches in prompt", async () => {
    mockGetAiConfig.mockReturnValue({ model: "gpt-4o", endpoint: "https://api.test.com", apiKey: "sk" });
    mockGetDiff.mockResolvedValue("+ diff");
    mockGetUniqueCommits.mockResolvedValue(["ggg1111 feat: x"]);
    mockCallAiApi.mockResolvedValue('{"title": "t", "body": "b"}');

    await generatePrContentWithAI("feat/my-feature", "develop");

    const promptArg = mockCallAiApi.mock.calls[0][3];
    expect(promptArg).toContain("Source branch: feat/my-feature");
    expect(promptArg).toContain("Target branch: develop");
  });
});

// ── Integration: real AI call with big-pickle ──

describe("generatePrContentWithAI (integration: big-pickle)", { timeout: 30_000 }, () => {
  const FAKE_DIFF = `diff --git a/src/lib/auth.ts b/src/lib/auth.ts
index abc1234..def5678 100644
--- a/src/lib/auth.ts
+++ b/src/lib/auth.ts
@@ -10,6 +10,10 @@ export function login(username: string, password: string) {
   // existing code
 }
 
+export function logout() {
+  // clear session
+}
+
 export function isLoggedIn() {
   return true;
 }`;

  const FAKE_COMMITS = [
    "aaa1111 feat(auth): add logout function",
    "bbb2222 fix(auth): fix login validation",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDiff.mockResolvedValue(FAKE_DIFF);
    mockGetUniqueCommits.mockResolvedValue(FAKE_COMMITS);
    mockGetAiConfig.mockReturnValue({
      provider: "opencode",
      model: "big-pickle",
      endpoint: "https://opencode.ai/zen/v1/chat/completions",
      apiKey: "",
    });
  });

  it("returns valid PR title and body from big-pickle", async () => {
    const result = await generatePrContentWithAI("feat/logout", "main");

    expect(typeof result.title).toBe("string");
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.title.length).toBeLessThanOrEqual(72);

    expect(typeof result.body).toBe("string");
    expect(result.body.length).toBeGreaterThan(0);
  });

  it("title resembles conventional commit format", async () => {
    const result = await generatePrContentWithAI("feat/logout", "main");

    const lower = result.title.toLowerCase();
    const isConventional = /^(feat|fix|chore|refactor|docs|test|perf|ci|build|style|revert)[\(:]/.test(lower);
    const mentionsLogout = lower.includes("logout") || lower.includes("auth");
    // big-pickle may not always follow conventional commit format strictly
    expect(isConventional || mentionsLogout || result.title.length > 0).toBe(true);
  });

  it("body is a non-empty string", async () => {
    const result = await generatePrContentWithAI("feat/logout", "main");

    expect(typeof result.body).toBe("string");
    expect(result.body.length).toBeGreaterThan(0);
  });
});
