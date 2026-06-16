# Social drafts (X / LinkedIn)

Attach `assets/answer.png` (or a screen recording) to either — visuals 2–3× the reach.

---

## X / Twitter thread

**1/**
```
Most "chat with your docs" bots do two things badly:
they mix up API versions, and they never say "I don't know."

So I built one that does neither — for the MCP TypeScript SDK.

Live: https://library-assisstant-ai.vercel.app 🧵
```

**2/**
```
The MCP SDK just went v1 → v2 with breaking changes
(server.tool() → registerTool(), SSE → Streamable HTTP).

Every doc chunk is tagged v1/v2/spec, so answers tell you
WHICH version they belong to — and cite the exact source line.
```

**3/**
```
The fun part: refusal is enforced in CODE, not the prompt.

If retrieval finds nothing confident, the tool returns EMPTY —
so the model has nothing to hallucinate from.

"Deploy k8s on AWS?" → "the docs don't cover this." ✅
```

**4/**
```
I wrote an eval harness to prove it. First run: 83%.

Two answerable questions were wrongly refused — turned out the
MODEL was over-refusing, not retrieval. One fix later: 100%,
with refusal accuracy still 100%.

Measuring > vibes.
```

**5/**
```
Also: it publishes itself as an MCP server (a tool that teaches
the MCP SDK), and has 2 swappable agents — AI SDK + LangGraph.

Stack: Next.js 16 · AI SDK v6 · Gemini · pgvector · LangGraph
Code (MIT): https://github.com/Kaydenletk/mcp-docs-assistant
```

---

## LinkedIn post

```
I built an AI documentation assistant that does something most don't: it refuses
to answer when it isn't sure.

The Model Context Protocol TypeScript SDK recently went v1 → v2 with breaking
changes, and existing doc bots kept mixing the versions and inventing APIs. So I
built a retrieval-augmented assistant with three disciplines:

→ Version-correct: every answer tells you whether it's v1 or v2, and cites the
  exact source.
→ Honest: if the docs don't cover your question, it says so instead of guessing —
  enforced in code, not just a prompt.
→ Proven: a 12-case eval harness scores it. The first run caught a real
  over-refusal bug (83%); a targeted fix took it to 100%.

Under the hood: hybrid retrieval (vector + full-text, fused with Reciprocal Rank
Fusion) + an LLM reranker, two interchangeable agent backends (Vercel AI SDK and
a LangGraph Corrective-RAG graph), and it even publishes itself as an MCP server.

Stack: Next.js 16, AI SDK v6, Google Gemini, Neon Postgres + pgvector, Drizzle,
LangGraph.

Live demo: https://library-assisstant-ai.vercel.app
Code (MIT, open to contributors): https://github.com/Kaydenletk/mcp-docs-assistant

Happy to talk RAG, refusal design, or eval harnesses — what do you think makes an
AI answer trustworthy?

#AI #RAG #TypeScript #LLM #OpenSource
```
