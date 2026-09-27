---
name: build-issue
description: >-
  Use this skill to implement code changes based on gathered requirements or git issues.
  Guides the agent through isolated worktree editing, codebase modification, compliance with loose coupling architecture,
  and executing verification checks.
---

# Build Issue Skill

Use this skill to execute code implementation for an issue or task.

## 🛠️ Implementation Workflow

### Step 1: Environment & Worktree Check
Check the current working branch and directory:
```bash
git branch --show-current
```
If working on a new task or sub-task in parallel with other agents, ensure you are operating inside an isolated worktree created via [`git-worktree-parallel`](file:///.agents/skills/git-worktree-parallel/SKILL.md).

### Step 2: Implementation Guidelines
1. Refer to the requirements / checklist created during [`requirement-gathering`](file:///.agents/skills/requirement-gathering/SKILL.md).
2. Follow low-level architectural specs in [`docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md).
3. Ensure no tight coupling: Keep Question CRUD separate from Compiler Code Execution.

### Step 3: Run Verification
Execute the verification script to validate syntax, test suites, and ensure no conflict markers exist:
```bash
.agents/skills/build-issue/scripts/verify_build.sh
```

### Step 4: Commit Changes
Make clean, focused commits with clear messages:
```bash
git add .
git commit -m "feat(issue-123): implement requested changes"
```

### Step 5: Integration
If working in a parallel worktree, switch to [`merge-conflict-resolver`](file:///.agents/skills/merge-conflict-resolver/SKILL.md) to integrate changes into `main` and push.
