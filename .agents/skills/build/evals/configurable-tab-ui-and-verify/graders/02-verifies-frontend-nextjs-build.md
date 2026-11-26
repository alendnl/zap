---
type: llm
focus: trace
weight: 1
---

Actually executes npm run build --workspace=ZAP-FE (either directly or via verify_build.sh --frontend) rather than relying solely on the stub npm test console.log script.
