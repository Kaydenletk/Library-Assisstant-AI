---
title: Building a RAG That Refuses to Hallucinate
published: false
tags: ai, rag, typescript, webdev
cover_image:
---

Most "chat with your docs" demos have two quiet failures: they **mix up versions**
of an API, and they **never admit when they don't know**. I built a documentation
assistant for the Model Context Protocol (MCP) TypeScript SDK that fixes both —
and the fixes turned out to be the interesting engineering.

**Live demo:** https://library-assisstant-ai.vercel.app
**Code (MIT):** https://github.com/Kaydenletk/mcp-docs-assistant

## The problem

The MCP TypeScript SDK recently jumped v1 → v2 with breaking changes:
`server.tool()` → `registerTool()`, SSE → Streamable HTTP, one package → three.
Generic doc bots index both versions and blend them, so the snippet you copy
doesn't compile. They also hallucinate confidently when the docs don't cover
your question.

## What RAG actually is

Retrieval-Augmented Generation: don't trust the model's memory. Put the real docs
in a database, fetch the relevant slice per question, and make the model answer
**only** from that slice — with citations. I chunk the SDK docs by heading, embed
each chunk with Gemini, and store them in Postgres + pgvector. So far, standard.

## Fix #1: version-correctness is a database column

Every chunk is tagged `v1`, `v2`, or `spec` at ingest time. Retrieval can filter
by version, and the agent presents both side-by-side when they differ. The
differentiator isn't a clever prompt — it's one column on the table.

## Fix #2: refusal as code, not a prompt

Telling a model "don't hallucinate" is a suggestion it ignores under pressure.
Instead, the retrieval tool returns **empty** when nothing clears a confidence bar:

    const candidates = await hybridSearch(query, { version, limit: 12 });
    if (!hasConfidentMatch(candidates)) {     // best cosine sim < 0.45
      return { relevant: false, results: [] }; // nothing to fabricate from
    }
    return { relevant: true, results: await rerank(query, candidates, 6) };

Ask it "how do I deploy Kubernetes on AWS?" and it says *"The MCP TypeScript SDK
docs I have don't cover this."* — because it was handed nothing to make up an
answer from. You engineer the behavior instead of begging for it.

## Better retrieval: hybrid + rerank

Vector search is fuzzy on exact API names like `registerTool`. So I run two
searches — semantic (vector) and lexical (Postgres full-text) — and fuse them with
**Reciprocal Rank Fusion**, then an LLM reranks the top candidates. Classic
"fetch many cheaply, rank few accurately." The vector leg is fused first so a
keyword-only coincidence can't sneak past the refusal gate.

## Proving it: the eval harness earned its keep

I wrote a 12-case golden set scoring refusal accuracy, citation grounding, and
version-correctness. First run: **83%**. Two answerable questions were
*false-refused* — but retrieval was fine (top hits 0.70–0.72, well above the 0.45
gate). The model was over-refusing by re-judging relevance itself. The fix:
make refusal defer to the tool's signal. Re-run: **100%**, refusal accuracy
still 100%.

That loop — measure, find a real defect, hypothesize, verify with data, fix,
re-measure — is the difference between "I built a RAG" and "I can improve one."

## Two bonus angles

- **It's also an MCP server.** The assistant publishes itself via MCP, so Claude
  Desktop / Cursor can call it as a tool — an MCP tool that teaches the MCP SDK.
- **Two agent backends.** A lean Vercel AI SDK tool-loop (default), and a
  LangGraph **Corrective-RAG** graph that rewrites the query and retries when
  retrieval is weak. Toggle between them in the UI.

## Stack

Next.js 16 · AI SDK v6 · Google Gemini · Neon Postgres + pgvector · Drizzle ·
LangGraph · Vitest (58 tests).

## Try it / contribute

Demo and code are linked above. There are `good first issue`s open (dark theme,
copy buttons, more eval cases, LLM-as-judge faithfulness) if you want to jump in.

What would you add to make a RAG more trustworthy? I'd love to hear it.
