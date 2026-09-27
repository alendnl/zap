#!/usr/bin/env bash
set -e

TASK_NAME="$1"
FORCE_FLAG="$2"

if [ -z "$TASK_NAME" ]; then
    echo "Usage: $0 <task-name> [--force]"
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

WORKTREE_PATH="$REPO_ROOT/.worktrees/$TASK_NAME"

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "⚠️ Worktree path not found: $WORKTREE_PATH"
    git worktree prune
    exit 0
fi

echo "🧹 Removing git worktree for task '$TASK_NAME'..."

if [ "$FORCE_FLAG" == "--force" ]; then
    git worktree remove --force "$WORKTREE_PATH"
else
    git worktree remove "$WORKTREE_PATH"
fi

git worktree prune

echo "========================================="
echo "✅ Worktree Removed & Pruned Successfully"
echo "========================================="
