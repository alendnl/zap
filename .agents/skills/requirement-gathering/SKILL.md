---
name: requirement-gathering
description: >-
  Use this skill when receiving a new raw request, feature specification, or Git issues.
  Systematically parses requirements, checks ZAP architecture docs, resolves ambiguities,
  and breaks down specs into single or multiple GitHub issues with dedicated worktree plans.
---

# Requirement Gathering Skill

Follow this structured workflow to parse raw requests or complex epics and decompose them into single or multiple actionable GitHub issues.

---

## 📋 Requirement Gathering Workflow

### Step 1: Read Project Architecture & Context
Review the core documentation to maintain architectural boundaries:
- [`docs/01-ZAP-PROJECT-CONTEXT.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/01-ZAP-PROJECT-CONTEXT.md)
- [`docs/02-ZAP-COMPILER-ARCHITECTURE.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/02-ZAP-COMPILER-ARCHITECTURE.md)
- [`docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/03-ZAP-COMPILER-LOW-LEVEL-DESIGN.md)

---

### Step 2: Analyze & Categorize Request Scope

Evaluate the size and subsystem impact of the incoming request:

#### Option A: Single GitHub Issue Strategy (Small / Focused Request)
- Scope fits a single component (e.g. adding a specific API endpoint or UI widget).
- Create a single issue spec using [`templates/GITHUB_ISSUE_TEMPLATE.md`](file:///.agents/skills/requirement-gathering/templates/GITHUB_ISSUE_TEMPLATE.md).

#### Option B: Multiple GitHub Issues Strategy (Complex Epic / Cross-Subsystem Feature)
- Scope spans multiple subsystems (e.g. `ZAP-FE` UI + `ZAP-BE` API + Compiler Worker Pool).
- Decompose into **multiple independent or sequentially-ordered GitHub issues**:
  - **Issue #1**: Backend Data Model & Question CRUD API (`ZAP-BE`).
  - **Issue #2**: Compiler Worker Pool Execution Engine (`ZAP-BE`).
  - **Issue #3**: Question Management & Code Submission UI (`ZAP-FE`).
- Ensure each issue has clear boundaries and minimal direct cross-branch dependencies.

---

### Step 3: Generate GitHub Issue Specifications

Use [`templates/GITHUB_ISSUE_TEMPLATE.md`](file:///.agents/skills/requirement-gathering/templates/GITHUB_ISSUE_TEMPLATE.md) to formulate issue definitions:
1. Define **Issue ID**, **Title**, and **Target Subsystem**.
2. Assign a dedicated **Worktree Branch Name** for each issue (e.g., `feature/issue-101-crud`, `feature/issue-102-executor`).
3. Detail explicit **Acceptance Criteria** and **Verification Plan**.

---

### Step 4: Hand-off to Parallel Task Execution & Build

Once single or multiple GitHub issues are defined:
- **Parallel Tasks**: Activate [`git-worktree-parallel`](file:///.agents/skills/git-worktree-parallel/SKILL.md) to create isolated worktrees for each GitHub issue (e.g., `.worktrees/issue-101`).
- **Implementation**: Execute each GitHub issue using the [`build-issue`](file:///.agents/skills/build-issue/SKILL.md) skill inside its respective worktree.
- **Integration**: Merge and resolve any cross-branch conflicts using [`merge-conflict-resolver`](file:///.agents/skills/merge-conflict-resolver/SKILL.md).
