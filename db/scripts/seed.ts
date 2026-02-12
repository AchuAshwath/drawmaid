#!/usr/bin/env bun
// Usage: bun scripts/seed.ts

import Database from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../schema";
import { seedUsers } from "../seeds/users";

// Import drizzle config to resolve local D1 file path
import config from "../drizzle.config";

const dbPath = (config as { dbCredentials?: { url?: string } }).dbCredentials
  ?.url;
if (!dbPath) throw new Error("Could not resolve local D1 database path");

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema, casing: "snake_case" });

console.log("Starting database seeding...");

try {
  await seedUsers(db);
  console.log("Database seeding completed.");
} finally {
  sqlite.close();
}
