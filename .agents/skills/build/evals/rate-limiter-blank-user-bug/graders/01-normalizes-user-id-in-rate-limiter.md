---
type: llm
focus: trace
weight: 1
---

Normalizes user_id with .strip() (falling back to "anonymous" when empty/whitespace) inside SubmissionRateLimiter.check_rate_limit in ZAP-BE/app/submissions/rate_limiter.py.
