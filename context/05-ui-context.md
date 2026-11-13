# 05. UI & Design Context: ZAP Platform

## 1. Aesthetic Direction & Design Philosophy
ZAP is a developer-focused, high-focus competitive programming environment. The design prioritizes:
- **Dark-Mode First**: Built for extended, eye-strain-free coding sessions.
- **High Information Density with Visual Breathing Room**: Content, problem statements, and terminal logs must be readable without cluttered visual noise.
- **Immediate State Feedback**: Clear, unambiguous status badges for execution states (Pending, Running, Accepted, Wrong Answer, TLE, Compile Error).
- **Zero-Distraction Editor Canvas**: The code editor is the hero component of the student experience.

---

## 2. Design Tokens & Theme Palettes

### 2.1 CSS Variables (`globals.css`)

| Token | Light Theme | Dark Theme (Default/Primary) | Usage |
|---|---|---|---|
| `--background` | `#f8fafc` (Slate 50) | `#0b0f17` (Deep Obsidian) | Page canvas background |
| `--foreground` | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | Primary text color |
| `--panel` | `#ffffff` (White) | `#121824` (Subtle Navy Surface) | Card / Panel background |
| `--panel-muted` | `#f1f5f9` (Slate 100) | `#0e1420` (Darker Inset) | Editor tabs, header bars, inputs |
| `--border` | `#e2e8f0` (Slate 200) | `#1e293b` (Slate 800) | Panel dividers, card borders |
| `--border-muted` | `#cbd5e1` (Slate 300) | `#161e2e` (Muted Slate) | Subtle inner borders |
| `--accent` | `#2563eb` (Blue 600) | `#3b82f6` (Blue 500) | Primary buttons, active indicators |

### 2.2 Status & Verdict Colors

| Verdict / Status | Tailwind Classes | Hex Equivalent | Usage |
|---|---|---|---|
| **Accepted (`ACCEPTED`)** | `text-emerald-400 bg-emerald-500/10 border-emerald-500/20` | `#10b981` | Successful submission, passed tests |
| **Wrong Answer (`WRONG_ANSWER`)** | `text-rose-400 bg-rose-500/10 border-rose-500/20` | `#f43f5e` | Failed test case comparison |
| **Time Limit (`TIME_LIMIT_EXCEEDED`)** | `text-amber-400 bg-amber-500/10 border-amber-500/20` | `#f59e0b` | Execution timeout |
| **Compile / Runtime Error** | `text-red-400 bg-red-500/10 border-red-500/20` | `#ef4444` | Syntax errors, uncaught exceptions |
| **Queued / Running** | `text-sky-400 bg-sky-500/10 border-sky-500/20 animate-pulse` | `#38bdf8` | Background evaluation in progress |

---

## 3. Typography & Font Hierarchy

- **UI / Headings / Prose**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Crisp readability at 13px–15px for dense problem descriptions and metadata pills.
- **Code / Editor / Console**: `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`
  - High-legibility monospaced typeface for Monaco Editor, starter code templates, stdin/stdout blocks, and execution timers.

---

## 4. Layout Architecture & Component Hierarchy

### 4.1 Student Coding Arena (`/`)
The primary interface uses a responsive two-column split-pane layout:

```text
+------------------------------------------------------------------------------------+
|  ZAP Logo   [Problem Selector]   [Lang: Python v]   [Env: QA | Prod]   [User Profile]|
+------------------------------------------+-----------------------------------------+
| Left Pane: Problem Workspace             | Right Pane: Code & Output               |
| - Title & Difficulty Badge (Easy/Med/Hard)| - Monaco Editor                         |
| - Tags (e.g. Array, Hash Table)          |   (Full syntax highlighting, tabs)       |
| - Description (Markdown rendered)        |                                         |
| - Constraints (e.g. 1 <= n <= 10^5)      +-----------------------------------------+
| - Sample Test Cases (Inputs / Outputs)   | Console & Test Case Panel               |
|                                          | - Tab 1: Test Cases (Cases 1, 2, 3)     |
|                                          | - Tab 2: Execution Output (Stdout, Logs)|
|                                          +-----------------------------------------+
|                                          | [Run Code (Ctrl+Enter)] [Submit Solution]|
+------------------------------------------+-----------------------------------------+
```

### 4.2 Monaco Editor Integration
- Embedded via `@monaco-editor/react`.
- Integrated language modes: `python`, `javascript`, `java`, `cpp`, `c`.
- Synchronized theme (`vs-dark` in dark mode, `light` in light mode).
- Features enabled: Line numbers, bracket pair colorization, folding, minimap (disabled or small for compact view).

### 4.3 Multi-Tenant Environment Indicator
- Located in the global top header.
- Clearly displays whether the active session targets **Production** or **QA**.
- Clicking toggles the runtime state, updating `localStorage` and broadcasting the event so active problem data refreshes without requiring a full browser reload.

---

## 5. Frontend UX & Accessibility Standards
- **Keyboard Shortcuts**:
  - `Ctrl + Enter` (or `Cmd + Enter`): Trigger **Run Code**.
  - `Ctrl + Alt + Enter` (or `Cmd + Alt + Enter`): Trigger **Submit Solution**.
- **Responsive Degrade**: Graceful stack into vertical tabs on viewports under 1024px.
- **Scrollbar Styling**: Custom sleek 6px transparent scrollbars for comfortable reading without layout shifts.

