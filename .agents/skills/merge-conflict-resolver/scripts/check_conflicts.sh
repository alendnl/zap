#!/usr/bin/env bash
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "========================================="
echo " 🔍 Git Merge & Conflict Status Check"
echo "========================================="

UNMERGED_FILES=$(git status --porcelain | grep "^UU\|^AA\|^DU\|^UD" || true)

CONFLICT_MARKERS=$(grep -rn "^<<<<<<< " --exclude-dir=".git" --exclude-dir=".worktrees" --exclude-dir=".tmp*" --exclude-dir="node_modules" --exclude="*.md" . || true)

FOUND_ISSUES=0

if [ -n "$UNMERGED_FILES" ]; then
    echo "⚠️ Unmerged files detected in git status:"
    echo "$UNMERGED_FILES"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
fi

if [ -n "$CONFLICT_MARKERS" ]; then
    echo "❌ Merge conflict markers found in files:"
    echo "$CONFLICT_MARKERS"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
fi

if [ $FOUND_ISSUES -eq 0 ]; then
    echo "✅ No merge conflicts detected. Workspace is clean!"
    exit 0
else
    echo "========================================="
    echo "❌ CONFLICTS DETECTED - Action required."
    echo "========================================="
    exit 1
fi
