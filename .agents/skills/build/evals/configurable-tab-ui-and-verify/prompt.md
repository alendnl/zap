---
tags: [skill-creator]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Add a strictly typed helper `getTabSummary()` to ZAP-FE/src/config/tabs.ts that returns `{ enabledTabs, disabledTabs, defaultTab }` (using existing types, no `any`), and check whether the frontend builds cleanly and if anything else is needed before considering it verified.
