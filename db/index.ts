/**
 * @file Database schema exports.
 *
 * Re-exports Drizzle ORM schemas for authentication (user, session, identity, verification).
 */

import * as schema from "./schema";

export * from "./schema";
export { schema };
export type DatabaseSchema = typeof schema;
