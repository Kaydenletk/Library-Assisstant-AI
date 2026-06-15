# MCP TypeScript SDK Doc Assistant — Plan 1: Foundation (Ingestion + Cited Retrieval) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest the Model Context Protocol (MCP) TypeScript SDK documentation into a pgvector store, then answer a query from a CLI/test with the most relevant chunks and an exact source citation (version + heading + GitHub URL).

**Architecture:** A Node ingestion pipeline shallow-clones the `modelcontextprotocol/typescript-sdk` repo at a pinned ref, reads the hand-written Markdown guides in `/docs/*.md` plus `README.md`, deterministically chunks each file by heading, embeds the chunks with AI SDK v6 `embedMany`, and stores them in Postgres/pgvector via Drizzle. A retrieval function embeds a query, runs a cosine-similarity search, and returns chunks each carrying a citation string that points at the exact GitHub doc file + anchor. No UI, no LLM answer-generation, no agentic routing yet — this slice proves the retrieval foundation everything else builds on.

**Tech Stack:** Next.js 16 (TypeScript, App Router) · AI SDK v6 (`ai`) routed via Vercel AI Gateway · Postgres + pgvector on Neon · Drizzle ORM (`drizzle-orm/neon-http`) · `git` (shallow clone) · `tsx` (scripts) · Vitest (tests).

**Positioning (why this tool exists — drives later plans):** A **version-correct** (hard v1-vs-v2 separation), **refusal-disciplined**, **TS-SDK-specific** assistant for people building MCP servers/clients. Context7 and DeepWiki index these docs but are not version-aware and will not refuse; no official MCP doc bot exists.

**Out of scope for this plan (later plans):** v2 (`2.0.0-alpha`) ingestion, the protocol-spec secondary corpus, agentic query routing, version-correctness reasoning, refusal logic, hybrid search + reranking, the chat UI, the eval harness, deployment, distribution. **This plan ingests v1 only** (`@modelcontextprotocol/sdk@1.29.0`, the maintainers' "recommended for production" line) and delivers: docs in → cited chunks out.

**Prerequisites the implementer must have:**
- A free **Neon** Postgres project; copy its connection string into `DATABASE_URL`.
- A **Vercel AI Gateway** API key in `AI_GATEWAY_API_KEY`.
- `git` and `pnpm` installed.

**Key facts locked from research (do not re-derive):**
- MCP TS SDK docs are **plain Markdown in the repo**, not a docs-site crawl. Primary corpus: `docs/*.md` (8 files — `server.md`, `client.md`, `server-quickstart.md`, `client-quickstart.md`, `migration.md`, `migration-SKILL.md`, `faq.md`, `documents.md`) + `README.md`. The published site `ts.sdk.modelcontextprotocol.io` is TypeDoc with **no `llms.txt`/sitemap** — do NOT scrape it.
- **Ingest by `git clone --depth 1` at a pinned ref**, then read files from disk. v1 and v2 are different git refs / npm packages, so version is a clean ingest-time tag. Foundation ingests **v1 only**.
- Citation URLs point at the GitHub blob at the pinned ref, e.g. `https://github.com/modelcontextprotocol/typescript-sdk/blob/<ref>/docs/server.md#<anchor>`.
- AI SDK v6: embeddings via `embed` / `embedMany` from `ai`, AI Gateway model string `'openai/text-embedding-3-small'` (1536 dims). Result fields are `embedding` / `embeddings` (NOT `.values`).
- Drizzle pgvector: `vector('embedding', { dimensions: 1536 })`, HNSW index `.op('vector_cosine_ops')`, similarity = `1 - cosineDistance(...)`. `CREATE EXTENSION vector` is NOT auto-emitted by Drizzle Kit — run it explicitly.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/schema.ts` | Drizzle table `chunks` (content + citation metadata + `vector` embedding) |
| `lib/db/client.ts` | Neon-backed Drizzle client singleton |
| `lib/load-env.ts` | Side-effect dotenv loader shared by scripts + tests |
| `drizzle.config.ts` | Drizzle Kit config (schema path, dialect, credentials) |
| `scripts/setup-db.ts` | Enable the `vector` extension on Neon (idempotent) |
| `lib/ingest/chunk.ts` | Pure function: Markdown doc → heading-anchored chunks (core TDD unit) |
| `lib/ingest/repo.ts` | Clone the SDK repo at a ref; list the doc files to ingest |
| `lib/ingest/read.ts` | Read a doc file → `DocInput` (title from H1, GitHub blob URL) |
| `lib/ingest/embed-store.ts` | Embed chunks with `embedMany`, insert rows |
| `scripts/ingest.ts` | Orchestrate clone → list → read → chunk → embed-store |
| `lib/retrieve/search.ts` | Embed query, cosine search, return chunks with citations |
| `scripts/ask.ts` | CLI: print cited chunks for a query (manual smoke test) |
| `tests/chunk.test.ts` | Unit tests for `chunkMarkdown` |
| `tests/read.test.ts` | Unit tests for title extraction + blob-URL building |
| `tests/citation.test.ts` | Unit tests for `formatCitation` |
| `tests/search.integration.test.ts` | Integration: seed chunks, assert relevant one ranks first |

---

## Task 1: Scaffold the project

**Files:**
- Create: the Next.js app, `vitest.config.ts`, `lib/load-env.ts`, `.env.example`

- [ ] **Step 1: Scaffold Next.js (run inside the project dir)**

Run from the project root (`…/💻 Dev-Projects/mcp-doc-assistant`). The `docs/` folder already exists; if the scaffolder refuses a non-empty dir, move it aside and back:

```bash
mv docs ../_docs_tmp && pnpm create next-app@latest . --ts --tailwind --app --no-src-dir --import-alias "@/*" --use-pnpm --eslint && mv ../_docs_tmp docs
```

Expected: Next.js files created (`app/`, `package.json`, `tsconfig.json`, etc.).

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
pnpm add ai @neondatabase/serverless drizzle-orm gray-matter
pnpm add -D drizzle-kit tsx dotenv vitest @vitest/coverage-v8
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./lib/load-env.ts'],
  },
});
```

- [ ] **Step 4: Add the env loader (shared by scripts + tests)**

Create `lib/load-env.ts` — a side-effect import that loads `.env` before anything reads `process.env`:

```ts
import { config } from 'dotenv';

config({ path: '.env' });
```

- [ ] **Step 5: Add scripts to `package.json`**

Add these to the `"scripts"` object (keep the Next.js defaults):

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:setup": "tsx scripts/setup-db.ts",
    "db:push": "drizzle-kit push",
    "ingest": "tsx scripts/ingest.ts",
    "ask": "tsx scripts/ask.ts"
  }
}
```

- [ ] **Step 6: Create `.env.example` and the real env file**

Create `.env.example`:
```bash
# Neon Postgres connection string (with ?sslmode=require)
DATABASE_URL=

# Vercel AI Gateway key
AI_GATEWAY_API_KEY=
```

Then:
```bash
cp .env.example .env
# edit .env with your Neon DATABASE_URL and AI_GATEWAY_API_KEY
```
Confirm `.gitignore` contains `.env*` (Next.js adds it by default, so `.env` is never committed). Every script, test, and Drizzle command loads `.env` via `lib/load-env.ts`. (For the deployed app in Plan 5, switch to OIDC auth via `vercel env pull`.)

- [ ] **Step 7: Initialize git and commit the scaffold**

```bash
echo ".cache/" >> .gitignore
git init
git add -A
git commit -m "chore: scaffold Next.js + AI SDK + Drizzle project"
```

Run `pnpm typecheck` first — expect PASS.

---

## Task 2: Database schema, client, and pgvector extension

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `drizzle.config.ts`, `scripts/setup-db.ts`

- [ ] **Step 1: Define the Drizzle schema**

Create `lib/db/schema.ts`:

```ts
import { pgTable, serial, text, vector, index } from 'drizzle-orm/pg-core';

export const chunks = pgTable(
  'chunks',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    heading: text('heading').notNull(), // breadcrumb, e.g. "Server > Registering tools"
    url: text('url').notNull(),         // GitHub blob URL incl. #anchor
    version: text('version').notNull().default('v1'),     // 'v1' | 'v2'
    source: text('source').notNull().default('sdk-docs'), // 'sdk-docs' | 'readme' | 'spec'
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => [
    index('chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
```

- [ ] **Step 2: Create the Drizzle client**

Create `lib/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });
```

- [ ] **Step 3: Create the Drizzle Kit config**

Create `drizzle.config.ts`:

```ts
import './lib/load-env';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 4: Create the extension-setup script**

Create `scripts/setup-db.ts`:

```ts
import '../lib/load-env';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  console.log('pgvector extension ensured.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run setup, then push the schema**

```bash
pnpm db:setup
pnpm db:push
```

Expected: `db:setup` prints `pgvector extension ensured.`; `db:push` reports the `chunks` table created. Accept the table creation if prompted.

- [ ] **Step 6: Commit**

```bash
git add lib/db drizzle.config.ts scripts/setup-db.ts
git commit -m "feat: add chunks schema, Neon client, pgvector setup"
```

---

## Task 3: Markdown chunker (core TDD unit)

**Files:**
- Create: `lib/ingest/chunk.ts`
- Test: `tests/chunk.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/chunk.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '../lib/ingest/chunk';

const base = {
  title: 'Server',
  url: 'https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md',
  version: 'v1',
  source: 'sdk-docs',
};

describe('chunkMarkdown', () => {
  it('splits a doc into one chunk per H2 section plus the lead', () => {
    const markdown = [
      'An MCP server exposes tools and resources.',
      '',
      '## Registering tools',
      '',
      'Call server.tool() to register a tool.',
      '',
      '## Registering resources',
      '',
      'Call server.resource().',
    ].join('\n');

    const chunks = chunkMarkdown({ ...base, markdown });

    expect(chunks).toHaveLength(3); // lead + 2 sections
    expect(chunks[0].heading).toBe('Server');
    expect(chunks[0].url).toBe(base.url);
    expect(chunks[1].heading).toBe('Server > Registering tools');
    expect(chunks[1].url).toBe(base.url + '#registering-tools');
    expect(chunks[2].content).toContain('server.resource()');
  });

  it('carries version and source on every chunk', () => {
    const chunks = chunkMarkdown({ ...base, markdown: '## A\n\ntext' });
    expect(chunks.every((c) => c.version === 'v1' && c.source === 'sdk-docs')).toBe(true);
  });

  it('splits an oversized section into multiple chunks with the same heading', () => {
    const para = 'word '.repeat(120); // ~600 chars
    const markdown = `## Big\n\n${para}\n\n${para}\n\n${para}`; // ~1800 chars > 1500
    const chunks = chunkMarkdown({ ...base, markdown });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.heading === 'Server > Big')).toBe(true);
  });

  it('never splits inside a fenced code block', () => {
    const code = '```ts\n' + 'const x = 1;\n'.repeat(60) + '```';
    const markdown = `## Code\n\nLead.\n\n${code}\n\nTrailer.`;
    const chunks = chunkMarkdown({ ...base, markdown });
    const fenceChunks = chunks.filter((c) => c.content.includes('```ts'));
    expect(fenceChunks).toHaveLength(1);
    const opens = (fenceChunks[0].content.match(/```/g) || []).length;
    expect(opens % 2).toBe(0); // balanced fences — not cut mid-block
  });

  it('drops empty sections', () => {
    const chunks = chunkMarkdown({ ...base, markdown: '## Empty\n\n\n## Real\n\ncontent' });
    expect(chunks.map((c) => c.heading)).toEqual(['Server > Real']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm vitest run tests/chunk.test.ts
```
Expected: FAIL — `chunkMarkdown` not defined.

- [ ] **Step 3: Implement the chunker**

Create `lib/ingest/chunk.ts`:

```ts
export interface DocInput {
  markdown: string;
  title: string;
  url: string;
  version: string;
  source: string;
}

export interface Chunk {
  content: string;
  heading: string; // "Title" or "Title > Section"
  url: string;     // base url, plus #anchor for H2 sections
  version: string;
  source: string;
}

const MAX_CHARS = 1500;

interface Section {
  heading: string;
  anchor: string | null;
  body: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Split markdown into sections by top-level H2 headings, keeping the lead under the title. */
function splitSections(doc: DocInput): Section[] {
  const lines = doc.markdown.split('\n');
  const sections: Section[] = [];
  let heading = doc.title;
  let anchor: string | null = null;
  let buf: string[] = [];
  let inFence = false;

  const flush = () => {
    sections.push({ heading, anchor, body: buf.join('\n').trim() });
    buf = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) inFence = !inFence;
    const isH2 = !inFence && /^##\s+/.test(line);
    if (isH2) {
      flush();
      const text = line.replace(/^##\s+/, '').trim();
      heading = `${doc.title} > ${text}`;
      anchor = slugify(text);
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections.filter((s) => s.body.length > 0);
}

/** Split a section body into <=MAX_CHARS pieces on blank lines, never inside a code fence. */
function packParagraphs(body: string): string[] {
  const lines = body.split('\n');
  const atoms: string[] = []; // a paragraph or a whole code block
  let buf: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) atoms.push(text);
    buf = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      buf.push(line);
      if (!inFence) flush(); // closing fence ends the atom
      continue;
    }
    if (!inFence && line.trim() === '') {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();

  const pieces: string[] = [];
  let current = '';
  for (const atom of atoms) {
    if (current && current.length + atom.length + 2 > MAX_CHARS) {
      pieces.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${atom}` : atom;
  }
  if (current) pieces.push(current);
  return pieces;
}

export function chunkMarkdown(doc: DocInput): Chunk[] {
  const sections = splitSections(doc);
  const chunks: Chunk[] = [];
  for (const section of sections) {
    const url = section.anchor ? `${doc.url}#${section.anchor}` : doc.url;
    for (const content of packParagraphs(section.body)) {
      chunks.push({
        content,
        heading: section.heading,
        url,
        version: doc.version,
        source: doc.source,
      });
    }
  }
  return chunks;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm vitest run tests/chunk.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ingest/chunk.ts tests/chunk.test.ts
git commit -m "feat: add heading-anchored markdown chunker with TDD"
```

---

## Task 4: Clone the SDK repo and list doc files

**Files:**
- Create: `lib/ingest/repo.ts`

- [ ] **Step 1: Verify the v1 git ref to pin**

The npm `latest` is `@modelcontextprotocol/sdk@1.29.0`. Confirm the matching git tag (monorepo tag formats vary), then use whatever the command prints:

```bash
git ls-remote --tags https://github.com/modelcontextprotocol/typescript-sdk.git | grep -E '1\.29\.0'
```
Expected: one or more `refs/tags/...1.29.0` lines. Pick the tag that is the SDK v1 release (e.g. `1.29.0` or `@modelcontextprotocol/sdk@1.29.0`) and use it as `SDK_GIT_REF` below. If no clean tag exists, `main` works but is v2 pre-alpha — prefer the v1 tag for a stable corpus.

- [ ] **Step 2: Implement clone + file listing**

Create `lib/ingest/repo.ts` (set `SDK_GIT_REF` to the tag verified in Step 1):

```ts
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const SDK_REPO = 'https://github.com/modelcontextprotocol/typescript-sdk.git';
export const SDK_GIT_REF = '1.29.0'; // ← set to the tag verified in Step 1
const CACHE_DIR = path.resolve('.cache/mcp-sdk');

/** Shallow-clone the SDK repo at SDK_GIT_REF into .cache (idempotent). Returns the repo root. */
export function cloneSdkRepo(): string {
  if (existsSync(CACHE_DIR)) return CACHE_DIR;
  execSync(
    `git clone --depth 1 --branch ${SDK_GIT_REF} ${SDK_REPO} ${JSON.stringify(CACHE_DIR)}`,
    { stdio: 'inherit' },
  );
  return CACHE_DIR;
}

/** Absolute paths of the doc files to ingest: docs/*.md (minus the TOC) + README.md. */
export function listDocFiles(repoRoot: string): string[] {
  const docsDir = path.join(repoRoot, 'docs');
  const docs = readdirSync(docsDir)
    .filter((f) => f.endsWith('.md') && f !== 'documents.md') // documents.md is just a TOC
    .map((f) => path.join(docsDir, f));
  const readme = path.join(repoRoot, 'README.md');
  return existsSync(readme) ? [readme, ...docs] : docs;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS. (Exercised for real by Task 7's ingest run.)

- [ ] **Step 4: Commit**

```bash
git add lib/ingest/repo.ts
git commit -m "feat: shallow-clone SDK repo and list doc files"
```

---

## Task 5: Read a doc file into a DocInput

**Files:**
- Create: `lib/ingest/read.ts`
- Test: `tests/read.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/read.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractTitle, blobUrl } from '../lib/ingest/read';

describe('extractTitle', () => {
  it('uses the first H1 when present', () => {
    expect(extractTitle('# Building Servers\n\nintro', 'server.md')).toBe('Building Servers');
  });
  it('falls back to a humanized filename when no H1', () => {
    expect(extractTitle('no heading here', 'server-quickstart.md')).toBe('server quickstart');
  });
});

describe('blobUrl', () => {
  it('builds a GitHub blob URL from the repo-relative path', () => {
    expect(blobUrl('docs/server.md', '1.29.0')).toBe(
      'https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md',
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run tests/read.test.ts
```
Expected: FAIL — `extractTitle`/`blobUrl` not defined.

- [ ] **Step 3: Implement the reader**

Create `lib/ingest/read.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocInput } from './chunk';
import { SDK_GIT_REF } from './repo';

const DOC_VERSION = 'v1';

export function extractTitle(markdown: string, fileName: string): string {
  const h1 = markdown.split('\n').find((l) => /^#\s+/.test(l));
  if (h1) return h1.replace(/^#\s+/, '').trim();
  return fileName.replace(/\.md$/, '').replace(/[-_]/g, ' ');
}

export function blobUrl(relPath: string, ref: string): string {
  return `https://github.com/modelcontextprotocol/typescript-sdk/blob/${ref}/${relPath}`;
}

/** Read a doc file into a DocInput. `repoRoot` is the clone dir; `absPath` the file. */
export function readDocFile(absPath: string, repoRoot: string): DocInput {
  const raw = readFileSync(absPath, 'utf8');
  const { content } = matter(raw); // strips frontmatter if any; MCP docs are usually plain md
  const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');
  const fileName = path.basename(absPath);
  const source = fileName === 'README.md' ? 'readme' : 'sdk-docs';
  return {
    markdown: content,
    title: extractTitle(content, fileName),
    url: blobUrl(relPath, SDK_GIT_REF),
    version: DOC_VERSION,
    source,
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm vitest run tests/read.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ingest/read.ts tests/read.test.ts
git commit -m "feat: read doc files into DocInput with title + blob URL"
```

---

## Task 6: Embed and store chunks

**Files:**
- Create: `lib/ingest/embed-store.ts`

- [ ] **Step 1: Implement embed + insert**

Create `lib/ingest/embed-store.ts`:

```ts
import { embedMany } from 'ai';
import { db } from '../db/client';
import { chunks as chunksTable, type NewChunk } from '../db/schema';
import type { Chunk } from './chunk';

const EMBED_MODEL = 'openai/text-embedding-3-small';
const BATCH = 96;

/** Embed chunks and insert them. Returns the number of rows written. */
export async function embedAndStore(chunks: Chunk[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const { embeddings } = await embedMany({
      model: EMBED_MODEL,
      values: slice.map((c) => c.content),
    });
    const rows: NewChunk[] = slice.map((c, j) => ({
      content: c.content,
      heading: c.heading,
      url: c.url,
      version: c.version,
      source: c.source,
      embedding: embeddings[j],
    }));
    await db.insert(chunksTable).values(rows);
    written += rows.length;
  }
  return written;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/ingest/embed-store.ts
git commit -m "feat: batch-embed chunks and store in pgvector"
```

---

## Task 7: Ingestion script (wire it together) and run it

**Files:**
- Create: `scripts/ingest.ts`

- [ ] **Step 1: Implement the orchestrator**

Create `scripts/ingest.ts`:

```ts
import '../lib/load-env';
import { cloneSdkRepo, listDocFiles, SDK_GIT_REF } from '../lib/ingest/repo';
import { readDocFile } from '../lib/ingest/read';
import { chunkMarkdown, type Chunk } from '../lib/ingest/chunk';
import { embedAndStore } from '../lib/ingest/embed-store';

async function main() {
  const repoRoot = cloneSdkRepo();
  const files = listDocFiles(repoRoot);
  console.log(`Ingesting ${files.length} files from MCP TS SDK @ ${SDK_GIT_REF}`);

  const allChunks: Chunk[] = [];
  for (const file of files) {
    const doc = readDocFile(file, repoRoot);
    const chunks = chunkMarkdown(doc);
    allChunks.push(...chunks);
    console.log(`  ${doc.title}: ${chunks.length} chunks`);
  }

  console.log(`Embedding + storing ${allChunks.length} chunks...`);
  const written = await embedAndStore(allChunks);
  console.log(`Done. Wrote ${written} chunks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run ingestion**

```bash
pnpm ingest
```
Expected: clones into `.cache/mcp-sdk`, logs ~9 file titles with chunk counts, then `Wrote N chunks.` (N typically 80–250). If you hit an auth error, confirm `AI_GATEWAY_API_KEY` is set in `.env`.

- [ ] **Step 3: Confirm storage**

The `Wrote N chunks.` line confirms rows were written (the script loads env and inserts via Drizzle). Retrieval over these stored rows is proven end-to-end by Task 8's integration test and `pnpm ask`. No separate query needed here.

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest.ts
git commit -m "feat: end-to-end ingestion of MCP SDK docs"
```

---

## Task 8: Cited retrieval + end-to-end smoke

**Files:**
- Create: `lib/retrieve/search.ts`, `scripts/ask.ts`
- Test: `tests/citation.test.ts`, `tests/search.integration.test.ts`

- [ ] **Step 1: Write the failing citation unit test**

Create `tests/citation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCitation } from '../lib/retrieve/search';

describe('formatCitation', () => {
  it('renders version, heading, and url', () => {
    const c = {
      version: 'v1',
      heading: 'Server > Registering tools',
      url: 'https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md#registering-tools',
    };
    expect(formatCitation(c)).toBe(
      '[v1] Server > Registering tools — https://github.com/modelcontextprotocol/typescript-sdk/blob/1.29.0/docs/server.md#registering-tools',
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run tests/citation.test.ts
```
Expected: FAIL — `formatCitation` not defined.

- [ ] **Step 3: Implement search + citation**

Create `lib/retrieve/search.ts`:

```ts
import { embed } from 'ai';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { chunks } from '../db/schema';

const EMBED_MODEL = 'openai/text-embedding-3-small';

export interface RetrievedChunk {
  content: string;
  heading: string;
  url: string;
  version: string;
  source: string;
  similarity: number;
  citation: string;
}

export function formatCitation(c: { version: string; heading: string; url: string }): string {
  return `[${c.version}] ${c.heading} — ${c.url}`;
}

export async function search(
  query: string,
  limit = 8,
  minSimilarity = 0.3,
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({ model: EMBED_MODEL, value: query });
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`;
  const rows = await db
    .select({
      content: chunks.content,
      heading: chunks.heading,
      url: chunks.url,
      version: chunks.version,
      source: chunks.source,
      similarity,
    })
    .from(chunks)
    .where(gt(similarity, minSimilarity))
    .orderBy((t) => desc(t.similarity))
    .limit(limit);

  return rows.map((r) => ({ ...r, citation: formatCitation(r) }));
}
```

- [ ] **Step 4: Run the citation test to verify pass**

```bash
pnpm vitest run tests/citation.test.ts
```
Expected: PASS.

- [ ] **Step 5: Write the retrieval integration test**

Create `tests/search.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { embed } from 'ai';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import { chunks } from '../lib/db/schema';
import { search } from '../lib/retrieve/search';

const MARK = 'https://example.test/seed';

async function seed(content: string, heading: string) {
  const { embedding } = await embed({ model: 'openai/text-embedding-3-small', value: content });
  await db.insert(chunks).values({
    content, heading, url: MARK, version: 'v1', source: 'sdk-docs', embedding,
  });
}

describe('search (integration)', () => {
  beforeAll(async () => {
    await seed('Register a tool on an MCP server by calling server.tool() with a name and handler.', 'Seed > Tools');
    await seed('Resources expose readable data to the client via server.resource().', 'Seed > Resources');
  });

  afterAll(async () => {
    await db.delete(chunks).where(eq(chunks.url, MARK));
  });

  it('ranks the semantically relevant chunk first', async () => {
    const results = await search('how do I register a tool on a server?', 5, 0.2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('server.tool()');
    expect(results[0].citation).toContain('[v1]');
  });
});
```

- [ ] **Step 6: Run the integration test**

```bash
pnpm vitest run tests/search.integration.test.ts
```
Expected: PASS — the tool-registration seed ranks first. (Requires `DATABASE_URL` + `AI_GATEWAY_API_KEY`.)

- [ ] **Step 7: Add the CLI smoke script**

Create `scripts/ask.ts`:

```ts
import '../lib/load-env';
import { search } from '../lib/retrieve/search';

async function main() {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('Usage: pnpm ask "your question"');
    process.exit(1);
  }
  const results = await search(query);
  console.log(`\nQuery: ${query}\n`);
  for (const r of results) {
    console.log(`• (${r.similarity.toFixed(3)}) ${r.citation}`);
    console.log(`    ${r.content.slice(0, 160).replace(/\n/g, ' ')}…\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Manual end-to-end smoke**

```bash
pnpm ask "how do I register a tool on an MCP server?"
```
Expected: a ranked list of cited chunks, each line beginning with a similarity score and `[v1] …` citation pointing at a real `github.com/modelcontextprotocol/typescript-sdk/blob/<ref>/docs/...` URL. This is the "it works" moment for the foundation.

- [ ] **Step 9: Run the full test suite + typecheck**

```bash
pnpm test && pnpm typecheck
```
Expected: all unit + integration tests PASS; typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add lib/retrieve/search.ts scripts/ask.ts tests/citation.test.ts tests/search.integration.test.ts
git commit -m "feat: cited cosine retrieval + end-to-end smoke"
```

---

## Definition of Done (Plan 1)

- `pnpm ingest` clones the MCP TS SDK at the pinned v1 ref and populates pgvector with chunks carrying `content`, `heading`, `url`, `version`, `source`.
- `pnpm ask "<question>"` returns ranked chunks, each with a citation pointing at the real GitHub doc file.
- `pnpm test` passes: `chunk` (5), `read` (3), `citation` (1), `search` integration (1).
- `pnpm typecheck` is clean.
- Every task committed.

## What Plan 2 will add (not now)

Ingest **v2** (`2.0.0-alpha`, the split `@modelcontextprotocol/server`/`client`/`node` packages) at its own git ref tagged `version: 'v2'`; add the **protocol-spec** secondary corpus (the spec repo is Mintlify with an `llms.txt`, so the `.md`-append trick works there). Then the agentic layer: `generateText` + a `searchDocs` tool (`stopWhen: stepCountIs`), **version-correctness** (default v1; refuse/flag when a user asks about an API that doesn't exist in their version — e.g. `server.tool()` in v2 or `NodeStreamableHTTPServerTransport` in v1), the **SSE→Streamable HTTP** transport disambiguation, then hybrid search + `rerank`. Plan 3: the chat UI. Plan 4: eval harness (golden set mined from the repo's `bug`/`question` issues, each tagged with a v1/v2 + should-refuse flag) + benchmark vs Context7/DeepWiki. Plan 5: deploy + publish the assistant itself as an MCP server to the official registry.
