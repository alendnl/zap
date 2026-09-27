# Development & Git Workflow Guidelines

1. **Isolation First**:
   - For parallel or multi-agent tasks, always isolate work using `git worktree` via the `git-worktree-parallel` skill.
   - Do not make uncommitted changes directly on `main` when executing sub-tasks.

2. **Verification Before Push**:
   - Always run verification scripts (`.agents/skills/build-issue/scripts/verify_build.sh`) before marking a task complete or merging a branch.

3. **Clean Git History & Conflict Management**:
   - Rebase or merge `main` into feature branches periodically.
   - If merge conflicts occur, use `merge-conflict-resolver` skill to inspect conflict markers, preserve intentional changes, run verification, and commit cleanly.
