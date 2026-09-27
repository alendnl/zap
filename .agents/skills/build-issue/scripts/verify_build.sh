#!/usr/bin/env bash
set -e

echo "========================================="
echo " ZAP Build & Code Verification Script"
echo "========================================="

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "📍 Current Git Branch: $(git branch --show-current)"
echo "📍 Workspace Path: $REPO_ROOT"

ERRORS=0

# Check Python / FastAPI Backend if present
if [ -d "ZAP-BE" ] || [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    echo "🔍 Checking Python backend..."
    if command -v pytest >/dev/null 2>&1; then
        echo "🏃 Running pytest..."
        pytest || ERRORS=$((ERRORS + 1))
    else
        echo "⚠️ pytest not found, skipping python tests."
    fi
fi

# Check Frontend if present
if [ -d "ZAP-FE" ] || [ -f "package.json" ]; then
    echo "🔍 Checking Node / TypeScript frontend..."
    if command -v npm >/dev/null 2>&1; then
        echo "🏃 Running npm test / lint check..."
        npm test --if-present || ERRORS=$((ERRORS + 1))
    fi
fi

# Check for remaining git merge conflict markers in workspace
echo "🔍 Checking for merge conflict markers..."
if grep -rn "^<<<<<<< " --exclude-dir=".git" --exclude-dir=".worktrees" --exclude-dir=".tmp*" --exclude-dir="node_modules" --exclude="*.md" .; then
    echo "❌ ERROR: Unresolved merge conflict markers detected in source files!"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No conflict markers found."
fi

if [ $ERRORS -eq 0 ]; then
    echo "========================================="
    echo "✅ VERIFICATION SUCCESSFUL"
    echo "========================================="
    exit 0
else
    echo "========================================="
    echo "❌ VERIFICATION FAILED ($ERRORS errors)"
    echo "========================================="
    exit 1
fi
