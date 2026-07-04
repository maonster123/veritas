import { createClient } from "@libsql/client";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await turso.execute(`
  CREATE TABLE IF NOT EXISTS RateLimit (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    action TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

await turso.execute(`
  CREATE INDEX IF NOT EXISTS idx_ratelimit_user_action
  ON RateLimit(userId, action, createdAt)
`);

console.log("✅ RateLimit table created on Turso");
