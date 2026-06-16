# Plan 4 — Eval Harness + Benchmark (Design)

**Date:** 2026-06-16
**Status:** Approved, ready for implementation
**Depends on:** Plans 1–3 (ingestion, agentic retrieval + refusal gate, chat UI) — all complete.

## Goal

Measure the three disciplines that are this assistant's moat — **version-correctness**, **refusal discipline**, **citation grounding** — with a reproducible, committed golden set and a deterministic scorer. Produce a scorecard (`docs/eval/REPORT.md`) with real numbers and a qualitative benchmark (`docs/eval/BENCHMARK.md`) versus Context7 / DeepWiki.

Generic QA accuracy is **not** the target. Context7/DeepWiki already index these docs; what they lack is version-awareness and the willingness to refuse. The eval scores exactly those gaps.

## Non-goals (YAGNI)

- No automated benchmark against Context7/DeepWiki — no stable public API, brittle. Benchmark is a documented, hand-run qualitative comparison.
- No LLM-as-judge for answer quality — scoring is deterministic string/structure checks. (Could be added later; not now.)
- No new retrieval/agent behavior. Plan 4 only observes the existing pipeline.

## Architecture

```
eval/golden.jsonl          # committed source of truth — one case per line
lib/eval/
  golden.ts                # zod schema + loader/parser for golden.jsonl (pure)
  score.ts                 # pure scoring: isRefusal, scoreCase, aggregate
  report.ts                # pure: render markdown scorecard + console summary
scripts/
  mine-issues.ts           # one-shot gh miner → candidate questions (documented, not run in CI)
  eval.ts                  # runner: answer mode (default) | --retrieval mode
docs/eval/
  REPORT.md                # generated scorecard (committed)
  BENCHMARK.md             # hand-written qualitative comparison
tests/
  eval-score.test.ts       # isRefusal, scoreCase per kind, aggregate — no creds
  eval-golden.test.ts      # golden.jsonl parses, zod-valid, coverage of each kind — no creds
```

### Unit boundaries

- **`lib/eval/golden.ts`** — defines `GoldenCase` (zod), `parseGolden(text): GoldenCase[]`, `loadGolden(): GoldenCase[]`. No DB/model imports → testable without creds. Validation fails loud on a malformed line.
- **`lib/eval/score.ts`** — all pure functions over strings. The single source of refusal-detection + behavior/version/citation/include checks. No imports from `lib/agent` or `lib/retrieve` (avoids creds), but `isRefusal` is anchored on the exact refusal sentence the system prompt mandates.
- **`lib/eval/report.ts`** — pure render of an aggregate result into markdown + a short console table.
- **`scripts/eval.ts`** — the only unit that touches creds (calls `answer()` or `hybridSearch()`); thin orchestration.

## Golden set

`eval/golden.jsonl`, ~30 cases. JSONL for clean per-line diffs. **Committed file is the source of truth**; `mine-issues.ts` only seeds candidates once.

Schema:

```ts
GoldenCase = {
  id: string;                                   // stable slug, e.g. "v2-register-tool"
  question: string;
  kind: 'answer' | 'refuse';
  version?: 'v1' | 'v2' | 'spec' | 'cross';     // 'cross' = answer must cover BOTH v1 & v2
  mustCiteVersion?: ('v1' | 'v2' | 'spec')[];   // citation tags that must appear
  mustInclude?: string[];                        // case-insensitive substrings expected in answer
  note?: string;
}
```

Coverage targets (≥1 each, enforced by `eval-golden.test.ts`):
- `v1`-only (e.g. `server.tool()`, SSE transport)
- `v2`-only (e.g. `registerTool()`, Streamable HTTP, split packages)
- `cross` (API that differs across versions → both labeled)
- `spec` (protocol-spec questions, e.g. authorization)
- `refuse` (off-domain: deploy on Kubernetes, billing, unrelated libs)

## Scoring (`lib/eval/score.ts`)

`isRefusal(text)` — true when the text matches the mandated refusal sentence
("The MCP TypeScript SDK docs I have don't cover this.") or close variants
("don't cover", "do not cover", "isn't in the docs I have"). Anchored, not fuzzy.

`scoreCase(c: GoldenCase, answerText: string)` →
```ts
{
  behaviorCorrect: boolean;   // refuse-case ⇒ isRefusal; answer-case ⇒ !isRefusal
  versionCorrect: boolean;    // answer-case: required [version] label(s) present; cross ⇒ both [v1] and [v2]
  citationCorrect: boolean;   // ≥1 well-formed "[ver] … — http…" citation for each required version
  includeCorrect: boolean;    // every mustInclude substring present (case-insensitive)
  pass: boolean;              // all applicable checks true
}
```
For `refuse` cases, version/citation/include checks are N/A (treated as pass) — a refusal carries no citations by design.

`aggregate(results)` → overall pass rate + per-metric accuracy (behavior, version, citation, include) + per-kind breakdown (answer vs refuse, and per version tag).

## Run modes (`scripts/eval.ts`)

- **answer mode (default):** runs the full agent `answer(question)` per case, scores the returned text. Needs `GOOGLE_GENERATIVE_AI_API_KEY` + `DATABASE_URL` (same creds as `pnpm answer`). Authoritative scorecard.
- **`--retrieval` mode:** cheaper — per case runs `hybridSearch(question, { version })` + `hasConfidentMatch`, scoring: refusal-gate accuracy (should-refuse cases ⇒ gate returns no confident match), version-in-top-k, and `mustInclude` recall against retrieved chunk content. No chat-model calls. Useful for tuning retrieval/threshold without paying for generation.

Both write a summary to stdout; answer mode writes `docs/eval/REPORT.md`.

## Benchmark (`docs/eval/BENCHMARK.md`)

Hand-written. Methodology + a table of representative queries run against (a) this assistant, (b) Context7, (c) DeepWiki, scored on the moat axes (version-correct? refuses off-domain? cites source?). Demonstrates where version-blind indexers give a v1 answer to a v2 question, or confidently answer off-domain. Feeds the real pass-rate numbers into the README scorecard.

## Testing

- `eval-score.test.ts`: `isRefusal` (positive on refusal sentence + variants, negative on real answers), `scoreCase` for each kind (answer/v1, answer/v2, cross, spec, refuse), `aggregate` math. AAA structure.
- `eval-golden.test.ts`: `parseGolden` round-trips, zod rejects a malformed case, coverage assertion (≥1 of each kind), all ids unique.
- All no-creds (pure). Existing 42 tests stay green.

## package.json scripts

```
"eval": "tsx scripts/eval.ts",
"eval:retrieval": "tsx scripts/eval.ts --retrieval",
"mine-issues": "tsx scripts/mine-issues.ts"
```

## Definition of Done

- Golden set committed, zod-valid, covers all five kinds.
- `pnpm eval` runs live, writes `docs/eval/REPORT.md` with real pass rates.
- `BENCHMARK.md` written with hand-run comparisons.
- New tests pass; full suite + typecheck green.
- STATUS.md Plan 4 marked complete; README scorecard wired to real numbers.
