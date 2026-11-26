---
tags: [skill-creator]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Fix a bug in ZAP-BE/app/submissions/rate_limiter.py: right now ZAP-BE/app/submissions/router.py strips payload.userId before passing it to rate_limiter.check_rate_limit(user_key), but calling rate_limiter.check_rate_limit("   ") directly in unit tests or other callers treats whitespace-only keys separately from empty keys. Normalize user_id with .strip() (falling back to "anonymous" if empty) inside SubmissionRateLimiter.check_rate_limit, add a regression test in ZAP-BE/tests/, and verify the fix.
