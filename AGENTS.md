# ZAP Project Agent Instructions & Harness

Welcome to **ZAP** (DSA & Technical Interview Preparation Platform).

This repository is optimized for pair programming and autonomous execution with **Antigravity IDE** powered by Gemini models.

---

## 🚀 Quick Start for AI Agents

When assigned a task or user prompt:

1. **Understand & Contextualize**: Read the prompt requirement, inspect the relevant documentation in [`docs/`](file:///Users/apilav068@apac.comcast.com/zap/docs), and explore active code.
2. **Build & Implement**: Activate the [`build`](file:///.agents/skills/build/SKILL.md) skill to plan, implement, and verify code changes while maintaining loose architectural coupling.
3. **Frontend Design**: Use the [`frontend-design`](file:///.agents/skills/frontend-design/SKILL.md) skill when styling or redesigning UI components in `ZAP-FE`.
4. **Clarifications (Strictly Gated)**: Only ask questions when requirements are genuinely ambiguous or involve significant trade-offs; always provide multiple choices.
5. **Verify & Test**: Run `.venv/bin/pytest -v` and `npm run build --workspace=ZAP-FE` to ensure zero regressions before finishing.

---

## 📚 Project Architecture & Rules

- **Core Documentation**: See [`docs/README.md`](file:///Users/apilav068@apac.comcast.com/zap/docs/README.md) for the hierarchical documentation index.
- **System Architecture**: High-level and low-level specifications are detailed in [`docs/architecture/`](file:///Users/apilav068@apac.comcast.com/zap/docs/architecture).
- **Core Rule**: The question management system and code execution compiler must remain **loosely coupled**.
- **Frontend**: Next.js + React + TypeScript + Monaco Editor (`ZAP-FE`).
- **Backend**: FastAPI / Python backend (`ZAP-BE`).
- **Compiler / Executor**: Sandboxed multi-language execution engine (`ZAP-BE/executor`).
- **Infrastructure**: Single deployment on GCP Cloud Run (`zap-api`, `zap-executor`), Google Cloud Tasks, and MongoDB Atlas with dynamic runtime environment routing (`production` / `qa`).

---

## 🛠️ Available Agent Skills

- [`build`](file:///.agents/skills/build/SKILL.md): Prompt-to-implementation workflow with gated clarification, test-driven verification, and capped iterations.
- [`frontend-design`](file:///.agents/skills/frontend-design/SKILL.md): Distinctive, intentional UI/UX design guidance for Next.js and Tailwind CSS components.
