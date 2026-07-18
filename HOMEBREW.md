# Homebrew Tap for gx

To install gx via Homebrew:

```bash
brew tap chentony/gx
brew install gx
```

## Formula

```ruby
# chentony/homebrew-gx/Formula/gx.rb
class Gx < Formula
  desc "Batch PRs, safe merge, and git workflow automation"
  homepage "https://github.com/chentony/gx"
  version "1.0.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/chentony/gx/releases/download/v#{version}/gx-darwin-arm64"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"
    else
      url "https://github.com/chentony/gx/releases/download/v#{version}/gx-darwin-x64"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/chentony/gx/releases/download/v#{version}/gx-linux-arm64"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"
    else
      url "https://github.com/chentony/gx/releases/download/v#{version}/gx-linux-x64"
      sha256 "REPLACE_WITH_ACTUAL_SHA256"
    end
  end

  def install
    bin.install Dir["gx-*"].first => "gx"
  end

  test do
    assert_match "gx", shell_output("#{bin}/gx --version")
  end
end
```

## Release Checklist

1. Bump version in `package.json`
2. `git tag v1.0.0 && git push --tags`
3. CI builds binaries and creates GitHub Release
4. Copy SHA256 from `checksums.txt` in the release
5. Update `homebrew-gx` Formula with new version + SHA256
