## Auth

- Server config in `lib/auth.ts`. Better Auth `account` table renamed to `identity` via `account.modelName: "identity"`.
- Auth hint cookie: set/cleared in Better Auth hooks (sign-in, sign-out). NOT a security boundary — false positives cause one redirect. See `docs/adr/001-auth-hint-cookie.md`.
- Session types: `AuthUser` and `AuthSession` from `Auth["$Infer"]["Session"]`.

## Database

- Single D1 binding: `createDb(d1)` in `lib/db.ts`. No cached/direct split.
- Drizzle adapter uses `provider: "sqlite"` for D1 compatibility.
- Drizzle `casing: "snake_case"` — camelCase in TypeScript, snake_case in DB.

## tRPC

- `publicProcedure` and `protectedProcedure` defined in `lib/trpc.ts`.
- `protectedProcedure` throws `UNAUTHORIZED` if `ctx.session` or `ctx.user` is null, then narrows both to non-null in downstream context.
- Router in `lib/app.ts` combines routers from `routers/`. Input validation with Zod.

## Email

- Fresh `Resend` client per invocation via `createResendClient()`.
- Requires both HTML and plain text — use `renderEmailToHtml()` + `renderEmailToText()` from `@repo/email`.
- Validates recipients with Zod before sending.

## Request Context

- `ctx.cache: Map<string | symbol, unknown>` — request-scoped cache.
- DataLoaders use Symbol keys to avoid collisions. Pattern: check `cache.has()`, create loader on miss, return typed cast.
- AI provider instances (OpenAI) also cached per-request via same pattern.

## Environment

- Zod schema validates env vars in `lib/env.ts` (Bun reads `Bun.env`; Workers get bindings via Hono context).
- `nodejs_compat` compatibility flag required — web and app workers do NOT have it.

## Worker Entry

- `worker.ts` is the Cloudflare Workers entrypoint (`export default`). Hono middleware stack: `secureHeaders` → `requestId` (CF-Ray or UUID) → `logger` → context init (Drizzle + auth instances).
