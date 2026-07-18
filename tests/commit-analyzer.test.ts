import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  inferTypeFromBranch,
  inferScope,
  inferTypeFromFiles,
  analyzeStaged,
  hasStagedChanges,
  getStagedDiff,
  runCommit,
  COMMIT_TYPES,
} from "../src/lib/commit-analyzer.js";
import type { CommitType } from "../src/lib/commit-analyzer.js";

// ── Pure function tests ──

describe("inferTypeFromBranch", () => {
  it("detects feat from branch prefix", () => {
    expect(inferTypeFromBranch("feat/i18n")).toBe("feat");
    expect(inferTypeFromBranch("feature/add-login")).toBe("feat");
  });

  it("detects fix from branch prefix", () => {
    expect(inferTypeFromBranch("fix/typo")).toBe("fix");
    expect(inferTypeFromBranch("bugfix/null-pointer")).toBe("fix");
    expect(inferTypeFromBranch("hotfix/security")).toBe("fix");
  });

  it("detects all standard types", () => {
    const types = ["feat", "fix", "chore", "docs", "refactor", "test", "perf", "ci", "build", "style", "revert"];
    for (const t of types) {
      expect(inferTypeFromBranch(`${t}/something`)).toBe(t);
    }
  });

  it("returns null for unknown prefix", () => {
    expect(inferTypeFromBranch("main")).toBeNull();
    expect(inferTypeFromBranch("develop")).toBeNull();
    expect(inferTypeFromBranch("")).toBeNull();
  });

  it("handles nested branch names", () => {
    expect(inferTypeFromBranch("feat/auth/login")).toBe("feat");
    expect(inferTypeFromBranch("fix/ui/button-color")).toBe("fix");
  });
});

describe("inferScope", () => {
  it("returns empty for no files", () => {
    expect(inferScope([])).toBe("");
  });

  it("returns top-level dir when majority share it", () => {
    expect(inferScope(["src/lib/a.ts", "src/lib/b.ts", "README.md"])).toBe("src");
  });

  it("returns empty when files are scattered", () => {
    expect(inferScope(["src/a.ts", "tests/b.ts", "docs/c.md"])).toBe("");
  });

  it("returns empty for root files only", () => {
    expect(inferScope(["README.md", "package.json"])).toBe("");
  });

  it("picks the most common dir", () => {
    expect(inferScope(["src/lib/a.ts", "src/lib/b.ts", "src/commands/c.ts", "tests/x.ts"])).toBe("src");
  });
});

describe("inferTypeFromFiles", () => {
  it("detects docs from .md files", () => {
    expect(inferTypeFromFiles(["README.md", "docs/guide.md"])).toBe("docs");
  });

  it("detects test files", () => {
    expect(inferTypeFromFiles(["src/lib/i18n.test.ts"])).toBe("test");
    expect(inferTypeFromFiles(["tests/unit.test.ts"])).toBe("test");
    expect(inferTypeFromFiles(["__tests__/foo.ts"])).toBe("test");
  });

  it("detects ci files", () => {
    expect(inferTypeFromFiles([".github/workflows/ci.yml"])).toBe("ci");
    expect(inferTypeFromFiles(["Dockerfile"])).toBe("ci");
  });

  it("detects config-only changes as chore", () => {
    expect(inferTypeFromFiles(["package.json", "tsconfig.json"])).toBe("chore");
  });

  it("defaults to feat", () => {
    expect(inferTypeFromFiles(["src/index.ts"])).toBe("feat");
  });
});

// ── Git integration tests ──

describe("analyzeStaged (git)", () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "gx-test-"));
    execSync("git init", { cwd: repoDir });
    execSync('git config user.email "test@gx.dev"', { cwd: repoDir });
    execSync('git config user.name "GX Test"', { cwd: repoDir });
    // Initial commit so we can stage changes
    writeFileSync(join(repoDir, "README.md"), "# test");
    execSync("git add README.md && git commit -m init", { cwd: repoDir });
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  function run(cmd: string) {
    return execSync(cmd, { cwd: repoDir, encoding: "utf-8", stdio: "pipe" }).trim();
  }

  it("detects no staged changes", () => {
    const origCwd = process.cwd();
    process.chdir(repoDir);
    try {
      expect(hasStagedChanges()).toBe(false);
    } finally {
      process.chdir(origCwd);
    }
  });

  it("analyzes staged new file", () => {
    mkdirSync(join(repoDir, "src"), { recursive: true });
    writeFileSync(join(repoDir, "src/index.ts"), "export {}");
    run("git add src/index.ts");

    // Switch to repo dir
    const origCwd = process.cwd();
    process.chdir(repoDir);
    try {
      const analysis = analyzeStaged();
      expect(analysis.files).toEqual(["src/index.ts"]);
      expect(analysis.suggestedType).toBe("feat");
      expect(analysis.suggestedScope).toBe("src");
    } finally {
      process.chdir(origCwd);
    }
  });

  it("detects branch hint", () => {
    run("git checkout -b feat/new-feature");
    writeFileSync(join(repoDir, "foo.ts"), "");
    run("git add foo.ts");

    const origCwd = process.cwd();
    process.chdir(repoDir);
    try {
      const analysis = analyzeStaged();
      expect(analysis.suggestedType).toBe("feat");
      expect(analysis.branchHint).toBe("feat");
    } finally {
      process.chdir(origCwd);
    }
  });

  it("getStagedDiff returns diff content", () => {
    writeFileSync(join(repoDir, "bar.ts"), "const x = 1;");
    run("git add bar.ts");

    const origCwd = process.cwd();
    process.chdir(repoDir);
    try {
      const diff = getStagedDiff();
      expect(diff).toContain("bar.ts");
      expect(diff).toContain("const x = 1;");
    } finally {
      process.chdir(origCwd);
    }
  });

  it("runCommit creates a commit", () => {
    writeFileSync(join(repoDir, "baz.ts"), "");
    run("git add baz.ts");

    const origCwd = process.cwd();
    process.chdir(repoDir);
    try {
      runCommit("feat: add baz");
      const log = run("git log --oneline -1");
      expect(log).toContain("feat: add baz");
    } finally {
      process.chdir(origCwd);
    }
  });
});
