import { createClient } from "@libsql/client";
import { DatabaseSync } from "node:sqlite";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const local = new DatabaseSync("dev.db");
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// Tables in FK-safe order
const TABLES = [
  "User",
  "Account",
  "Session",
  "VerificationToken",
  "Project",
  "CitationStyle",
  "FormatRule",
  "Reference",
  "OutlineNode",
  "OutlineReference",
  "ProjectCitationStyle",
  "ChatMessage",
];

console.log("📦 Starting data migration...\n");

for (const table of TABLES) {
  // Get columns for this table
  const cols = local
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .map((c) => c.name);

  // Check if Turso already has data
  const existing = await turso.execute(`SELECT COUNT(*) as cnt FROM "${table}"`);
  const remoteCount = existing.rows[0]?.cnt ?? 0;

  // Read local data
  const rows = local.prepare(`SELECT * FROM "${table}"`).all();

  if (rows.length === 0) {
    console.log(`  ⏭️  ${table}: 0 rows (empty)`);
    continue;
  }

  if (remoteCount > 0) {
    console.log(`  ⏭️  ${table}: ${rows.length} local rows, but ${remoteCount} already remote — skipping`);
    continue;
  }

  // Insert each row
  let inserted = 0;
  let errors = 0;
  for (const row of rows) {
    const placeholders = cols.map(() => "?").join(", ");
    const values = cols.map((c) => row[c] ?? null);
    try {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO "${table}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
        args: values,
      });
      inserted++;
    } catch (e) {
      errors++;
      if (errors <= 2) console.error(`    ❌ ${table} row error:`, e.message);
    }
  }

  console.log(`  ✅ ${table}: ${inserted}/${rows.length} rows migrated` + (errors ? ` (${errors} errors)` : ""));
}

console.log("\n✅ Data migration complete!");
local.close();
