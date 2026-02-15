## Monorepo Structure

- `apps/web/` — Edge worker; routes traffic to app/api workers via service bindings
- `apps/app/` — Main SPA (React, TanStack Router file-based routing)
- `apps/api/` — API server (Hono + tRPC + Better Auth)
- `apps/email/` — React Email templates (built before API dev server starts)
- `packages/ui/` — shadcn/ui components (new-york style)
- `packages/core/` — Shared utilities
- `packages/ws-protocol/` — WebSocket protocol definitions
- `db/` — Drizzle ORM schemas and migrations (Cloudflare D1)
- `infra/` — Terraform (Cloudflare Workers, DNS)
- `docs/` — VitePress docs; `docs/adr/` for architecture decision records; `docs/specs/` for feature specifications

## Tech Stack

- **Runtime:** Bun >=1.3.0, TypeScript 5.9, ESM (`"type": "module"`)
- **Frontend:** React 19, TanStack Router, TanStack Query, Jotai, shadcn/ui (new-york), Tailwind CSS v4
- **Backend:** Hono, tRPC 11, Better Auth (email OTP, Google OAuth, anonymous)
- **Database:** Cloudflare D1 (SQLite), Drizzle ORM (`snake_case` casing)
- **Email:** React Email, Resend
- **Testing:** Vitest, Happy DOM
- **Deployment:** Cloudflare Workers (Wrangler), Terraform
- **LLM:** WebLLM (Qwen2.5-Coder-1.5B-Instruct) for on-device diagram generation

## Commands

```bash
bun dev                        # Start web + api + app concurrently
bun build                      # Build email → web → api → app (in order)
bun test                       # Vitest (single run, not watch)
bun lint                       # ESLint with cache
bun typecheck                  # tsc --build
bun ui:add <component>         # Add shadcn/ui component to packages/ui

# Per-app: bun {web,app,api}:{dev,build,test,deploy}
# Database: bun db:{push,generate,studio,seed} (append :staging or :prod)
```

## Architecture

- Three workers: web (edge router), app (SPA assets), api (Hono server).
- API worker has `nodejs_compat` enabled; web and app workers do NOT.
- Web worker routes: `/api/*` → API worker, app routes → App worker, static → assets.
- Service bindings connect workers internally (no public cross-worker URLs).
- Database, auth, routing, and tRPC conventions are in subdirectory `AGENTS.md` files.

## LLM Diagram Generation (apps/app)

### Structure

```
apps/app/
  lib/
    mermaid-llm.ts       # WebLLM integration, streaming, timeout
    intent-extraction.ts # Backwards-scan keyword detection, entity extraction
    normalize-mermaid.ts # Strip fences, validate output
    diagram-config.ts    # Diagram-type configs (imported from JSON)
  prompts/
    system-prompt.md     # Base LLM role/rules
    user-prompt-rules.md # User prompt template with {{placeholders}}
    recovery-prompt-rules.md # Error recovery prompt template
  config/
    diagram-configs.json # Per-diagram-type: syntax, reserved words, tips, examples
    error-patterns.json  # Mermaid parse error patterns and fixes
```

### Key Features

- **Intent Extraction**: Scans backwards from transcript end (last keyword wins)
- **Native Entity Extraction**: Uses `Intl.Segmenter` (no external NLP library)
- **Error Recovery**: Targeted retries with error-specific fixes
- **Timeout**: 10s default (configurable via `VITE_LLM_TIMEOUT_MS`)
- **Caching**: 50-item LRU cache for repeated inputs

### Configuration

- `VITE_LLM_TIMEOUT_MS` - Generation timeout in milliseconds (default: 10000)

## Design Philosophy

- Simplest correct solution. No speculative abstractions — add them only when a real second use case exists.
- No superficial work: no coverage-only tests, no redundant comments, no wrappers that just forward calls.
- Fail loudly in core logic. Do not silently swallow errors or mask incorrect state.
- Three similar lines are better than a premature abstraction.
- Prefer explicit, readable code over clever or compressed patterns.
- Use precise TypeScript types. Avoid `any` and unnecessary type assertions — let the compiler enforce correctness.
- Document non-obvious trade-offs and decisions. Explain why, not what — every word must add value.
- Prompts and configs should be externalized to `.md`/`.json` files for easy iteration without code changes.
