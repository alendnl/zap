#!/usr/bin/env bash
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "========================================="
echo " 🌳 Active Git Worktrees"
echo "========================================="
git worktree list
