## Schema Conventions

- Drizzle `casing: "snake_case"` — use camelCase in TypeScript, columns map to snake_case in DB.
- All primary keys: `text().primaryKey().$defaultFn(() => createId())` using `@paralleldrive/cuid2`.
- Timestamps: `integer({ mode: "timestamp" })` with `.default(sql`(unixepoch())`).notNull()` and `.$onUpdate(() => new Date()).notNull()`.
- Booleans: `integer({ mode: "boolean" })`.
- `identity` table = Better Auth's `account` table, renamed via `account.modelName: "identity"` in auth config.

## Indexes and Constraints

- Every foreign key column gets an index: `{table}_{column}_idx`.
- Composite uniques: `identity(providerId, accountId)`, `verification(identifier, value)`.
- All foreign keys use `onDelete: "cascade"`.

## Seeds

- Use `onConflictDoNothing()` for idempotent seeds (safe to rerun).

## Environment

- `ENVIRONMENT` env var overrides `NODE_ENV` for env file selection.
- DB scripts have `:staging` / `:prod` variants (e.g., `bun db:push:prod`).
- Single D1 binding — no cached/direct connection split.
