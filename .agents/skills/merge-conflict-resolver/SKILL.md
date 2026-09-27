---
name: merge-conflict-resolver
description: >-
  Use this skill when integrating multiple parallel task branches, pushing changes, or when git merge conflicts occur.
  Provides step-by-step strategies to detect, analyze, resolve, verify, and cleanly commit merge conflicts across parallel worktrees or main.
---

# Merge Conflict Resolver Skill

Use this skill when merging feature branches, integrating parallel worktree changes, or rebasing against `main`.

## 🛠️ Step-by-Step Conflict Resolution Procedure

### Step 1: Detect Conflicts
Run the conflict detection script to check git status and conflict markers:
```bash
.agents/skills/merge-conflict-resolver/scripts/check_conflicts.sh
```

### Step 2: Analyze Conflicting Changes
For each file flagged with conflicts, inspect the standard Git conflict markers:
```text
<<<<<<< HEAD (Current change)
code from current branch / main
=======
code from incoming feature branch
>>>>>>> feature/issue-101-auth
```

### Step 3: Resolution Protocol
1. **Preserve Functionality**: Combine non-overlapping changes from both branches. Do not blindly overwrite one side unless explicitly instructed.
2. **Architecture Compliance**: Ensure resolved code adheres to loose coupling standards (Question CRUD vs Executor).
3. **Remove All Conflict Markers**: Ensure no `<<<<<<<`, `=======`, or `>>>>>>>` strings remain in any file.

### Step 4: Verify Post-Merge Integrity
Run the build & test verification script:
```bash
.agents/skills/build-issue/scripts/verify_build.sh
```

### Step 5: Finalize Merge & Stage
Once verification passes:
```bash
git add .
git commit -m "fix(merge): resolve merge conflicts between main and feature branch"
```

### Step 6: Push Changes safely
Push the branch to remote or update `main`:
```bash
git push origin <branch-name>
```
If clean up is needed, prune worktrees with [`git-worktree-parallel`](file:///.agents/skills/git-worktree-parallel/SKILL.md).
