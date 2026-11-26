---
type: llm
focus: trace
weight: 1
---

Explicitly rejects executing student code inside zap-api via subprocess.run(), citing untrusted code isolation / sandbox containment in zap-executor.
