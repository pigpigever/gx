# gx — Git Extended

<p align="center">
<pre align="center">

 ██████╗   ██╗  ██╗
██╔════╝   ╚██╗██╔╝
██║  ███╗   ╚███╔╝
██║   ██║   ██╔██╗
╚██████╔╝  ██╔╝ ██╗
 ╚═════╝   ╚═╝  ╚═╝
</pre>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gx"><img src="https://img.shields.io/npm/v/gx?color=c95f3b" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/gx?color=47a248" alt="node version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/gx?color=informational" alt="license"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://github.com/pigpigever/gx"><img src="https://img.shields.io/github/stars/pigpigever/gx?style=social" alt="stars"></a>
</p>

<p align="center">
  🚀 Batch PRs, safe merge, and git workflow automation — one command.
</p>

## 📦 Install

```bash
# Homebrew (macOS/Linux)
brew tap pigpigever/gx
brew install gx

# npm / pnpm
npm install -g gx
# or
pnpm add -g gx

# From source
git clone https://github.com/pigpigever/gx.git
cd gx && pnpm install && pnpm run build && pnpm link --global
```

## ⚡ Quick start

```bash
gx config init          # scan remote branches → pick default targets
gx pr                   # interactive multi-select → create PRs
```

## 📋 Commands

### 🔀 `gx pr` — batch PR creation

Create PRs from your feature branch to multiple target branches.

```bash
gx pr                          # interactive: pick which targets to PR into
gx pr --all                    # PR to all configured targets
gx pr --targets main,develop   # override targets for this run
gx pr --branch feat/x          # PR from a different branch
gx pr --draft                  # all PRs as drafts
gx pr --dry-run                # preview without creating
```

### 🛡️ `gx merge` — safe merge via temp branch

Merge a feature branch into a target without touching the target branch directly.

```bash
gx merge                       # merge current branch → develop
gx merge --into main           # merge → main
gx merge --source feat/x       # merge a different branch
gx merge --continue            # continue after resolving conflicts
gx merge --abort               # cancel the merge
```

### 🔄 `gx sync` — sync with base branch

Pull latest changes from your base branch into the current branch.

```bash
gx sync                        # merge develop → current branch
gx sync --from main            # merge main → current branch
gx sync --rebase               # rebase instead of merge
```

### 📊 `gx status` — PR overview

Show all open PRs, CI status, and merge state for the current repo.

```bash
gx status
```

### 🧹 `gx cleanup` — delete merged branches

Remove local and remote branches that have been merged.

```bash
gx cleanup --dry-run           # preview
gx cleanup                     # delete
```

### ⚙️ `gx config` — per-repo configuration

```bash
gx config init                 # interactive setup
gx config add main             # add target branch
gx config remove staging       # remove target branch
gx config list                 # show current targets
gx config set-lang en          # set display language
```

## 🔍 How it works

- 🏠 **Zero repo pollution.** Config is stored at `~/.config/gx/config.yaml`, never touches your repo. `gx merge` uses git's native `.git/MERGE_HEAD` for state — no extra files.
- 🐙 **GH CLI first, REST API fallback.** Uses `gh` when available, curls GitHub API when not.
- ⚡ **Parallel PR creation.** Multiple targets created simultaneously.
- 🌍 **i18n ready.** Built-in locale system — add new languages with a single file.

## 🗂️ Config

```yaml
# ~/.config/gx/config.yaml
version: 1
language: en
repos:
  pigpigever/todo-list:
    targets:
      - main
      - develop
      - staging
  pigpigever/blog:
    targets:
      - main
```

## ✅ Requirements

- Node.js ≥ 18 (npm install) or none (Homebrew binary)
- `gh` CLI authenticated (recommended) or `GITHUB_TOKEN` env var
