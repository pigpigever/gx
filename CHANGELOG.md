# Changelog

## [1.1.10] — 2026-07-18

### Fixed
- PR body now only shows commits unique to the source branch (git log target..source)
- No longer includes shared main-branch history in PR description

### Changed
- PR body: categorized into Summary / Features / Bug Fixes / Other Changes
- Removed "automatically created by gx" from generated PR messages

## [1.1.9] — 2026-07-18

### Changed
- PR body generation: categorized into Summary / Features / Bug Fixes / Other Changes
- Removed "gx" branding from generated PR messages

## [1.1.8] — 2026-07-18

### Added
- Homebrew formula (`git-extended`) to avoid name conflict with homebrew-core's `gx`

## [1.1.7] — 2026-07-18

### Fixed
- Shell escaping: backticks in PR body were interpreted as command substitution

## [1.1.6] — 2026-07-18

### Fixed
- `gx pr`: auto-checkout selected source branch when on target

## [1.1.5] — 2026-07-18

### Added
- `gx pr`: auto-prompt source branch selector when on a target branch

## [1.1.4] — 2026-07-18

### Fixed
- CI: pin pnpm to v8, bump node to 25

## [1.1.3] — 2026-07-18

### Fixed
- CI: switch release workflow from npm to pnpm

## [1.1.2] — 2026-07-18

### Added
- `gx commit` — smart conventional commit (interactive + AI)
- Unit tests (39 tests), lint, verify scripts

## [1.1.1] — 2026-07-18

### Added
- ASCII logo, badges, emojis to README

## [1.1.0] — 2026-07-18

### Added
- i18n language support, `config set-lang`, English locale

## [1.0.0] — initial release

- `gx pr`, `gx merge`, `gx sync`, `gx status`, `gx cleanup`, `gx config`
