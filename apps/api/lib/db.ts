/**
 * @file Database client using Cloudflare D1.
 */

import { schema } from "@repo/db";
import { drizzle } from "drizzle-orm/d1";

/**
 * Creates a Drizzle ORM database client backed by Cloudflare D1.
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema, casing: "snake_case" });
}
