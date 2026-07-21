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
    if ! command_exists node; then
        error "Node.js is not installed. Please install Node.js >= 18"
        exit 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js version must be >= 18. Current version: $(node -v)"
        exit 1
    fi

    if ! command_exists pnpm; then
        warn "pnpm is not installed. Trying npm..."
        if ! command_exists npm; then
            error "Neither pnpm nor npm is installed. Please install one of them."
            exit 1
        fi
        PACKAGE_MANAGER="npm"
    else
        PACKAGE_MANAGER="pnpm"
    fi
}

# Clone or update repository
setup_repository() {
    GX_DIR="$HOME/.gx"
    
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

# Install dependencies and build
build_project() {
    info "Installing dependencies..."
    $PACKAGE_MANAGER install
    
    info "Building project..."
    $PACKAGE_MANAGER run build
}

# Setup PATH
setup_path() {
    DIST_DIR="$PWD/dist"
    
    # Check if already in PATH
    if [[ ":$PATH:" == *":$DIST_DIR:"* ]]; then
        info "gx is already in your PATH"
        return
    fi
    
    # Determine shell config file
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                SHELL_CONFIG="$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                SHELL_CONFIG="$HOME/.bash_profile"
            else
                SHELL_CONFIG="$HOME/.bash_profile"
            fi
            ;;
        zsh)
            SHELL_CONFIG="$HOME/.zshrc"
            ;;
        *)
            SHELL_CONFIG="$HOME/.profile"
            ;;
    esac
    
    # Add to PATH
    info "Adding gx to your PATH in $SHELL_CONFIG"
    echo "" >> "$SHELL_CONFIG"
    echo "# gx - Git Extended" >> "$SHELL_CONFIG"
    echo "export PATH=\"$DIST_DIR:\$PATH\"" >> "$SHELL_CONFIG"
    
    # Reload shell config
    info "Reloading shell configuration..."
    source "$SHELL_CONFIG" 2>/dev/null || true
    
    info "Please run 'source $SHELL_CONFIG' or restart your terminal"
}

# Verify installation
verify_installation() {
    info "Verifying installation..."
    if command_exists gx; then
        info "gx is installed successfully!"
        gx --version
    else
        # Try direct path
        if [ -f "$PWD/dist/index.js" ]; then
            info "gx is installed. You may need to restart your terminal or run:"
            echo "  export PATH=\"$PWD/dist:\$PATH\""
        else
            error "Installation verification failed"
            exit 1
        fi
    fi
}

# Main function
main() {
    info "Installing gx - Git Extended"
    
    check_dependencies
    setup_repository
    build_project
    setup_path
    verify_installation
    
    info "Installation completed!"
    info "You can now use 'gx' command. Try: gx --help"
}

# Run main function
main "$@"