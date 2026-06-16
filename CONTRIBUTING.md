# Contributing

Thanks for your interest! This is an agentic RAG assistant for the MCP TypeScript
SDK. Contributions of all sizes are welcome — docs, tests, retrieval tweaks,
new corpora, UI polish.

## Quick start

```bash
pnpm install
cp .env.example .env        # add DATABASE_URL + GOOGLE_GENERATIVE_AI_API_KEY
pnpm db:setup && pnpm db:push
pnpm ingest                 # one-time: clone + embed the corpora
pnpm dev                    # web chat at localhost:3000
```

You'll need:

- **Node 20+** and **pnpm 11+**
- A **Neon** (or any Postgres + pgvector) database → `DATABASE_URL`
- A **Google Gemini** API key → `GOOGLE_GENERATIVE_AI_API_KEY`

See [DEPLOY.md](DEPLOY.md) for ops and [STATUS.md](STATUS.md) for the full
engineering log / architecture.

## Dev loop

```bash
pnpm test         # Vitest unit tests (must pass)
pnpm typecheck    # tsc --noEmit (must be clean)
pnpm lint         # eslint
pnpm eval         # scorecard against the golden set (needs DB + key)
```

Before opening a PR, make sure `pnpm test` and `pnpm typecheck` are green.
CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `typecheck`,
`lint`, and `test` on every PR — these block merge if they fail. The unit suite
is fully mocked, so it passes without a DB or API key (fork PRs included). The
live `pnpm eval` scorecard needs secrets, so run it locally and paste results
into PRs that touch retrieval or the agent.

## Code conventions

- **Pure core, thin shell.** Put logic in pure, testable functions in `lib/`;
  keep DB / network / React at the edges. Most `lib/**` modules have a matching
  `tests/*.test.ts` — please add one for new logic.
- **TypeScript**: explicit types on exported functions; no `any`; validate
  external input with `zod`.
- **Small files** (< ~400 lines), small functions, early returns.
- **The moat is sacred.** Don't weaken the refusal gate or version-correctness
  without an eval that proves quality held (`pnpm eval`).

## Commits & PRs

- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- One logical change per PR; describe what + why; link any issue.
- New behavior needs a test. Retrieval/agent changes should report `pnpm eval`
  before/after.

## Where to start

Look for issues labeled [`good first issue`](https://github.com/Kaydenletk/mcp-docs-assistant/labels/good%20first%20issue).
Open an issue first for anything large so we can align on approach.
