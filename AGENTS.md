# ZAP Project Agent Instructions & Harness

Welcome to **ZAP** (DSA & Technical Interview Preparation Platform).

This repository is optimized for pair programming and autonomous execution with **Antigravity IDE** powered by Gemini models, as well as modern agentic tools using the **Six-File Context Methodology**.

---

## 🚀 Quick Start for AI Agents

When assigned a task or user prompt:

1. **Understand & Contextualize**: Read the prompt requirement, inspect the canonical [Six-File Context in `context/`](file:///Users/apilav068@apac.comcast.com/zap/context/README.md), review [`docs/`](file:///Users/apilav068@apac.comcast.com/zap/docs), and explore active code.
2. **Build & Implement**: Activate the [`build`](file:///.agents/skills/build/SKILL.md) skill to plan, implement, and verify code changes while maintaining loose architectural coupling.
3. **Frontend Design**: Use the [`frontend-design`](file:///.agents/skills/frontend-design/SKILL.md) skill and [`context/05-ui-context.md`](file:///Users/apilav068@apac.comcast.com/zap/context/05-ui-context.md) when styling or redesigning UI components in `ZAP-FE`.
4. **Clarifications (Strictly Gated)**: Only ask questions when requirements are genuinely ambiguous or involve significant trade-offs; always provide multiple choices.
5. **Verify & Test**: Run `.venv/bin/pytest -v` and `npm run build --workspace=ZAP-FE` (or `.agents/skills/build/scripts/verify_build.sh`) to ensure zero regressions before finishing.

---

## 📂 Six-File Context System (`context/`)

The persistent, single source of truth for the codebase:
- [`context/01-project-overview.md`](file:///Users/apilav068@apac.comcast.com/zap/context/01-project-overview.md): Vision, user personas, product flows, and boundaries (in-scope vs. out-of-scope).
- [`context/02-architecture.md`](file:///Users/apilav068@apac.comcast.com/zap/context/02-architecture.md): System topology, invariants, loose coupling, sandbox isolation, and runtime routing.
- [`context/03-code-standards.md`](file:///Users/apilav068@apac.comcast.com/zap/context/03-code-standards.md): Defensive programming, clarity principles, stack guidelines, and anti-patterns.
- [`context/04-workflow-rules.md`](file:///Users/apilav068@apac.comcast.com/zap/context/04-workflow-rules.md): AI operating model, push-back guidelines, prompt-to-implementation loop, and verification gates.
- [`context/05-ui-context.md`](file:///Users/apilav068@apac.comcast.com/zap/context/05-ui-context.md): Dark-mode first design tokens, typography, Monaco Editor layout, and UX standards.
- [`context/06-progress-tracker.md`](file:///Users/apilav068@apac.comcast.com/zap/context/06-progress-tracker.md): Phase status, completed milestones, active work, and ADR decision log.

---

## 📚 Project Architecture & Rules

- **Core Documentation**: See [`docs/README.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/README.md) for the hierarchical documentation index.
- **System Architecture**: High-level and low-level specifications are detailed in [`docs/architecture/`](file:///Users/apilav068@apac.comcast.com/zap/docs/architecture).
- **Core Rule**: The question management system and code execution compiler must remain **loosely coupled**.
- **Compiler Request Lifecycle**: See [`docs/architecture/compiler-request-lifecycle.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/architecture/compiler-request-lifecycle.md) for the end-to-end request flow (Monaco, sequential polling latches, Cloud Tasks, MongoDB states, and sandbox execution). Any changes to this flow must be updated in that document.
- **Frontend**: Next.js + React + TypeScript + Monaco Editor (`ZAP-FE`).
- **Backend**: FastAPI / Python backend (`ZAP-BE`).
- **Compiler / Executor**: Sandboxed multi-language execution engine (`ZAP-BE/executor`).
- **Infrastructure**: Single deployment on GCP Cloud Run (`zap-api`, `zap-executor`), Google Cloud Tasks, and MongoDB Atlas with dynamic runtime environment routing (`production` / `qa`).

---

## 🛠️ Available Agent Skills

- [`build`](file:///.agents/skills/build/SKILL.md): Prompt-to-implementation workflow with gated clarification, test-driven verification, and capped iterations.
- [`frontend-design`](file:///.agents/skills/frontend-design/SKILL.md): Distinctive, intentional UI/UX design guidance for Next.js and Tailwind CSS components.
- [`project-operations`](file:///.agents/skills/project-operations/SKILL.md): Unified operational skill for managing, inspecting, and diagnosing cloud infrastructure, databases (MongoDB Atlas), GCP Cloud Run/Tasks/Logs, and Git/GitHub CI/CD workflows.
