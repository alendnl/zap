# ZAP Project Agent Instructions & Harness

Welcome to **ZAP** (DSA & Technical Interview Preparation Platform).

This repository includes an agent harness designed to support parallel feature development, systematic requirement gathering, clean implementation, and safe git worktree / merge conflict management.

---

## 🚀 Quick Start for AI Agents

When assigned a task or git request:

1. **Requirement Gathering**: Activate the `requirement-gathering` skill to parse incoming requirements into **single or multiple GitHub issues** based on scope.
2. **Parallel Task Execution**: For each GitHub issue, use the `git-worktree-parallel` skill to create isolated worktrees in `.worktrees/<issue-id>`.
3. **Build & Implementation**: Activate the `build-issue` skill to implement code changes per issue, maintain loose coupling (FE vs BE vs Compiler), and run verification tests.
4. **Integration & Merge Conflict Resolution**: Use the `merge-conflict-resolver` skill to cleanly merge feature branches into `main` and resolve any conflicts before pushing.

---

## 📚 Project Architecture & Rules

- **Project Specs**: See [`docs/01-ZAP-PROJECT-CONTEXT.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/01-ZAP-PROJECT-CONTEXT.md) and [`docs/02-ZAP-COMPILER-ARCHITECTURE.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/02-ZAP-COMPILER-ARCHITECTURE.md).
- **Core Rule**: The question management system and code execution compiler must remain **loosely coupled**.
- **Frontend**: Next.js + React + TypeScript (`ZAP-FE`).
- **Backend & Compiler**: FastAPI / Python backend (`ZAP-BE`).

---

## 🛠️ Available Agent Skills

- [`requirement-gathering`](file:///.agents/skills/requirement-gathering/SKILL.md): Parse requests & decompose specs into single or multiple GitHub issues.
- [`build-issue`](file:///.agents/skills/build-issue/SKILL.md): Implement features cleanly per GitHub issue and run verification builds.
- [`git-worktree-parallel`](file:///.agents/skills/git-worktree-parallel/SKILL.md): Isolated multi-task worktree management for parallel GitHub issues.
- [`merge-conflict-resolver`](file:///.agents/skills/merge-conflict-resolver/SKILL.md): Integrate branches and resolve git conflicts.
