# Status — MCP TypeScript SDK Doc Assistant

**What this is:** A version-correct, refusal-disciplined documentation assistant for the **MCP TypeScript SDK** (`@modelcontextprotocol/sdk`). Agentic RAG over the SDK docs that answers "how do I do X?" with **version-correct (v1 vs v2), cited** answers and **refuses** when the docs don't cover something. Portfolio piece for General SWE + AI roles.

**Differentiator:** Context7 / DeepWiki index these docs but aren't version-aware and won't refuse, and there's no official MCP doc bot. The v1 (`@modelcontextprotocol/sdk@1.29.0`) vs v2 (`2.0.0-alpha` — split `@modelcontextprotocol/server`/`client`/`node` packages, `server.tool()` → `registerTool()`, SSE → Streamable HTTP) split is the moat.

---

## Current status: Plan 1 (Foundation) — ✅ COMPLETE, running end-to-end

**✅ Done, tested, verified live:**
- Next.js 16 + AI SDK v6 + Drizzle + Vitest scaffold
- Ingestion pipeline: clone SDK repo @ `v1.29.0` → read `docs/*.md` + `README.md` → chunk by heading → embed → pgvector
- Cited cosine retrieval (`lib/retrieve/search.ts`)
- **9/9 unit tests pass**; **typecheck clean**
- **DB live**: `db:setup` (pgvector), `db:push` (`chunks` table) on Neon — done
- **Ingest live**: **58 chunks** embedded + stored
- **`ask` works**: ranked chunks with `[v1] …/blob/v1.29.0/…` citations; top hit for "how do I register a tool" = `server > Tools` @ 0.710

### ⚠️ Provider pivot (deviation from original plan)

Vercel AI Gateway was wired originally, but the gateway account could not run inference (every authed endpoint 401 — only the public `/v1/models` list worked, even after claiming $5 credits). **Pivoted embeddings to Google Gemini direct:**

| Aspect | Original plan | Now |
| --- | --- | --- |
| Provider | Vercel AI Gateway | **Google Gemini** (`@ai-sdk/google`) |
| Model | `openai/text-embedding-3-small` | `gemini-embedding-001` |
| Dim | 1536 | 1536 (Matryoshka `outputDimensionality` truncation from 3072 — pgvector HNSW caps at 2000) |
| Env var | `AI_GATEWAY_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` |

Shared embedding config lives in `lib/embed/model.ts` (`embeddingModel` + `embedProviderOptions` + `EMBED_DIMENSIONS`), imported by `embed-store.ts`, `search.ts`, and `schema.ts` so model/dim never drift. To revert to Gateway later (Plan 5), swap only that file.

### pnpm 11 build-script gotcha (fixed)

pnpm 11 runs `pnpm install` before every `pnpm <script>` (`verify-deps-before-run`), which hard-failed on unapproved native build scripts (esbuild/sharp/unrs-resolver). Fixes committed: `package.json` `pnpm.onlyBuiltDependencies` + `.npmrc` `verify-deps-before-run=false`. If `pnpm <script>` still errors, run bins directly: `node_modules/.bin/tsx scripts/ingest.ts`, etc.

### Re-run the pipeline

```bash
pnpm db:setup && pnpm db:push && pnpm ingest && pnpm test && pnpm ask "how do I register a tool on an MCP server?"
```

---

## Roadmap (full detail in the plan)

Plan file: `docs/superpowers/plans/2026-06-15-foundation-ingestion-retrieval.md`

- **Plan 2** — ✅ **COMPLETE.**
  - ✅ **v2 corpus ingested** — multi-version ingest refactor: `lib/ingest/repo.ts` now exports `SOURCES: CorpusSource[]` (v1 `v1.29.0` + v2 `@modelcontextprotocol/server@2.0.0-alpha.2`, URLs pinned to commit `0021561` since the v2 tag has slashes). `read.ts` tags each chunk from its source; `embed-store.ts` `clearVersion()` makes re-ingest idempotent. **216 chunks** now: 58 v1 + 158 v2 (incl. `migration.md`/`migration-SKILL.md` — the v1→v2 delta). Verified: "register tool" returns mixed [v1]/[v2]; "v1→v2 migration" returns [v2] migration docs. 10/10 tests.
  - ✅ **Agentic layer + version-correctness + refusal (the moat)** — `lib/agent/`: `answer.ts` runs `generateText` + the `searchDocs` tool with `stopWhen: stepCountIs(5)`. The tool (`tools.ts`, zod `inputSchema`) takes an optional `version` filter and **enforces refusal at the data level** via `gate.ts` (`hasConfidentMatch`, `CONFIDENCE_THRESHOLD = 0.45`): no chunk clears the bar → tool returns `relevant:false` + empty results, so the model has nothing to fabricate from. `search()` gained a `version` filter (signature is now options-object: `search(query, { version, limit, minSimilarity })`). System prompt (`prompt.ts`) mandates cite / refuse / v1-v2 disambiguation. `gate.detectVersion()` reads v1/v2 from query wording. Run: `pnpm answer "..."`. **Verified live:** "register a tool" → both [v1] + [v2], labeled + cited; "in v2, Streamable HTTP" → [v2]-only; "deploy Kubernetes on AWS" → "The MCP TypeScript SDK docs I have don't cover this."
  - ✅ **Protocol-spec corpus** — generalized the ingest pipeline to a second repo. `CorpusSource` now carries `repo`/`repoUrl`/`docsDir`/`fileExts`/`source`/`includeReadme`; `cloneSdkRepo`→`cloneRepo`, `listDocFiles(source)` walks nested dirs recursively. Added the spec repo (`modelcontextprotocol/modelcontextprotocol` @ revision `2025-11-25`, `docs/specification/2025-11-25/**/*.mdx`). New `cleanMdx()` strips Mintlify JSX / import-export / comments while preserving fenced + inline code (TS generics like `Promise<T>`); `readDocFile` prefers the frontmatter `title`. Spec chunks tagged `source:'spec'`, `version:'2025-11-25'` (version-agnostic to the SDK → only surface in unfiltered searches). **570 chunks now**: 58 v1 + 158 v2 + **354 spec**. Verified: "what does the protocol specify about authorization?" → clean `[2025-11-25]` spec citations.
  - **29/29 tests** (added `gate`, `tools` refusal-gate via mocked `search`, `cleanMdx`, `listDocFiles` recursive walk, spec `readDocFile` — all without creds).
  - ✅ **Hybrid search + rerank** — `lib/retrieve/rrf.ts` `rrfFuse()` (Reciprocal Rank Fusion, k=60) merges the semantic (vector cosine) and lexical (Postgres full-text `ts_rank`/`plainto_tsquery`) rankings; RRF doubles as the rerank step (no separate reranker model). `search.ts` now exposes `search()` (vector-only, used by `ask`) and `hybridSearch()` (used by the agent tool). Refusal stays correct: the vector leg is fused first so shared hits keep their cosine similarity, and lexical-only hits carry `similarity:0` → a keyword coincidence alone can't pass the gate. Backed by a GIN index (`chunks_content_fts_idx`, added in `setup-db.ts`). Verified: "what does registerTool do?" (exact API name, lexical's strength) → correct [v2] docs; off-domain query still refuses. **33/33 tests** (added `rrf`).
- **Plan 3** — ✅ **COMPLETE.** Streaming chat UI.
  - **API:** `app/api/chat/route.ts` — `streamText` over the shared `agentConfig` (new `lib/agent/config.ts`, single source of truth reused by the CLI's `generateText` and the route's `streamText`), `messages: await convertToModelMessages(messages)` (v6 returns a Promise), returns `toUIMessageStreamResponse()`. `maxDuration = 60`.
  - **Client:** `app/page.tsx` (`'use client'`) — `useChat` + `DefaultChatTransport({ api: '/api/chat' })`; empty-state intro + `StarterPrompts`, streaming turns, "Searching the docs…" indicator while the tool runs, auto-scroll, stop button.
  - **Rendering:** pure, unit-tested helpers in `lib/ui/` — `citations.ts` (`parseCitations` lifts inline `[v2] heading — url` into chips; `splitInlineCode`), `blocks.ts` (`splitCodeBlocks` → styled `<pre>`). Components in `components/chat/` (`AssistantMessage`, `CitationChip`, `Composer`, `StarterPrompts`).
  - **Design:** technical-editorial, light "paper" direction (not dark-by-default); OKLCH tokens in `globals.css`, layout in `app/chat.css`; **version-coded citation chips** (v1 amber / v2 violet / spec teal) linking the exact GitHub source; designed hover/focus/active states; reduced-motion guard. Fixed-height grid with internally-scrolling thread (no composer overlap).
  - **Verified:** `next build` clean (`/` static, `/api/chat` dynamic); streaming confirmed via curl (tool call → text); Playwright screenshots of empty state + a live answer (code block + v1/v2 chips). **42/42 tests** (added `rrf`, `citations-ui`, `blocks`). Run: `pnpm dev`.
- **Plan 4** — eval harness (golden set mined from the repo's `bug`/`question` issues, tagged v1/v2 + should-refuse) + benchmark vs Context7/DeepWiki.
- **Plan 5** — deploy + publish the assistant itself as an MCP server to the official registry. Switch to OIDC auth via `vercel env pull`.

---

## Resuming in a fresh Claude Code session

Open Claude Code **in this folder** and say:

> Read `STATUS.md` and `docs/superpowers/plans/2026-06-15-foundation-ingestion-retrieval.md`. Continue from the pending DB steps, then Plan 2.

The plan is self-contained (written for an engineer with zero context), so a new session picks it up cleanly. Everything is in git.

---

## Key facts (don't re-derive)

- Pinned SDK refs: **v1 `v1.29.0`**; **v2 `@modelcontextprotocol/server@2.0.0-alpha.2`** (all alpha.2 package tags peel to monorepo commit `0021561…`, used for v2 blob URLs since the tag name has slashes). Sources defined in `lib/ingest/repo.ts` (`SOURCES`); verified via `git ls-remote --tags`.
- Embeddings: `gemini-embedding-001` (1536-dim, truncated via `outputDimensionality`) via Google Gemini direct (`@ai-sdk/google`); `embed` / `embedMany` from `ai`. Config centralized in `lib/embed/model.ts`. (Originally `openai/text-embedding-3-small` via Vercel AI Gateway — see provider-pivot note above.)
- Store: Neon Postgres + pgvector; HNSW `vector_cosine_ops`; similarity = `1 - cosineDistance`.
- Docs are ingested by **cloning the repo** (the docs site `ts.sdk.modelcontextprotocol.io` is TypeDoc — no `llms.txt`/sitemap, do not scrape). Clone lands in `.cache/mcp-sdk` (gitignored).
- `chunks` columns: `content, heading, url, version ('v1'|'v2'), source ('sdk-docs'|'readme'|'spec'), embedding`.
- Implementation notes vs the plan: `formatCitation` lives in `lib/retrieve/citation.ts` (pure, no DB import, so its test runs without creds); `lib/db/client.ts` is lazy-init (importing it doesn't require `DATABASE_URL`).
- Env: a single `.env` (gitignored) loaded everywhere via `lib/load-env.ts`. `.env.example` is the committed template.
