import { createClient } from "@libsql/client";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Show all tables with row counts
const tables = await turso.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);

console.log("\n📊 Turso 数据库总览\n");

for (const t of tables.rows) {
  const cnt = await turso.execute(`SELECT COUNT(*) as c FROM "${t.name}"`);
  console.log(`  ${t.name}: ${cnt.rows[0].c} 行`);
}

// Show recent users (anonymized)
console.log("\n👤 最近注册用户\n");
const users = await turso.execute("SELECT id, name, email, createdAt FROM User ORDER BY createdAt DESC LIMIT 10");
for (const u of users.rows) {
  const email = u.email || "(无)";
  const name = u.name || "(未设置)";
  const date = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "?";
  console.log(`  ${name} | ${email} | ${date}`);
}

// Show projects
console.log("\n📝 项目列表\n");
const projects = await turso.execute("SELECT id, title, status, lang, createdAt FROM Project ORDER BY createdAt DESC LIMIT 10");
for (const p of projects.rows) {
  const date = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : "?";
  console.log(`  [${p.status}] ${p.title} (${p.lang}) | ${date}`);
}

console.log("\n✅ 完成\n");
