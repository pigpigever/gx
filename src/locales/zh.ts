import type { LocaleStrings } from "../lib/i18n.js";

const zh: LocaleStrings = {
  general: {
    aborted: "已取消。",
    proceed: "继续？",
    dryRunPrefix: "[预览]",
    totalPrs: "共 {{count}} 个 PR",
    done: "完成。",
  },

  pr: {
    description: "批量创建 PR 到多个目标分支",
    optionBranch: "源分支（默认：当前分支）",
    optionAll: "跳过选择，PR 到所有已配置的目标",
    optionTargets: "逗号分隔的目标分支列表（覆盖配置）",
    optionTitle: "覆盖 PR 标题",
    optionBody: "覆盖 PR 描述",
    optionDraft: "创建为草稿 PR",
    optionDryRun: "仅显示将要执行的操作",
    optionYes: "跳过确认提示",

    preflight: "执行预检查",
    preflightFailed: "GitHub 认证失败",
    preflightUnpushed: "预检查完成（检测到未推送的提交）",
    preflightPassed: "预检查通过",
    authError: "未通过 GitHub 认证。请运行 'gh auth login' 或设置 GITHUB_TOKEN。",
    invalidSource: "无效的源分支",
    sourceIsTarget: "源分支 '{{source}}' 也是一个目标分支。请切换到功能分支。",
    unpushedWarn: "分支 '{{branch}}' 有未推送的提交 — PR 可能创建失败。",
    unpushedConfirm: "分支 '{{branch}}' 有未推送的提交。继续？",

    usingCliTargets: "使用命令行指定的目标: {{targets}}",
    usingAllTargets: "使用所有已配置的目标: {{targets}}",
    noTargets: "此仓库未配置目标分支。",
    noRemoteBranches: "未找到可用的远程分支。",
    setupConfig: "为此仓库配置目标分支？",
    savedTargets: "已保存 {{count}} 个目标。",
    noTargetsSelected: "未选择目标分支。退出。",

    checkingTargets: "检查目标分支",
    targetsChecked: "目标分支检查完成",
    readyHint: "就绪",
    existingPrHint: "PR #{{number}} 已存在 — 将跳过",
    notFoundHint: "远程分支不存在",
    noDiffHint: "无差异 — PR 将为空",

    noTargetsChosen: "未选择目标分支。退出。",
    onTargetBranch: "你当前在目标分支 '{{branch}}' 上 — 请选择源分支:",
    noSourceBranches: "远程仓库中没有可用的功能分支。",
    checkingOut: "正在切换到 {{branch}}",
    checkedOut: "已切换到 {{branch}}",
    checkoutFailed: "切换分支 {{branch}} 失败",
    branchNotFoundSkip: "远程分支不存在",

    dryRunWouldCreate: "将创建以下 PR:",

    readyToCreate: "准备创建 {{count}} 个 PR:",
    creating: "正在创建 {{count}} 个 PR",
    createdSkipped: "{{created}} 已创建，{{skipped}} 已跳过",
    createdSkippedFailed: "{{created}} 已创建，{{skipped}} 已跳过，{{failed}} 失败",

    results: "结果:",
    resultSummary: "{{created}} 个创建成功，{{skipped}} 个跳过，{{errors}} 个失败",
    skippedExisting: "已有 PR",
    skippedReason: "已跳过（{{reason}}）",
    errorPrefix: "错误: {{msg}}",

    checkingConflicts: "检查合并冲突",
    conflictsFound: "发现 {{count}} 个冲突",
    noConflicts: "未检测到冲突",
  },

  merge: {
    description: "通过临时分支安全合并功能分支",
    optionInto: "目标分支（默认：从配置读取或 'develop'）",
    optionSource: "源分支（默认：当前分支）",
    optionContinue: "解决冲突后继续",
    optionAbort: "中止合并",
    optionDryRun: "仅显示将要执行的操作",

    inProgress: "已有合并正在进行中。请运行 'gx merge --continue' 或 'gx merge --abort'。",
    sameBranch: "源分支和目标分支相同。",
    targetLabel: "目标: {{branch}}",

    dryRunWould: "将执行:",
    dryRunStep1: "拉取 origin/{{branch}}",
    dryRunStep2: "创建临时合并分支",
    dryRunStep3: "将 {{source}} 合并到临时分支",
    dryRunStep4: "推送临时分支",
    dryRunStep5: "创建 PR: 临时分支 → {{target}}",

    fetching: "拉取 origin/{{branch}}",
    fetched: "已拉取 origin/{{branch}}",

    creatingTemp: "创建临时分支: {{name}}",
    createdTemp: "已创建 {{name}}",

    merging: "合并 {{source}} → {{temp}}",
    mergedClean: "合并干净 — 无冲突",
    conflicts: "发现 {{count}} 个冲突",
    conflictsHeader: "发现冲突（{{count}} 个文件）:",
    resolvePrompt: "请在编辑器中解决冲突。",
    whenReady: "解决完毕后:",
    toCancel: "取消:",
    continueCmd: "gx merge --continue",
    abortCmd: "gx merge --abort",

    conflictsResolvedPrompt: "已解决所有冲突？",
    conflictsStillUnresolved: "仍有未解决的冲突 — 见上方文件列表。",
    resolveHint: "在编辑器中解决冲突后，再次运行 'gx merge --continue'。",

    pushing: "推送临时分支",
    pushed: "已推送 {{name}}",

    creatingPr: "创建 PR",
    prCreated: "PR 已创建: {{url}}",
    afterMergeNote: "PR #{{number}} 合并后，可用 'gx cleanup' 删除临时分支。",

    continuing: "继续合并...",
    committingResolution: "提交冲突解决",
    committedResolution: "已提交冲突解决",
    notOnMergeBranch: "不在 gx 合并分支上。请运行 'gx merge' 开始新的合并。",
    conflictsUnresolved: "仍有 {{count}} 个文件存在未解决的冲突:\n  {{files}}\n\n请先解决所有冲突。",
    nothingToAbort: "不在 gx 合并分支上。无需中止。",
    abortConfirm: "中止合并并删除临时分支？",
    mergeAborted: "合并已中止。已删除 {{temp}}，已切回 {{branch}}。",
  },

  sync: {
    description: "将当前分支与基础分支同步",
    optionFrom: "同步来源分支（默认：从配置读取或 'develop'）",
    optionRebase: "使用 rebase 替代 merge",
    optionYes: "跳过确认",

    syncingFrom: "同步来源: {{branch}}",
    fetching: "拉取 origin/{{branch}}",
    fetched: "已拉取 origin/{{branch}}",
    alreadyUpToDate: "已与 origin/{{branch}} 保持同步",

    newCommits: "origin/{{branch}} 上有新的提交（{{count}} 个）:",
    mergeConfirm: "将 origin/{{from}} 合并到 {{into}}？",
    rebaseConfirm: "将 origin/{{from}} rebase 到 {{into}}？",

    merging: "合并 origin/{{from}} 到 {{into}}",
    merged: "已将 origin/{{from}} 合并到 {{into}}",
    rebasing: "Rebase 到 origin/{{branch}}",
    rebased: "已将 {{branch}} rebase 到 origin/{{from}}",
    rebaseConflicts: "Rebase 时检测到冲突",
    resolveRebase: "解决冲突后运行 'git rebase --continue'。",
    mergeConflicts: "{{count}} 个冲突",
    resolveMerge: "解决冲突后提交，然后再次运行 'gx sync' 验证。",
  },

  cleanup: {
    description: "删除已合并的分支",
    optionDryRun: "仅显示将要删除的分支",
    optionYes: "跳过确认",

    scanning: "扫描已合并到 {{targets}} 的分支",
    noMerged: "未找到已合并的分支",
    foundMerged: "找到 {{count}} 个已合并的分支",

    mergedHeader: "已合并的分支（可安全删除）:",
    tagGx: " [gx]",
    tagRemote: " [远程]",

    dryRunWouldDelete: "将删除 {{count}} 个分支。",
    deleteConfirm: "删除 {{local}} 个本地和 {{remote}} 个远程分支？",

    deletingRemote: "删除远程分支: {{name}}",
    deletedRemote: "已删除远程分支: {{name}}",
    deleteRemoteFailed: "删除远程分支失败: {{name}}",
    deletingLocal: "删除本地分支: {{name}}",
    deletedLocal: "已删除本地分支: {{name}}",
    deleteLocalFailed: "删除本地分支失败: {{name}}",
    skippingCurrent: "跳过当前分支: {{name}}",

    complete: "清理完成。",
    afterCleanupNote: "PR #{{number}} 合并后，可用 'gx cleanup' 清理。",
  },

  status: {
    description: "显示当前仓库的 PR 概览和合并状态",
    notAuth: "未认证。PR 状态可能不完整。",
    noOpenPrs: "没有打开的 PR。",
    openPrs: "打开的 PR（{{count}} 个）:",
    mergeInProgressWarn: "合并进行中 — 运行 gx merge --continue 或 --abort",
    mergeInProgressOn: "合并进行中，位于 {{branch}}",
    mergeContinueHint: "gx merge --continue  |  gx merge --abort",
    draftTag: " [草稿]",
  },

  config: {
    description: "管理每个仓库的目标分支配置",
    addDesc: "添加目标分支",
    removeDesc: "删除目标分支",
    listDesc: "列出已配置的目标分支",
    initDesc: "交互式配置当前仓库",
    setLangDesc: "设置显示语言",

    added: "已将 '{{branch}}' 添加到 {{repo}} 的目标",
    removed: "已将 '{{branch}}' 从 {{repo}} 的目标中移除",
    noTargets: "未配置目标分支。",
    configPath: "配置文件: {{path}}",
    configHint: "运行: gx config add <branch>",
    targetsHeader: "目标分支:",
    detecting: "检测远程分支以建议目标...",
    noInitTargets: "未选择目标。配置未保存。",
    saved: "已为 {{repo}} 保存 {{count}} 个目标",
    langSet: "语言已设置为 {{lang}}",
    unknownLang: "未知语言: {{lang}}。可选: {{available}}",
  },

  commit: {
    description: "智能约定式提交 — 交互式或 AI 辅助",
    optionMessage: "提交消息（跳过交互）",
    optionAi: "使用 AI 生成提交消息",
    optionDryRun: "仅显示将要提交的内容",

    noStaged: "没有暂存的更改。请先用 'git add' 暂存文件。",
    staged: "已暂存",

    detected: "检测到",
    fromBranch: "来自分支",

    selectType: "提交类型:",
    scopePrompt: "范围（可选）:",
    messagePrompt: "消息:",
    messageRequired: "消息不能为空",
    bodyPrompt: "添加正文？",
    bodyInput: "正文（可选）:",

    committed: "已提交: {{msg}}",

    aiGenerating: "AI 正在生成提交消息",
    aiGenerated: "AI 消息已生成",
    aiConfirm: "接受此消息？",
    aiNoKey: "未配置 AI API 密钥。请设置 GX_AI_KEY 环境变量或在配置中设置 commit.ai.apiKey。",
    aiDiffTruncated: "差异较大，已截断用于 AI 提示。",
    aiFailed: "AI 生成失败",
    aiFallback: "回退到交互模式",
  },

  context: {
    repo: "仓库:   {{repo}}",
    source: "源分支: {{branch}}",
    target: "目标: {{branch}}",
  },

  interactor: {
    selectTargets: "选择要 PR 到的目标分支:",
    selectDefaultTargets: "选择默认目标分支:",
    selectSourceBranch: "选择要 PR 的源分支:",
    checkboxInstructions: "(空格切换，回车确认)",
  },

  formatter: {
    noRecentCommits: "未找到最近的提交。",
    noUniqueCommits: "此分支没有独有的提交。",
    source: "来源",
    features: "新功能",
    bugfixes: "问题修复",
    other: "其他更改",
  },

  home: {
    helpHint: "运行 'gx --help' 查看可用命令。",
    versionFlag: "输出版本号",
    quickActions: "快捷操作: gx pr | gx status | gx sync | gx merge | gx commit",
    examples: "示例:\n  $ gx pr                          交互式选择目标分支创建 PR\n  $ gx pr --all                     对所有已配置目标创建 PR\n  $ gx pr --draft --dry-run         预览草稿 PR\n  $ gx merge --into develop         通过临时分支安全合并\n  $ gx merge --continue             解决冲突后继续\n  $ gx merge --abort                中止合并\n  $ gx status                       查看 PR 概览和合并状态\n  $ gx sync                         与基础分支同步\n  $ gx cleanup --dry-run            预览待删除的分支\n  $ gx commit                       智能约定式提交\n  $ gx commit --ai                  AI 生成提交消息\n  $ gx config add main              添加目标分支\n  $ gx config init                   交互式配置\n  $ gx config set-lang zh           切换到中文\n  $ gx config set-lang en           切换到英文",
    description: "Git Extended — 批量 PR、安全合并、Git 工作流自动化",
  },

  step: {
    indicator: "步骤 {{current}}/{{total}}:",
  },
};

export default zh;
