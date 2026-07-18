import type { LocaleStrings } from "../lib/i18n.js";

const en: LocaleStrings = {
  general: {
    aborted: "Aborted.",
    proceed: "Proceed?",
    dryRunPrefix: "[DRY RUN]",
    totalPrs: "Total: {{count}} PR(s)",
    done: "Done.",
    yes: "Yes",
    no: "No",
  },

  pr: {
    description: "Create PRs to multiple target branches",
    optionBranch: "Source branch (default: current branch)",
    optionAll: "Skip selection, PR to all configured targets",
    optionTargets: "Comma-separated target branches (override config)",
    optionTitle: "PR title override",
    optionBody: "PR body override",
    optionDraft: "Create as draft PRs",
    optionDryRun: "Show what would be done without creating PRs",
    optionYes: "Skip confirmation prompts",

    preflight: "Running pre-flight checks",
    preflightFailed: "GitHub authentication failed",
    preflightUnpushed: "Pre-flight checks done (unpushed commits detected)",
    preflightPassed: "Pre-flight checks passed",
    authError: "Not authenticated with GitHub. Run 'gh auth login' or set GITHUB_TOKEN.",
    invalidSource: "Invalid source branch",
    sourceIsTarget: "Source branch '{{source}}' is also a target. Switch to a feature branch.",
    unpushedWarn: "Branch '{{branch}}' has unpushed commits — PR creation may fail.",
    unpushedConfirm: "Branch '{{branch}}' has unpushed commits. Continue anyway?",

    usingCliTargets: "Using CLI-specified targets: {{targets}}",
    usingAllTargets: "Using all configured targets: {{targets}}",
    noTargets: "No targets configured for this repo.",
    noRemoteBranches: "No remote branches found to use as targets.",
    setupConfig: "Set up target configuration for this repo?",
    savedTargets: "Saved {{count}} targets.",
    noTargetsSelected: "No targets selected. Exiting.",

    checkingTargets: "Checking target branches",
    targetsChecked: "Target branches checked",
    readyHint: "ready",
    existingPrHint: "PR #{{number}} already exists — will skip",
    notFoundHint: "branch not found on remote",
    noDiffHint: "no diff — PR will be empty",

    noTargetsChosen: "No target branches selected. Exiting.",
    onTargetBranch: "You are on target branch '{{branch}}' — pick a source branch:",
    noSourceBranches: "No feature branches found on remote to use as source.",
    checkingOut: "Checking out {{branch}}",
    checkedOut: "Checked out {{branch}}",
    checkoutFailed: "Failed to checkout {{branch}}",
    branchNotFoundSkip: "branch not found on remote",

    dryRunWouldCreate: "Would create PRs:",

    readyToCreate: "Ready to create {{count}} PR(s):",
    creating: "Creating {{count}} PR(s)",
    createdSkipped: "{{created}} created, {{skipped}} skipped",
    createdSkippedFailed: "{{created}} created, {{skipped}} skipped, {{failed}} failed",

    results: "Results:",
    resultSummary: "{{created}} created, {{skipped}} skipped, {{errors}} errors",
    skippedExisting: "skipped (existing PR)",
    skippedReason: "skipped ({{reason}})",
    errorPrefix: "error: {{msg}}",
  },

  merge: {
    description: "Safe-merge feature branch via temp branch",
    optionInto: "Target branch (default: from config or 'develop')",
    optionSource: "Source branch (default: current branch)",
    optionContinue: "Continue after resolving conflicts",
    optionAbort: "Abort the merge",
    optionDryRun: "Show what would be done",

    inProgress: "A merge is already in progress. Run 'gx merge --continue' or 'gx merge --abort'.",
    sameBranch: "Source and target branches are the same.",
    targetLabel: "Target: {{branch}}",

    dryRunWould: "Would:",
    dryRunStep1: "Fetch origin/{{branch}}",
    dryRunStep2: "Create temp merge branch",
    dryRunStep3: "Merge {{source}} into temp branch",
    dryRunStep4: "Push temp branch",
    dryRunStep5: "Create PR: temp branch → {{target}}",

    fetching: "Fetching origin/{{branch}}",
    fetched: "Fetched origin/{{branch}}",

    creatingTemp: "Creating temp branch: {{name}}",
    createdTemp: "Created {{name}}",

    merging: "Merging {{source}} → {{temp}}",
    mergedClean: "Merged cleanly — no conflicts",
    conflicts: "{{count}} conflict(s) detected",
    conflictsHeader: "CONFLICTS DETECTED ({{count}} files):",
    resolvePrompt: "Please resolve the conflicts in your editor.",
    whenReady: "When ready:",
    toCancel: "To cancel:",
    continueCmd: "gx merge --continue",
    abortCmd: "gx merge --abort",

    pushing: "Pushing temp branch",
    pushed: "Pushed {{name}}",

    creatingPr: "Creating PR",
    prCreated: "PR created: {{url}}",
    afterMergeNote: "After PR #{{number}} is merged, the temp branch can be deleted with 'gx cleanup'.",

    continuing: "Continuing merge...",
    committingResolution: "Committing merge resolution",
    committedResolution: "Committed merge resolution",
    notOnMergeBranch: "Not on a gx merge branch. Run 'gx merge' to start a new merge.",
    conflictsUnresolved: "Conflicts still unresolved in {{count}} file(s):\n  {{files}}\n\nResolve all conflicts before continuing.",
    nothingToAbort: "Not on a gx merge branch. Nothing to abort.",
    abortConfirm: "Abort merge and delete the temp branch?",
    mergeAborted: "Merge aborted. Deleted {{temp}}, back on {{branch}}.",
  },

  sync: {
    description: "Sync current branch with its base target branch",
    optionFrom: "Branch to sync from (default: from config or 'develop')",
    optionRebase: "Use rebase instead of merge",
    optionYes: "Skip confirmation",

    syncingFrom: "Syncing from: {{branch}}",
    fetching: "Fetching origin/{{branch}}",
    fetched: "Fetched origin/{{branch}}",
    alreadyUpToDate: "Already up to date with origin/{{branch}}",

    newCommits: "New commits on origin/{{branch}} ({{count}}):",
    mergeConfirm: "Merge origin/{{from}} into {{into}}?",
    rebaseConfirm: "Rebase origin/{{from}} into {{into}}?",

    merging: "Merging origin/{{from}} into {{into}}",
    merged: "Merged origin/{{from}} into {{into}}",
    rebasing: "Rebasing onto origin/{{branch}}",
    rebased: "Rebased {{branch}} onto origin/{{from}}",
    rebaseConflicts: "Rebase conflicts detected",
    resolveRebase: "Resolve conflicts, then run 'git rebase --continue'.",
    mergeConflicts: "{{count}} conflict(s)",
    resolveMerge: "Resolve conflicts, then commit. Run 'gx sync' again to verify.",
  },

  cleanup: {
    description: "Delete branches that have been merged into target branches",
    optionDryRun: "Show what would be deleted without deleting",
    optionYes: "Skip confirmation",

    scanning: "Scanning branches merged into {{targets}}",
    noMerged: "No merged branches found",
    foundMerged: "Found {{count}} merged branches",

    mergedHeader: "Merged branches (safe to delete):",
    tagGx: " [gx]",
    tagRemote: " [remote]",

    dryRunWouldDelete: "Would delete {{count}} branches.",
    deleteConfirm: "Delete {{local}} local and {{remote}} remote branches?",

    deletingRemote: "Deleting remote: {{name}}",
    deletedRemote: "Deleted remote: {{name}}",
    deleteRemoteFailed: "Failed to delete remote: {{name}}",
    deletingLocal: "Deleting local: {{name}}",
    deletedLocal: "Deleted local: {{name}}",
    deleteLocalFailed: "Failed to delete local: {{name}}",
    skippingCurrent: "Skipping current branch: {{name}}",

    complete: "Cleanup complete.",
    afterCleanupNote: "After PR #{{number}} is merged, clean up with 'gx cleanup'.",
  },

  status: {
    description: "Show open PRs and merge state for the current repo",
    notAuth: "Not authenticated. PR status may be incomplete.",
    noOpenPrs: "No open PRs found.",
    openPrs: "Open PRs ({{count}}):",
    mergeInProgressWarn: "Merge in progress — run gx merge --continue or --abort",
    mergeInProgressOn: "Merge in progress on {{branch}}",
    mergeContinueHint: "gx merge --continue  |  gx merge --abort",
    draftTag: " [draft]",
  },

  config: {
    description: "Manage per-repo target branch configuration",
    addDesc: "Add a target branch",
    removeDesc: "Remove a target branch",
    listDesc: "List configured target branches",
    initDesc: "Interactive config setup for current repo",

    added: "Added '{{branch}}' to targets for {{repo}}",
    removed: "Removed '{{branch}}' from targets for {{repo}}",
    noTargets: "No targets configured.",
    configPath: "Config: {{path}}",
    configHint: "Run: gx config add <branch>",
    targetsHeader: "Targets:",
    detecting: "Detecting remote branches to suggest targets...",
    noInitTargets: "No targets selected. Config not saved.",
    saved: "Saved {{count}} targets for {{repo}}",
    setLangDesc: "Set display language",
    langSet: "Language set to {{lang}}",
    unknownLang: "Unknown language: {{lang}}. Available: {{available}}",
  },

  commit: {
    description: "Smart conventional commit — interactive or AI-powered",
    optionMessage: "Commit message (skip interactive)",
    optionAi: "Use AI to generate commit message",
    optionDryRun: "Show what would be committed",

    noStaged: "No staged changes. Use 'git add' to stage files first.",
    staged: "Staged",

    detected: "Detected",
    fromBranch: "from branch",

    selectType: "Commit type:",
    scopePrompt: "Scope (optional):",
    messagePrompt: "Message:",
    messageRequired: "Message is required",
    bodyPrompt: "Add a body?",
    bodyInput: "Body (optional):",

    committed: "Committed: {{msg}}",

    aiGenerating: "Generating commit message with AI",
    aiGenerated: "AI message generated",
    aiConfirm: "Accept this message?",
    aiNoKey: "No AI API key configured. Set GX_AI_KEY env var or commit.ai.apiKey in config.",
    aiDiffTruncated: "Diff is large, truncating for AI prompt.",
    aiFailed: "AI generation failed",
    aiFallback: "Falling back to interactive mode",
  },

  context: {
    repo: "Repo:   {{repo}}",
    source: "Source: {{branch}}",
    target: "Target: {{branch}}",
  },

  interactor: {
    selectTargets: "Select target branches to PR into:",
    selectDefaultTargets: "Select default target branches:",
    selectSourceBranch: "Select source branch to PR from:",
    checkboxInstructions: "(space to toggle, enter to confirm)",
  },

  formatter: {
    noRecentCommits: "No recent commits found.",
    noUniqueCommits: "No unique commits on this branch.",
    source: "Source",
    summary: "Summary",
    features: "Features",
    bugfixes: "Bug Fixes",
    other: "Other Changes",
    featTag: "Feature",
    fixTag: "Fix",
  },

  home: {
    helpHint: "Run 'gx --help' to see available commands.",
    quickActions: "Quick actions: gx pr | gx status | gx sync | gx merge | gx commit",
    examples: "Examples:\n  $ gx pr                          Create PRs (interactive target selection)\n  $ gx pr --all                    PR to all configured targets\n  $ gx pr --draft --dry-run        Dry-run draft PRs\n  $ gx merge --into develop        Safe merge via temp branch\n  $ gx merge --continue            Continue after resolving conflicts\n  $ gx merge --abort               Abort merge in progress\n  $ gx status                      Show open PRs and merge state\n  $ gx sync                        Sync current branch with base\n  $ gx cleanup --dry-run           Preview branches to delete\n  $ gx commit                      Smart conventional commit\n  $ gx commit --ai                 AI-generated commit message\n  $ gx config add main             Add target branch for current repo\n  $ gx config init                 Interactive config setup",
    description: "Git Extended — batch PRs, safe merge, and git workflow automation",
  },

  step: {
    indicator: "Step {{current}}/{{total}}:",
  },
};

export default en;
