import { createClient } from "@libsql/client";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await turso.execute(`
  CREATE TABLE IF NOT EXISTS Subscription (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'ONETIME',
    aiLimit INTEGER NOT NULL DEFAULT 0,
    aiUsed INTEGER NOT NULL DEFAULT 0,
    projectLimit INTEGER NOT NULL DEFAULT 1,
    expiresAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await turso.execute(`
  CREATE TABLE IF NOT EXISTS PaymentOrder (
    id TEXT PRIMARY KEY,
    subscriptionId TEXT NOT NULL REFERENCES Subscription(id),
    plan TEXT NOT NULL,
    amount REAL NOT NULL,
    provider TEXT NOT NULL DEFAULT 'wechat',
    status TEXT NOT NULL DEFAULT 'pending',
    paidAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await turso.execute("CREATE INDEX IF NOT EXISTS idx_po_sub ON PaymentOrder(subscriptionId)");
await turso.execute("CREATE INDEX IF NOT EXISTS idx_po_status ON PaymentOrder(status)");

console.log("Subscription and PaymentOrder tables created");
