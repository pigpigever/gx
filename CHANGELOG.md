# Changelog

## [1.1.9] — 2026-07-18

### Changed
- PR body generation: categorized into Summary / Features / Bug Fixes / Other Changes
- Removed "gx" branding from generated PR messages
- Summary line added at top of PR body with key changes

## [1.1.8] — 2026-07-18

### Added
- Homebrew formula (`git-extended`) to avoid name conflict with homebrew-core's deprecated `gx`
- Install: `brew tap pigpigever/gx https://github.com/pigpigever/gx && brew install git-extended`

## [1.1.7] — 2026-07-18

### Fixed
- `gh pr create` shell escaping: backticks in PR body (`` `branch-name` ``) were interpreted as command substitution, causing "No such file or directory" errors

## [1.1.6] — 2026-07-18

### Fixed
- `gx pr`: auto-checkout selected source branch when on target, fixing "Head ref must be a branch" error

## [1.1.5] — 2026-07-18

### Added
- `gx pr`: auto-prompt source branch picker when currently on a target branch (main/develop/etc.)
  - Lists remote feature branches and lets user pick via single-select prompt
  - Only triggers when no explicit `--branch` flag is passed

## [1.1.4] — 2026-07-18

### Fixed
- CI: pin pnpm to v8 to match local lockfile format (pnpm 11.x incompatible with v8 lockfile)
- CI: bump node to 25 for GitHub Actions runner compatibility

## [1.1.3] — 2026-07-18

### Fixed
- CI: switch release workflow from npm to pnpm after project migration

## [1.1.2] — 2026-07-18

### Added
- `gx commit` — smart conventional commit command
  - Interactive mode: auto-detects type/scope from branch name + file paths, then prompts to confirm
  - AI mode (`--ai`): sends staged diff to OpenAI-compatible API, generates conventional commit message
  - Shortcut mode (`-m "msg"`): skip interactive entirely
  - Falls back to interactive mode on API failure

### Changed
- CI: add `verify` script (lint → build → test)
- Switch from npm to pnpm

### Added
- Unit tests (39 tests across 3 suites): commit-analyzer, i18n, config-store
- `pnpm run test`, `pnpm run lint`, `pnpm run verify` scripts

## [1.1.1] — 2026-07-18

### Added
- ASCII logo and badges (npm, node, license, TypeScript, stars) to README
- Emoji section headers throughout README

## [1.1.0] — 2026-07-18

### Added
- i18n language support with lazy-loaded locale system
- English locale (all UI strings organized by domain)
- `gx config set-lang <lang>` command
- `language` field in `~/.config/gx/config.yaml`

### Changed
- All command output, prompts, and messages refactored through `t()` translation function

## [1.0.0] — initial release

- `gx pr` — batch PR creation with interactive target selection
- `gx merge` — safe merge via temp branch
- `gx sync` — sync current branch with base
- `gx status` — PR overview and CI status
- `gx cleanup` — delete merged branches
- `gx config` — per-repo target branch configuration
