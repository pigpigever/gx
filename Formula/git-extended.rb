class GitExtended < Formula
  desc "Batch PRs, safe merge, and git workflow automation"
  homepage "https://github.com/pigpigever/gx"
  url "https://registry.npmjs.org/gx/-/gx-1.1.7.tgz"
  sha256 "c8d3eae160a892e32837db3dcae515e843e5383fef52b8141940c8bcf8b6d59f"
  license "MIT"

  depends_on "node"

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"dist/index.js" => "gx"
  end

  test do
    assert_match "gx", shell_output("#{bin}/gx --version")
  end
end
