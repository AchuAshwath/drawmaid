# Database Layer

## Schema (Drizzle casing: snake_case, dialect: SQLite/D1)

- Tables: user, session, identity, verification.
- IDs via `$defaultFn(() => createId())` using `@paralleldrive/cuid2` (25-char, URL-safe, sortable).
- Timestamps use `integer({ mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`and`$onUpdate`.
- Booleans use `integer({ mode: "boolean" })`.
- Indexes on all FK columns; composite unique indexes on identity provider/account and verification identifier/value.

## Conventions

- Keep singular table names and snake_case columns.
- Use `createId()` from `@paralleldrive/cuid2` for all IDs.
- Keep `updatedAt` on all tables for audit trails.
- Single `DB` binding (D1) - no cached/direct split.

## Commands

```bash
bun --filter @repo/db generate       # Generate migrations (local)
bun --filter @repo/db generate:remote # Generate migrations (remote)
bun --filter @repo/db push            # Push schema to local D1
bun --filter @repo/db push:remote     # Push schema to remote D1
bun --filter @repo/db studio          # Open Drizzle Studio (local)
bun --filter @repo/db seed            # Seed sample data
```

## References

### Better Auth Core Schemas (source)

- `node_modules/@better-auth/core/src/db/schema/shared.ts` - coreSchema (id, createdAt, updatedAt)
- `node_modules/@better-auth/core/src/db/schema/user.ts`
- `node_modules/@better-auth/core/src/db/schema/session.ts`
- `node_modules/@better-auth/core/src/db/schema/account.ts`
- `node_modules/@better-auth/core/src/db/schema/verification.ts`

### Configuration

- `apps/api/lib/auth.ts`
