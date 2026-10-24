# ZAP Frontend Architecture

The frontend is built with **Next.js 15 (App Router)** and **React 19**, styled using **Tailwind CSS**, and features an embedded **Monaco Code Editor**.

---

## 1. Directory Structure

```text
ZAP-FE/src/
├── app/
│   ├── layout.tsx             # Root layout with ThemeProvider & font loading
│   ├── page.tsx               # Primary Student Coding Arena & Problem Workspace
│   ├── globals.css            # Base Tailwind styles & custom animations
│   ├── login/page.tsx         # User login & signup page
│   └── faculty/
│       ├── questions/page.tsx # Faculty question management dashboard
│       └── questions/new/page.tsx # Question authoring form with test-case builder
├── components/                # Reusable UI components (Editor, Panels, Navigation)
├── context/
│   └── ThemeContext.tsx       # Dark / Light mode state provider
├── services/
│   ├── compilerApi.ts         # Fast interactive playground API runner
│   ├── submissionsApi.ts      # Asynchronous submission creation & polling
│   ├── questionsApi.ts        # Problem listing and retrieval
│   ├── authApi.ts             # Auth session client
│   └── environment.ts         # Multi-tenant runtime environment switcher
└── types/                     # Shared TypeScript interfaces
```

---

## 2. Key Pages & Features

### 2.1 Student Coding Arena (`/`)
- **Problem Navigator**: Browse questions filtered by difficulty and tag.
- **Problem Statement Panel**: Markdown description, constraints, and visible example test cases.
- **Monaco Code Editor**: Multi-language support (Python, JS, Java, C++, C) with syntax highlighting, indentation, and starter templates.
- **Run vs. Submit Action**:
  - **Run Code**: Asynchronously triggers `RUN` mode on visible test cases for quick feedback.
  - **Submit Solution**: Evaluates against hidden and public test cases, displaying detailed test results or pass/fail verdict badges.
- **Execution Console & Output**: Real-time terminal output displaying stdout, stderr, compile errors, and timing metrics.

### 2.2 Faculty Management (`/faculty/questions`)
- Dashboard to create, preview, edit, and delete questions.
- Multi-language starter code generator.
- Interactive test-case editor with `PUBLIC` vs `HIDDEN` toggles.

---

## 3. Services & Environment Context

### 3.1 Environment Switcher (`services/environment.ts`)
Allows toggling between **Production** and **QA** directly in the browser:

- Injects the `X-ZAP-ENV` header into all outgoing HTTP calls to `zap-api`.
- Controlled via `NEXT_PUBLIC_ENABLE_QA_ENV` environment variable.
- Emits `zap:environment-change` event so active views re-fetch question data immediately upon toggle.

```typescript
// services/environment.ts
export type ZAPEnvironment = "qa" | "production";
export const ENVIRONMENT_HEADER = "X-ZAP-ENV";

export function getEnvironment(): ZAPEnvironment {
  if (!ENABLE_QA_ENVIRONMENT) return "production";
  return localStorage.getItem("zap.environment") === "qa" ? "qa" : "production";
}
```

### 3.2 Submission Polling (`services/submissionsApi.ts`)
Because code execution is asynchronous:
1. `submissionsApi.create(payload)` returns `{ submissionId, status: "QUEUED" }`.
2. The frontend polls `GET /api/v1/submissions/{submissionId}` at 600ms intervals.
3. Polling halts as soon as `status` reaches `COMPLETED` or `FAILED`.

---

## 4. Build & Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API | `https://zap-api-394729648143.us-central1.run.app` |
| `NEXT_PUBLIC_ENABLE_QA_ENV` | Enable or disable the QA environment switcher in UI | `true` or `false` |
