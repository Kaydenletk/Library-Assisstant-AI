# Eval Scorecard — MCP TypeScript SDK Doc Assistant

_Generated 2026-06-16 · 18 cases · `pnpm eval`_

Scores the three product disciplines: refuse when the docs do not cover it, cite every claim, and keep version-pinned answers in their version.

| Axis | Score | Measures |
| --- | --- | --- |
| Overall pass | 18/18 (100%) | All cases |
| Refusal accuracy | 5/5 (100%) | Refuses out-of-scope questions |
| Answer + citation | 13/13 (100%) | Answers in-scope questions, grounded by a source |
| Version-correctness | 5/5 (100%) | v1/v2-pinned answers cite only that version |

## Cases

| ID | Expect | Version | Result | Citations |
| --- | --- | --- | --- | --- |
| tool-register | answer | — | ✓ pass | 2 [v2,v1] |
| prompts | answer | — | ✓ pass | 1 [v2] |
| resources | answer | — | ✓ pass | 3 [v1,v2] |
| client-connect | answer | — | ✓ pass | 3 [v2,v1] |
| transport-overview | answer | — | ✓ pass | 8 [v1,v2,2025-11-25] |
| v2-streamable | answer | v2 | ✓ pass | 6 [v2] |
| v2-register | answer | v2 | ✓ pass | 4 [v2] |
| v2-packages | answer | v2 | ✓ pass | 5 [v2] |
| v1-tool | answer | v1 | ✓ pass | 2 [v1] |
| v1-sse | answer | v1 | ✓ pass | 2 [v1] |
| spec-auth | answer | — | ✓ pass | 12 [2025-11-25] |
| spec-lifecycle | answer | — | ✓ pass | 6 [2025-11-25] |
| spec-jsonrpc | answer | — | ✓ pass | 6 [v1,v2] |
| refuse-k8s | refuse | — | ✓ pass | refused |
| refuse-pytorch | refuse | — | ✓ pass | refused |
| refuse-weather | refuse | — | ✓ pass | refused |
| refuse-python-sdk | refuse | — | ✓ pass | refused |
| refuse-stripe | refuse | — | ✓ pass | refused |
