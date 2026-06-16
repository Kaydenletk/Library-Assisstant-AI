# Live Retrieval Steps in the Chat UI — Design

**Date:** 2026-06-16
**Status:** Approved, pre-implementation

## Goal

Surface the retrieval pipeline **as it runs**, live in the chat UI, so a viewer
watches the RAG "think": hybrid search → refusal gate → LLM rerank, with the
real counts and similarity scores. The pipeline is the project's differentiator;
right now it's invisible behind a generic "Searching the docs…" line. Making it
visible is the highest impression-per-effort lever for an AI-role audience.

Honesty constraint: every step shown reflects a real stage that actually
executed. No faked or time-animated stages — the project's whole pitch is
honesty, so the trace must be truthful.

## Mechanism

AI SDK v6 **custom data parts**. The `searchDocs` tool's `execute` closes over
the UI-message-stream `writer` and emits a `data-retrieval` part keyed by the
tool call's `toolCallId`. Writing the same `id` repeatedly reconciles
(overwrites) the part on the client, so a single panel updates progressively as
stages complete. This rides the existing SSE stream — no polling, no new
endpoint. The route already uses `createUIMessageStream` + `writer.write` for
the graph branch, so the transport is proven in this codebase.

## Data shape

One cumulative snapshot, extended at each stage and re-written under the same id:

```ts
export interface RetrievalProgress {
  query: string;
  version?: 'v1' | 'v2';
  candidates?: number;     // set after hybrid retrieve
  gatePassed?: boolean;    // set after the confidence gate
  topSimilarity?: number;  // set after the gate (best cosine sim)
  reranked?: number;       // set after rerank (final count)
  attempt?: number;        // graph mode only: corrective-RAG retry number
  status: 'searching' | 'reranking' | 'done' | 'refused';
}
```

The pipeline owns this shape; the route only forwards snapshots to the writer.

## Core constraint: do not break CLI / MCP

`searchDocs` (`lib/agent/tools.ts`) is shared via `agentConfig` (`config.ts`) by
the CLI (`generateText` in `answer.ts`) and the MCP server. Those paths have no
stream writer and must stay unchanged.

Resolution:

1. **Extract** the pipeline into `lib/agent/retrieval-pipeline.ts`:
   `runRetrieval(query, { version?, onStep? })`. It runs the existing
   `hybridSearch → hasConfidentMatch → rerank` logic unchanged and, when
   `onStep` is provided, calls it with a cumulative `RetrievalProgress` snapshot
   after each stage. Returns the same `{ relevant, results }` shape `searchDocs`
   returns today.
2. **Factory** in `tools.ts`: `createSearchDocs(emit?)` returns the tool.
   `execute` reads `toolCallId` from its second arg and, when `emit` is set,
   passes `onStep = (snap) => emit(toolCallId, snap)` into `runRetrieval`.
   Default export `searchDocs = createSearchDocs()` (no emit) — so `agentConfig`,
   CLI, and MCP are byte-for-byte identical in behavior.
3. **Route** builds the writer-aware variant:
   `createSearchDocs((id, snap) => writer.write({ type: 'data-retrieval', id, data: snap }))`,
   and wraps `streamText` in `createUIMessageStream`, merging the model stream
   via `writer.merge(result.toUIMessageStream())`.

## Graph mode (phase 2)

`answerWithGraph` gains an optional `onStep` param threaded into the nodes:
`rewrite` (emits query + attempt), `retrieve` (candidates, reranked), `grade`
(gatePassed), `generate`/`refuse` (status). Reuses `RetrievalProgress` with the
`attempt` field, written under a stable id `'graph'`. The same `RetrievalSteps`
component renders it. The agent path (phase 1) ships independently of this.

## Client

- **New** `components/chat/RetrievalSteps.tsx`: renders a `RetrievalProgress`
  snapshot as a vertical step rail. Markers: pending (hollow) → active → done
  (filled check). The query row carries a version chip (reuse the v1/v2 chip
  styling). Gate row shows `0.71 ≥ 0.45`. Rerank row shows `12 → 6`. `refused`
  status renders a terminal "no confident match → refusing" state.
- **`app/page.tsx`**: type the hook as `useChat<ChatMessage>` where
  `ChatMessage = UIMessage<unknown, { retrieval: RetrievalProgress }>`. For each
  assistant message, render its `data-retrieval` part(s) (one per tool call)
  above the prose via `RetrievalSteps`, then the text via `AssistantMessage`.
  This replaces the generic `isThinking` "Searching the docs…" branch: the steps
  panel *is* the thinking state. After the answer lands the panel remains as a
  muted "retrieval trace" above the prose.
- **`app/chat.css`**: step-rail styling using existing OKLCH tokens
  (`--ink-soft`, `--line`, `--accent`, `--v1/--v2` washes). Respect the existing
  `prefers-reduced-motion` guard for the active-marker pulse.

## Files

| File | Change |
| --- | --- |
| `lib/agent/retrieval-pipeline.ts` | **new** — `runRetrieval` + `RetrievalProgress` |
| `components/chat/RetrievalSteps.tsx` | **new** — step-rail renderer |
| `tests/retrieval-pipeline.test.ts` | **new** — onStep snapshot sequence + refusal path (mocks `hybridSearch`/`rerank`) |
| `lib/agent/tools.ts` | `createSearchDocs(emit?)` factory; default export delegates to `runRetrieval` |
| `app/api/chat/route.ts` | wrap `streamText` in `createUIMessageStream`; inject writer-aware tool; graph branch emits steps |
| `lib/agent/graph.ts` | optional `onStep` threaded through nodes (phase 2) |
| `app/page.tsx` | typed messages; render `data-retrieval` parts |
| `app/chat.css` | step-rail styling |
| `lib/agent/config.ts` | unchanged |

## Testing

- **Unit** (`tests/retrieval-pipeline.test.ts`, no creds — mock `hybridSearch` +
  `rerank` per the existing `tools.test.ts` pattern): assert `runRetrieval`
  calls `onStep` with the expected cumulative snapshot sequence for (a) a
  confident-match path (`searching → reranking → done`, with candidates/sim/
  reranked populated) and (b) a refusal path (`searching → refused`, no rerank
  call). Assert the returned `{ relevant, results }` is unchanged from today.
- **Build/typecheck:** `tsc --noEmit` clean; `next build` clean.
- **Manual:** dev server, confirm steps stream live for an answerable query, a
  version-pinned query (chip shows), and an out-of-scope query (refusal terminal
  state). Existing eval (`pnpm eval`) must stay 12/12 — behavior is unchanged,
  only observability is added.

## Build order

1. **Phase 1 — agent path end-to-end:** extract `runRetrieval` → `createSearchDocs`
   factory → route wiring → `RetrievalSteps` + `page.tsx` + css → unit tests →
   verify. Ships standalone.
2. **Phase 2 — graph mode:** thread `onStep` through graph nodes; reuse the UI.

## Risks

- AI SDK v6 method names (`writer.merge`, `result.toUIMessageStream()`,
  data-part typing on `UIMessage`): the route already uses `createUIMessageStream`
  + `writer.write`, confirming the API surface. Verify the exact merge call
  against the installed `ai@6.0.205` during build.
- Multiple tool calls per turn: each gets a distinct `toolCallId` → distinct
  panel, no cross-call overwrite. Confirmed by keying parts on `toolCallId`.
