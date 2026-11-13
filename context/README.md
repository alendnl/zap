# ZAP Six-File Context Architecture

Welcome to the **Six-File Context System** for the **ZAP** platform.

This directory serves as the persistent, single source of truth for both human engineers and AI coding agents (Antigravity IDE, Cursor, Claude Code, Devin, and ChatGPT). Instead of relying on fragmented prompts or ephemeral chat history, all domain knowledge, architectural boundaries, coding standards, and project state are maintained in these six structured files.

---

## 📂 The Six Core Context Files

| # | File | Purpose | Key Contents |
|---|---|---|---|
| **01** | [`01-project-overview.md`](file:///Users/apilav068@apac.comcast.com/zap/context/01-project-overview.md) | **Product Vision & Boundaries** | Executive summary, target personas (students, faculty, admins), core product flows, and explicit out-of-scope non-goals. |
| **02** | [`02-architecture.md`](file:///Users/apilav068@apac.comcast.com/zap/context/02-architecture.md) | **System Architecture & Invariants** | Monorepo layout, system topology, loose coupling rules, untrusted code sandbox isolation, multi-tenant `X-ZAP-ENV` routing, supported language runtimes, and submission state lifecycle. |
| **03** | [`03-code-standards.md`](file:///Users/apilav068@apac.comcast.com/zap/context/03-code-standards.md) | **Engineering Standards & Guardrails** | Defensive engineering rules (fail fast, zero-trust, backward compatibility), clarity principles, Python/FastAPI conventions, Next.js/TypeScript standards, testing standards, and performance anti-patterns. |
| **04** | [`04-workflow-rules.md`](file:///Users/apilav068@apac.comcast.com/zap/context/04-workflow-rules.md) | **AI Workflow & Collaboration** | Senior engineering partner operating model, push-back guidelines, prompt-to-implementation loop, strict verification gates, and capped iteration guardrails. |
| **05** | [`05-ui-context.md`](file:///Users/apilav068@apac.comcast.com/zap/context/05-ui-context.md) | **UI & Design System** | Dark-mode first aesthetic, design tokens (`globals.css`), typography (Inter + JetBrains Mono), status badges, split-pane layout, Monaco Editor integration, and UX standards. |
| **06** | [`06-progress-tracker.md`](file:///Users/apilav068@apac.comcast.com/zap/context/06-progress-tracker.md) | **State & Architecture Decisions** | Development roadmap phases, completed milestones, active focus areas, and Architectural Decision Records (ADRs). |

---

## 🔄 Relationship with IDE Rules & Skills

The Six-File Context system harmonizes with existing agent harness files without breaking anything:
- **`AGENTS.md`**: Points directly to this `context/` directory as the foundational knowledge base.
- **`.agents/rules/`**: Rules in `.agents/rules/` (`architecture-rules.md`, `coding-principles.md`, `workflow-guidelines.md`) link directly to their corresponding context files (`02-architecture.md`, `03-code-standards.md`, `04-workflow-rules.md`), ensuring that automated agent harnesses and background scripts remain 100% backward-compatible.
- **`.agents/skills/`**: The `build` and `frontend-design` skills draw upon `context/` for context gathering and verification.

