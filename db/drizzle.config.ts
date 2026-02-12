import { createHash, createHmac } from "node:crypto";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env.local"), quiet: true });
config({ path: resolve(__dirname, "../.env"), quiet: true });

const isRemote =
  process.env.npm_lifecycle_event?.endsWith(":remote") ||
  process.env.DB === "remote";

// Wrangler persists local D1 state relative to wrangler.jsonc (apps/api/)
const d1Dir = resolve(
  __dirname,
  "../apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);

// Dev database_id from wrangler.jsonc env.dev.d1_databases
const LOCAL_DATABASE_ID = "00000000-0000-0000-0000-000000000000";

// Reproduces workerd's Durable Object naming: HMAC-SHA256 of uniqueKey + id
// https://github.com/cloudflare/workerd/blob/main/src/workerd/server/workerd-api.c++
function miniflareD1Filename(databaseId: string): string {
  const uniqueKey = "miniflare-D1DatabaseObject";
  const key = createHash("sha256").update(uniqueKey).digest();
  const nameHmac = createHmac("sha256", key)
    .update(databaseId)
    .digest()
    .subarray(0, 16);
  const hmac = createHmac("sha256", key)
    .update(nameHmac)
    .digest()
    .subarray(0, 16);
  return Buffer.concat([nameHmac, hmac]).toString("hex") + ".sqlite";
}

function getLocalDbUrl(): string {
  const filename = miniflareD1Filename(LOCAL_DATABASE_ID);
  const dbPath = resolve(d1Dir, filename);

  // Create empty SQLite file if miniflare hasn't written one yet
  // (miniflare creates the file lazily on first DB query)
  if (!existsSync(dbPath)) {
    mkdirSync(d1Dir, { recursive: true });
    writeFileSync(dbPath, "");
  }

  return dbPath;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required for remote D1 access`);
  return value;
}

/**
 * Drizzle ORM configuration for Cloudflare D1 (SQLite).
 *
 * Local: reads the miniflare SQLite file (auto-created if missing)
 * Remote: connects via D1 HTTP API using account credentials
 */
export default defineConfig({
  out: "./migrations",
  schema: "./schema",
  dialect: "sqlite",
  casing: "snake_case",

  ...(isRemote
    ? {
        driver: "d1-http",
        dbCredentials: {
          accountId: requireEnv("CLOUDFLARE_ACCOUNT_ID"),
          databaseId: requireEnv("CLOUDFLARE_DATABASE_ID"),
          token: requireEnv("CLOUDFLARE_D1_TOKEN"),
        },
      }
    : {
        dbCredentials: { url: getLocalDbUrl() },
      }),
});
