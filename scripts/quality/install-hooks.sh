#!/usr/bin/env bash
# Install Git hooks for the BenchPilot quality gate.
#
# Lifted from iam/scripts/quality/install-hooks.sh — same shape; the
# hook content lives in scripts/quality/git-hooks/pre-commit.
#
# Usage:
#   ./scripts/quality/install-hooks.sh           # install / refresh
#   ./scripts/quality/install-hooks.sh --check   # verify (exit 1 if not)
#   ./scripts/quality/install-hooks.sh --uninstall

set -e
cd "$(dirname "$0")/../.."

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
NC=$'\033[0m'

SOURCE="scripts/quality/git-hooks/pre-commit"

# Resolve the actual git directory (supports worktrees where .git is a file).
if [ -d ".git" ]; then
    GIT_DIR=".git"
elif [ -f ".git" ]; then
    GIT_DIR="$(sed 's/^gitdir: //' .git)"
else
    GIT_DIR=""
fi

TARGET="${GIT_DIR}/hooks/pre-commit"

if [[ "${1:-}" == "--uninstall" ]]; then
    if [ -f "$TARGET" ]; then
        rm "$TARGET"
        echo -e "${GREEN}✓ Pre-commit hook uninstalled${NC}"
    else
        echo "No pre-commit hook installed."
    fi
    exit 0
fi

if [[ "${1:-}" == "--check" ]]; then
    if [ ! -f "$TARGET" ]; then
        echo -e "${RED}✗ Pre-commit hook is not installed${NC}"
        echo "  Run: ./scripts/quality/install-hooks.sh"
        exit 1
    fi
    if ! diff -q "$SOURCE" "$TARGET" >/dev/null 2>&1; then
        echo -e "${RED}✗ Pre-commit hook is outdated${NC}"
        echo "  Run: ./scripts/quality/install-hooks.sh"
        exit 1
    fi
    echo -e "${GREEN}✓ Pre-commit hook is installed and up to date${NC}"
    exit 0
fi

if [ -z "$GIT_DIR" ]; then
    echo "Error: not a git repository."
    exit 1
fi

# Skip if already up to date.
if diff -q "$SOURCE" "$TARGET" >/dev/null 2>&1; then
    exit 0
fi

mkdir -p "${GIT_DIR}/hooks"

if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$TARGET"
    chmod +x "$TARGET"
    echo -e "${GREEN}✓ Installed pre-commit hook${NC}"
else
    echo "Error: pre-commit hook not found at $SOURCE"
    exit 1
fi

if diff -q "$SOURCE" "$TARGET" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Pre-commit hook verified${NC}"
else
    echo -e "${RED}✗ Pre-commit hook verification failed${NC}"
    exit 1
fi
