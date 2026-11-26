#!/usr/bin/env bash
set -uo pipefail

# =========================================================================
# ZAP Build & Code Verification Script
# Runs backend pytest, frontend Next.js build (and optional lint/typecheck),
# and scans for unresolved git merge conflict markers.
# =========================================================================

RUN_BACKEND=false
RUN_FRONTEND=false
RUN_LINT=false
PYTEST_FLAGS="-v"

usage() {
    cat <<'EOF'
Usage: verify_build.sh [OPTIONS]

Options:
  -b, --backend    Run backend pytest verification (plus conflict check)
  -f, --frontend   Run frontend Next.js build verification (plus conflict check)
  -l, --lint       Run frontend ESLint (or tsc --noEmit fallback) with frontend check
      --fast       Use compact pytest output (-q --tb=short)
  -h, --help       Show this help message

With neither --backend nor --frontend, both suites run.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -b|--backend)
            RUN_BACKEND=true
            shift
            ;;
        -f|--frontend)
            RUN_FRONTEND=true
            shift
            ;;
        -l|--lint)
            RUN_LINT=true
            shift
            ;;
        --fast)
            PYTEST_FLAGS="-q --tb=short"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

# Default to running both layers if neither layer flag was specified
if [ "$RUN_BACKEND" = false ] && [ "$RUN_FRONTEND" = false ]; then
    RUN_BACKEND=true
    RUN_FRONTEND=true
fi

echo "========================================="
echo " ZAP Build & Code Verification Script"
echo "========================================="

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

COMMON_GIT_DIR="$(git rev-parse --git-common-dir 2>/dev/null || echo ".git")"
if [[ "$COMMON_GIT_DIR" != /* ]]; then
    COMMON_GIT_DIR="$REPO_ROOT/$COMMON_GIT_DIR"
fi
COMMON_ROOT="$(cd "$(dirname "$COMMON_GIT_DIR")" && pwd)"

echo "📍 Current Git Branch: $(git branch --show-current 2>/dev/null || echo 'detached')"
echo "📍 Workspace Path: $REPO_ROOT"

ERRORS=0

# 1. Python / FastAPI Backend Verification
if [ "$RUN_BACKEND" = true ] && { [ -d "ZAP-BE" ] || [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; }; then
    echo "🔍 Checking Python backend..."
    PYTEST_BIN=""
    for candidate in \
        "$REPO_ROOT/.venv/bin/pytest" \
        "$COMMON_ROOT/.venv/bin/pytest" \
        "$REPO_ROOT/../../.venv/bin/pytest"
    do
        if [ -x "$candidate" ]; then
            PYTEST_BIN="$candidate"
            break
        fi
    done

    if [ -z "$PYTEST_BIN" ] && command -v pytest >/dev/null 2>&1; then
        PYTEST_BIN="$(command -v pytest)"
    fi

    if [ -n "$PYTEST_BIN" ]; then
        echo "🏃 Running pytest ($PYTEST_FLAGS) using $PYTEST_BIN..."
        # shellcheck disable=SC2086
        if ! "$PYTEST_BIN" $PYTEST_FLAGS; then
            echo "❌ Backend pytest failed."
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "❌ ERROR: pytest not found in .venv or PATH; cannot verify backend."
        ERRORS=$((ERRORS + 1))
    fi
fi

# 2. Next.js / TypeScript Frontend Verification
if [ "$RUN_FRONTEND" = true ] && [ -d "ZAP-FE" ]; then
    echo "🔍 Checking Node / TypeScript frontend (ZAP-FE)..."
    CREATED_NM_SYMLINK=false
    cleanup_nm_symlink() {
        if [ "$CREATED_NM_SYMLINK" = true ] && [ -L "$REPO_ROOT/node_modules" ]; then
            rm -f "$REPO_ROOT/node_modules"
        fi
    }
    trap cleanup_nm_symlink EXIT

    if [ ! -e "$REPO_ROOT/node_modules" ] && [ ! -e "$REPO_ROOT/ZAP-FE/node_modules" ] \
       && [ "$REPO_ROOT" != "$COMMON_ROOT" ] && [ -d "$COMMON_ROOT/node_modules" ]; then
        echo "🔗 Linking shared node_modules for worktree verification..."
        ln -s "$COMMON_ROOT/node_modules" "$REPO_ROOT/node_modules"
        CREATED_NM_SYMLINK=true
    fi

    if ! command -v npm >/dev/null 2>&1; then
        echo "❌ ERROR: npm not found in PATH."
        ERRORS=$((ERRORS + 1))
    elif [ ! -e "$REPO_ROOT/node_modules" ] && [ ! -e "$REPO_ROOT/ZAP-FE/node_modules" ]; then
        echo "❌ ERROR: node_modules not found in $REPO_ROOT (run 'npm install' first)."
        ERRORS=$((ERRORS + 1))
    else
        if [ "$RUN_LINT" = true ]; then
            if [ -x "$REPO_ROOT/node_modules/.bin/eslint" ] || [ -x "$REPO_ROOT/ZAP-FE/node_modules/.bin/eslint" ]; then
                echo "🧹 Running npm run lint --workspace=ZAP-FE..."
                if ! npm run lint --workspace=ZAP-FE; then
                    echo "❌ Frontend lint failed."
                    ERRORS=$((ERRORS + 1))
                fi
            elif [ -x "$REPO_ROOT/node_modules/.bin/tsc" ]; then
                echo "ℹ️ ESLint not installed in ZAP-FE; running strict TypeScript check (tsc --noEmit)..."
                if ! "$REPO_ROOT/node_modules/.bin/tsc" -p "$REPO_ROOT/ZAP-FE/tsconfig.json" --noEmit; then
                    echo "❌ Frontend TypeScript check failed."
                    ERRORS=$((ERRORS + 1))
                fi
            else
                echo "⚠️ Neither eslint nor tsc found for --lint."
            fi
        fi

        echo "🏗️ Running npm run build --workspace=ZAP-FE..."
        if ! npm run build --workspace=ZAP-FE; then
            echo "❌ Frontend build failed."
            ERRORS=$((ERRORS + 1))
        fi

        echo "🧪 Running npm test --workspace=ZAP-FE --if-present..."
        if ! npm test --workspace=ZAP-FE --if-present; then
            echo "❌ Frontend tests failed."
            ERRORS=$((ERRORS + 1))
        fi
    fi
    cleanup_nm_symlink
    CREATED_NM_SYMLINK=false
fi

# 3. Merge Conflict Marker Check
echo "🔍 Checking for unresolved merge conflict markers..."
if CONFLICTS=$(grep -rnE "^(<<<<<<< |>>>>>>> )" \
    --exclude-dir=".git" \
    --exclude-dir=".venv" \
    --exclude-dir=".worktrees" \
    --exclude-dir=".tmp*" \
    --exclude-dir=".tmp.driveupload" \
    --exclude-dir="node_modules" \
    --exclude-dir=".next" \
    --exclude-dir="build-workspace" \
    --exclude="*.md" \
    . 2>&1); then
    echo "❌ ERROR: Unresolved merge conflict markers detected:"
    echo "$CONFLICTS"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No conflict markers found."
fi

if [ "$ERRORS" -eq 0 ]; then
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
