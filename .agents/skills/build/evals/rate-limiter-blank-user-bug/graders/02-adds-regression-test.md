---
type: llm
focus: trace
weight: 1
---

Adds a regression test in ZAP-BE/tests/ verifying that whitespace-only and empty keys share the normalized "anonymous" rate-limit bucket (asserting rate limiting triggers across equivalent blank/whitespace user IDs).
