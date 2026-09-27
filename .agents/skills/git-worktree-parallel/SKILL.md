---
name: git-worktree-parallel
description: >-
  Use this skill to create, list, manage, and isolate parallel tasks or multi-agent feature branches using Git worktrees.
  Prevents uncommitted changes from bleeding across tasks and enables parallel agents to work safely in dedicated directories.
---

# Git Worktree Parallel Skill

Use this skill whenever working on multiple tasks concurrently, running subagents on separate features, or isolating changes from the main working directory.

## 🛠️ Worktree Workflow & Helper Scripts

### 1. Create an Isolated Worktree for a Task
Run the creation script with a task identifier (and optional branch name):
```bash
.agents/skills/git-worktree-parallel/scripts/worktree_create.sh issue-101 feature/issue-101-auth
```
- This creates an isolated worktree at `.worktrees/issue-101`.
- Automatically handles `.gitignore` entries for `.worktrees/`.
- Prepares a fresh git branch tied to `main`.

### 2. List Active Worktrees
To view all ongoing worktrees and their associated branches:
```bash
.agents/skills/git-worktree-parallel/scripts/worktree_list.sh
```

### 3. Parallel Agent Execution Protocol
When launching parallel tasks or delegating work to subagents:
- Assign each subagent to operate strictly within its designated directory (e.g. `/Users/apilav068@apac.comcast.com/zap/.worktrees/issue-101`).
- Subagents execute code, run tests (`verify_build.sh`), and commit changes directly to their task branch inside their worktree.

### 4. Remove Worktree After Merging
Once changes have been merged or pushed:
```bash
.agents/skills/git-worktree-parallel/scripts/worktree_remove.sh issue-101
```

## 🔀 Integration Next Steps
After completing work in a worktree:
1. Commit all changes on the task branch.
2. Activate the [`merge-conflict-resolver`](file:///.agents/skills/merge-conflict-resolver/SKILL.md) skill to integrate feature branches back into `main` and resolve any conflicts.
