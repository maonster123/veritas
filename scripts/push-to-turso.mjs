import { createClient } from "@libsql/client";
import { DatabaseSync } from "node:sqlite";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

// 1. Dump local schema
const localDb = new DatabaseSync("dev.db");
const tables = localDb
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

console.log("📋 Local tables found:", tables.length);

// 2. Connect to Turso
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

console.log("🔗 Connected to Turso");

// 3. Execute schema on Turso
for (const row of tables) {
  if (row.sql) {
    try {
      await turso.execute(row.sql);
      const name = row.sql.match(/CREATE TABLE.*?(\w+)/)?.[1] || "unknown";
      console.log("  ✅ Created table:", name);
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("  ⏭️  Table already exists, skipping");
      } else {
        console.error("  ❌ Error:", e.message);
      }
    }
  }
}

// 4. Create _prisma_migrations table for prisma compatibility
await turso.execute(`
  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    finished_at DATETIME,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at DATETIME,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )
`);

console.log("✅ Schema pushed to Turso!");
localDb.close();
