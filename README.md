# MCP SDK Docs Assistant

> An agentic RAG assistant for the **Model Context Protocol TypeScript SDK** that answers "how do I…?" with **version-correct (v1 vs v2), cited** answers — and **refuses** when the docs don't cover it.

**▶ Live demo: [library-assisstant-ai.vercel.app](https://library-assisstant-ai.vercel.app)**

[![CI](https://github.com/Kaydenletk/mcp-docs-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Kaydenletk/mcp-docs-assistant/actions/workflows/ci.yml)

![Hero](assets/hero.png)

---

## Why this exists

The MCP TypeScript SDK recently went **v1 → v2** with breaking API changes
(`server.tool()` → `registerTool()`, SSE → Streamable HTTP, one package → three).
Generic doc bots (Context7, DeepWiki) have two failure modes that bite developers:

1. **Version-blind** — they mix v1 and v2 snippets, so copy-pasted code breaks.
2. **They never refuse** — ask anything and they hallucinate a confident answer.

This assistant fixes both. That's the differentiator:

| Discipline | How it's enforced |
| --- | --- |
| **Version-correct** | every chunk is tagged `v1`/`v2`; retrieval filters by version; answers label and split them |
| **Cited** | every claim links the exact GitHub source line |
| **Refuses** | enforced in **code**, not the prompt — see below |

![Answer with version-coded citations](assets/answer.png)

---

## The idea worth stealing: refusal as code, not a prompt

Telling a model "don't hallucinate" is a suggestion it ignores under pressure.
Instead, the retrieval tool returns **empty** when nothing clears a confidence
bar — so the model has no material to fabricate from and is forced to refuse:

```ts
const candidates = await hybridSearch(query, { version, limit: 12 });
if (!hasConfidentMatch(candidates)) {          // best cosine sim < 0.45
  return { relevant: false, results: [] };     // model must refuse
}
const results = await rerank(query, candidates, 6);
return { relevant: true, results };
```

---

## Architecture

```text
                       ┌──────────── retrieval pipeline ────────────┐
  question ──► agent ──►│ hybrid search → refusal gate → LLM rerank  │──► cited answer
  (Gemini)    (tool     │ vector + lexical   ↑ refuse    flash-lite  │     or refusal
              calling)  │ fused by RRF       here        scores 0–10 │
                       └─────────────────────────────────────────────┘
                                         │
                                  Postgres + pgvector
                                  570 chunks: 58 v1 · 158 v2 · 354 spec
```

- **Ingestion** (offline): clone the SDK repos (v1 + v2) **and** the protocol spec → chunk by heading → embed → store, each chunk tagged with version + source.
- **Retrieval**: semantic (vector cosine) **fused with** lexical (Postgres full-text) via **Reciprocal Rank Fusion**, then an **LLM cross-encoder rerank**.
- **Generation**: an agent (`generateText` + a `searchDocs` tool, bounded by `stepCountIs`) that cites, splits versions, and refuses.

Three surfaces from one codebase: **web chat**, **CLI**, and an **MCP server**.

### Corrective-RAG loop (`answer:graph`)

The graph variant adds a self-correcting query-rewrite loop on top of the same
retrieval + refusal gate. If retrieval is weak it rephrases and retries; only
when it runs out of tries does it refuse — so it explores before giving up.

```mermaid
flowchart LR
    Q([question]) --> RW[rewrite query]
    RW --> RT["retrieve<br/>(hybrid + rerank)"]
    RT --> GR{confident<br/>match?}
    GR -->|yes| GEN["generate<br/>cited answer"]
    GR -->|weak, tries left| RW
    GR -->|weak, out of tries| REF[refuse]
    GEN --> E([END])
    REF --> E([END])
```

The confidence gate (`hasConfidentMatch`, cosine ≥ 0.45) and `MAX_ATTEMPTS` live
in [`lib/agent/gate.ts`](lib/agent/gate.ts) and [`lib/agent/corrective.ts`](lib/agent/corrective.ts);
the state machine is [`lib/agent/graph.ts`](lib/agent/graph.ts).

---

## Proven, not just demoed

An 18-case golden set (`eval/`) scores the behaviours that matter. `pnpm eval`
runs every case through the live agent and writes a scorecard to
[`docs/eval/REPORT.md`](docs/eval/REPORT.md):

```text
Overall pass        18/18 (100%)
Refusal accuracy     5/5 (100%)
Answer + citation   13/13 (100%)
Version-correctness  5/5 (100%)
```

100% is against this repo's own curated golden set — it proves the system holds
its three-discipline contract on representative questions, not that it's
omniscient. Expanding the set is how regressions get caught.

The harness earned its keep: an earlier run scored **83%** — two answerable
questions were *false-refused* despite strong retrieval (top hits 0.70–0.72,
well above the 0.45 gate). The model was over-refusing by re-judging relevance
itself; the fix was to make refusal defer to the tool's signal. Re-run: 100%,
refusal accuracy still 100%.

How it stacks up against Context7 / DeepWiki on version-isolation and refusal —
the axes generic doc bots can't hold — is in
[`docs/eval/BENCHMARK.md`](docs/eval/BENCHMARK.md).

---

## Meta: it's also an MCP server

The assistant publishes *itself* as an MCP server, so Claude Desktop / Cursor can
call it as a tool — an MCP tool that teaches the MCP SDK.

```bash
pnpm mcp   # stdio server: ask_mcp_docs + search_mcp_docs
```

---

## Tech stack

- **Next.js 16** (App Router) · **AI SDK v6** (`generateText`/`streamText`, tool calling, `embed`)
- **Google Gemini** — `gemini-2.5-flash` (chat), `flash-lite` (rerank), `gemini-embedding-001` (1536-d)
- **Neon Postgres + pgvector** (HNSW cosine) · **Drizzle ORM**
- **Zod** · **Vitest** (80 unit tests, run in CI) · **`@modelcontextprotocol/sdk`**
- **LangGraph** — optional Corrective-RAG variant (see below)

### Bonus: a LangGraph Corrective-RAG variant

The product agent is a lean AI SDK tool-loop. As a showcase of where a graph
framework actually earns its place, `lib/agent/graph.ts` reimplements the agent
as an explicit **LangGraph** state machine that **grades its own retrieval and
re-queries** when it's weak:

```text
rewrite → retrieve → grade ─┬─ confident ──────────► generate ─► END
   ▲                        ├─ weak, tries left ────► (loop back)
   └────────────────────────┘
                            └─ weak, out of tries ──► refuse  ─► END
```

It reuses the same hybrid retrieval + rerank + refusal gate, so the moat is
identical — the graph only adds the self-correcting loop. Run: `pnpm answer:graph "…"`.

---

## Run it

```bash
pnpm install
cp .env.example .env            # add DATABASE_URL + GOOGLE_GENERATIVE_AI_API_KEY
pnpm db:setup && pnpm db:push   # pgvector + schema + full-text index
pnpm ingest                     # clone + embed the corpora (one-time)

pnpm dev                        # web chat at localhost:3000
pnpm answer "how do I register a tool?"   # CLI (AI SDK agent)
pnpm answer:graph "how do I register a tool?"  # CLI (LangGraph Corrective-RAG)
pnpm eval                       # scorecard
pnpm mcp                        # MCP server
```

Deploy + observability: see [DEPLOY.md](DEPLOY.md). Engineering log: [STATUS.md](STATUS.md).

## Roadmap / help wanted

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[`good first issue`](https://github.com/Kaydenletk/mcp-docs-assistant/labels/good%20first%20issue) label.

- [ ] LLM-as-judge faithfulness scoring in the eval harness (RAGAS-style)
- [x] Benchmark methodology vs Context7 / DeepWiki — [`docs/eval/BENCHMARK.md`](docs/eval/BENCHMARK.md) (live comparison columns: help wanted)
- [ ] More corpora (additional protocol revisions, other SDK languages)
- [ ] Conversation history persistence
- [ ] Dark theme
- [ ] Show retrieval/tool steps live in the UI

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Khanh Le
