#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
check_dependencies() {
    if ! command_exists bun; then
        error "Bun is not installed. Please install bun first:"
        echo "  curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
}

# Clone or update repository
setup_repository() {
    GX_DIR="$HOME/.gx-build"
    
    if [ -d "$GX_DIR" ]; then
        info "Repository already exists at $GX_DIR"
        cd "$GX_DIR"
        info "Updating repository..."
        git pull
    else
        info "Cloning gx repository..."
        git clone https://github.com/pigpigever/gx.git "$GX_DIR"
        cd "$GX_DIR"
    fi
}

# Build binary
build_binary() {
    info "Installing dependencies..."
    bun install
    
    info "Building binary..."
    bun run build:binary
    
    # Check if binary was built
    if [ ! -f "dist/gx" ]; then
        error "Binary build failed"
        exit 1
    fi
    
    info "Binary built successfully"
}

# Install binary
install_binary() {
    INSTALL_DIR="/usr/local/bin"
    
    # Check if we need sudo
    if [ -w "$INSTALL_DIR" ]; then
        sudo=""
    else
        sudo="sudo"
    fi
    
    info "Installing gx to $INSTALL_DIR..."
    $sudo cp dist/gx "$INSTALL_DIR/gx"
    $sudo chmod +x "$INSTALL_DIR/gx"
    
    info "gx installed to $INSTALL_DIR/gx"
}

# Verify installation
verify_installation() {
    info "Verifying installation..."
    if command_exists gx; then
        info "gx is installed successfully!"
        gx --version
    else
        error "Installation verification failed"
        exit 1
    fi
}

# Cleanup
cleanup() {
    GX_DIR="$HOME/.gx-build"
    if [ -d "$GX_DIR" ]; then
        info "Cleaning up build directory..."
        rm -rf "$GX_DIR"
    fi
}

# Main function
main() {
    info "Installing gx - Git Extended (binary mode)"
    
    check_dependencies
    setup_repository
    build_binary
    install_binary
    verify_installation
    cleanup
    
    info "Installation completed!"
    info "You can now use 'gx' command directly. Try: gx --help"
}

# Run main function
main "$@"