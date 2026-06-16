# Show HN draft

**Title** (≤ 80 chars):

```
Show HN: A version-aware RAG for the MCP SDK that refuses when unsure
```

**URL:** https://library-assisstant-ai.vercel.app  (submit the demo, not the repo)

**First comment** (post right after submitting):

```text
I kept getting broken code from doc bots because the MCP TypeScript SDK just went
v1 → v2 with big breaking changes (server.tool() → registerTool(), SSE →
Streamable HTTP, one package → three). Tools like Context7/DeepWiki mix the two
versions and never say "I don't know" — so you copy a snippet and it doesn't compile.

So I built an agentic RAG assistant with two disciplines:

1. Version-correctness — every doc chunk is tagged v1/v2/spec; answers label and
   split them, and you can pin a version.
2. Refusal enforced in code, not the prompt — the retrieval tool returns *empty*
   when nothing clears a confidence bar, so the model has no material to
   fabricate from. "Deploy k8s on AWS?" → "the docs don't cover this."

Retrieval is hybrid (vector + Postgres full-text, fused with Reciprocal Rank
Fusion) + an LLM reranker. There's an eval harness (golden set) that caught a
real over-refusal bug — first run scored 83% because the model was re-judging
relevance itself; making refusal defer to the tool's signal took it to 100%.

It also publishes *itself* as an MCP server (an MCP tool that teaches the MCP
SDK), and has two interchangeable agent backends: a Vercel AI SDK tool-loop and
a LangGraph Corrective-RAG graph that re-queries when retrieval is weak.

Stack: Next.js 16, AI SDK v6, Gemini, Neon + pgvector, Drizzle, LangGraph.
Code (MIT): https://github.com/Kaydenletk/mcp-docs-assistant

Happy to talk about the refusal gate or the hybrid retrieval — both were the
fun parts.
```

**Tips:** post weekdays ~8–10am ET. Never ask for upvotes (HN penalizes it).
Reply to every comment fast — early engagement is what ranks it.
