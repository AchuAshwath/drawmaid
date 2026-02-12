import type { DatabaseSchema } from "@repo/db";
import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Auth, AuthSession, AuthUser } from "./auth.js";
import type { Env } from "./env.js";

/**
 * Context object passed to all tRPC procedures.
 */
export type TRPCContext = {
  req: Request;
  info: CreateHTTPContextOptions["info"];
  db: DrizzleD1Database<DatabaseSchema>;
  session: AuthSession | null;
  user: AuthUser | null;
  cache: Map<string | symbol, unknown>;
  res?: Response;
  resHeaders?: Headers;
  env: Env;
};

/**
 * Hono application context.
 */
export type AppContext = {
  Bindings: Env;
  Variables: {
    db: DrizzleD1Database<DatabaseSchema>;
    auth: Auth;
    session: AuthSession | null;
    user: AuthUser | null;
  };
};
