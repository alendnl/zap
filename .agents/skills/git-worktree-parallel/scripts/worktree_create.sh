#!/usr/bin/env bash
set -e

TASK_NAME="$1"
BRANCH_NAME="${2:-feature/$TASK_NAME}"

if [ -z "$TASK_NAME" ]; then
    echo "Usage: $0 <task-name> [branch-name]"
    echo "Example: $0 issue-101 feature/issue-101-user-auth"
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Ensure .worktrees is ignored in .gitignore
if [ -f .gitignore ]; then
    if ! grep -q "^\.worktrees" .gitignore; then
        echo -e "\n.worktrees/" >> .gitignore
        echo "Added .worktrees/ to .gitignore"
    fi
else
    echo ".worktrees/" > .gitignore
    echo "Created .gitignore with .worktrees/"
fi

WORKTREE_PATH="$REPO_ROOT/.worktrees/$TASK_NAME"

if [ -d "$WORKTREE_PATH" ]; then
    echo "⚠️ Worktree already exists at: $WORKTREE_PATH"
    exit 0
fi

echo "🚀 Creating git worktree for task '$TASK_NAME'..."

# Check if branch exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "Using existing branch '$BRANCH_NAME'"
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
    echo "Creating new branch '$BRANCH_NAME' off main"
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" main
fi

echo "========================================="
echo "✅ Worktree Created Successfully!"
echo "📍 Location: $WORKTREE_PATH"
echo "🌿 Branch:   $BRANCH_NAME"
echo "========================================="
