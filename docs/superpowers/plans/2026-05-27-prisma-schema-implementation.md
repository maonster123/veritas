# Prisma Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设计文档中的 7 个数据模型实现为 Prisma schema，运行迁移，并验证数据库层可用。

**Architecture:** Prisma 7.8.0 + SQLite，schema 定义在 `prisma/schema.prisma`，client 输出到 `src/generated/prisma/`。datasource URL 由 `prisma.config.ts` 管理（已配置），不在 schema 中写 URL。所有模型使用 UUID 主键，JSON 字段存储结构化数据，SQLite 下 enum 以 String 存储。

**Tech Stack:** Prisma 7.8.0, SQLite, TypeScript, Next.js 16

---

## File Structure

```
prisma/
  schema.prisma          ← 修改: 添加全部模型定义
  migrations/            ← 创建: 首次 migration
src/
  lib/
    prisma.ts            ← 创建: 客户端单例
  generated/prisma/      ← 生成: Prisma client
prisma/
  seed.ts                ← 创建: 种子数据验证脚本
package.json             ← 修改: 添加 seed 和 generate 脚本
```

---

### Task 1: Define Complete Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema with full model definitions**

用以下内容替换 `prisma/schema.prisma` 的全部内容：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

enum ProjectStatus {
  draft
  writing
  reviewing
  completed
}

enum OutlineNodeType {
  chapter
  section
  subsection
  paragraph
}

enum CitationFormatType {
  numeric
  author_year
  author_page
}

// ──────────────────────────────────────────────
// 1. Project — 论文项目
// ──────────────────────────────────────────────

model Project {
  id          String        @id @default(uuid())
  title       String
  subtitle    String?
  description String?
  status      ProjectStatus @default(draft)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  outlineNodes       OutlineNode[]
  references         Reference[]
  formatRule         FormatRule?
  citationStyles     ProjectCitationStyle[]
}

// ──────────────────────────────────────────────
// 2. OutlineNode — 大纲节点（树形自引用）
// ──────────────────────────────────────────────

model OutlineNode {
  id        String          @id @default(uuid())
  projectId String
  parentId  String?
  sortOrder Int             @default(0)
  title     String
  type      OutlineNodeType @default(chapter)
  content   String?
  notes     String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  project  Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent   OutlineNode?   @relation("NodeTree", fields: [parentId], references: [id], onDelete: SetNull)
  children OutlineNode[]  @relation("NodeTree")

  outlineReferences OutlineReference[]

  @@index([projectId])
  @@index([parentId])
}

// ──────────────────────────────────────────────
// 3. Reference — 参考文献
// ──────────────────────────────────────────────

model Reference {
  id        String   @id @default(uuid())
  projectId String
  doi       String?
  title     String
  authors   String   @default("[]")
  journal   String?
  volume    String?
  issue     String?
  pages     String?
  year      Int?
  publisher String?
  url       String?
  abstract  String?
  rawBibtex String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project           Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  outlineReferences OutlineReference[]

  @@unique([projectId, doi])
  @@index([projectId])
}

// ──────────────────────────────────────────────
// 4. OutlineReference — 大纲-文献 N:N 关联
// ──────────────────────────────────────────────

model OutlineReference {
  id            String  @id @default(uuid())
  outlineNodeId String
  referenceId   String
  citationText  String?

  outlineNode OutlineNode @relation(fields: [outlineNodeId], references: [id], onDelete: Cascade)
  reference   Reference   @relation(fields: [referenceId], references: [id], onDelete: Cascade)

  @@unique([outlineNodeId, referenceId])
}

// ──────────────────────────────────────────────
// 5. FormatRule — 排版规则
// ──────────────────────────────────────────────

model FormatRule {
  id            String @id @default(uuid())
  projectId     String @unique
  pageMargins   String @default("{}")
  lineSpacing   Float  @default(1.5)
  headingStyles String @default("{}")
  bodyFont      String @default("{}")
  headerFooter  String @default("{}")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// 6. CitationStyle — 引用格式定义
// ──────────────────────────────────────────────

model CitationStyle {
  id         String             @id @default(uuid())
  name       String             @unique
  formatType CitationFormatType
  template   String             @default("{}")

  projects ProjectCitationStyle[]
}

// ──────────────────────────────────────────────
// 7. ProjectCitationStyle — 项目-引用格式关联
// ──────────────────────────────────────────────

model ProjectCitationStyle {
  id              String  @id @default(uuid())
  projectId       String
  citationStyleId String
  isActive        Boolean @default(false)

  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  citationStyle CitationStyle  @relation(fields: [citationStyleId], references: [id], onDelete: Cascade)

  @@unique([projectId, citationStyleId])
  @@index([projectId])
}
```

- [ ] **Step 2: Validate schema syntax**

```bash
npx prisma validate
```

Expected: `The Prisma schema is valid.`

---

### Task 2: Run Migration & Generate Client

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql`

- [ ] **Step 1: Install dependencies (if needed)**

```bash
cd d:\thesis-outline && npm install
```

Expected: `@prisma/client` is installed.

- [ ] **Step 2: Create and run the first migration**

```bash
cd d:\thesis-outline && npx prisma migrate dev --name init
```

Expected:
- Migration file created under `prisma/migrations/`
- `dev.db` file created at project root (or wherever DATABASE_URL points)
- Client generated to `src/generated/prisma/`

- [ ] **Step 3: Verify generated client exists**

```bash
ls d:\thesis-outline\src\generated\prisma\index.js
```

Expected: file exists.

---

### Task 3: Create Prisma Client Singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Create the singleton module**

Create file `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit src/lib/prisma.ts
```

Expected: no errors (or only pre-existing errors from unrelated files).

---

### Task 4: Create Seed Script for Verification

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma.seed)

- [ ] **Step 1: Write seed script**

Create file `prisma/seed.ts`:

```typescript
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.outlineReference.deleteMany();
  await prisma.projectCitationStyle.deleteMany();
  await prisma.outlineNode.deleteMany();
  await prisma.reference.deleteMany();
  await prisma.formatRule.deleteMany();
  await prisma.citationStyle.deleteMany();
  await prisma.project.deleteMany();

  // Create citation styles
  const gbt = await prisma.citationStyle.create({
    data: {
      name: "GB/T 7714-2015",
      formatType: "numeric",
      template: JSON.stringify({
        book: "{authors}. {title}[M]. {address}: {publisher}, {year}.",
        article: "{authors}. {title}[J]. {journal}, {year}, {volume}({issue}): {pages}.",
      }),
    },
  });

  const apa = await prisma.citationStyle.create({
    data: {
      name: "APA 7th",
      formatType: "author_year",
      template: JSON.stringify({
        book: "{authors} ({year}). *{title}*. {publisher}.",
        article: "{authors} ({year}). {title}. *{journal}*, *{volume}*({issue}), {pages}.",
      }),
    },
  });

  const ieee = await prisma.citationStyle.create({
    data: {
      name: "IEEE",
      formatType: "numeric",
      template: JSON.stringify({
        article: "[{index}] {authors}, \"{title},\" *{journal}*, vol. {volume}, no. {issue}, pp. {pages}, {year}.",
      }),
    },
  });

  const mla = await prisma.citationStyle.create({
    data: {
      name: "MLA 9th",
      formatType: "author_page",
      template: JSON.stringify({
        book: "{authors}. *{title}*. {publisher}, {year}.",
        article: "{authors}. \"{title}.\" *{journal}*, vol. {volume}, no. {issue}, {year}, pp. {pages}.",
      }),
    },
  });

  console.log("Created citation styles:", gbt.name, apa.name, ieee.name, mla.name);

  // Create a project
  const project = await prisma.project.create({
    data: {
      title: "基于深度学习的自然语言处理研究",
      subtitle: "以机器翻译为例",
      status: "draft",
    },
  });
  console.log("Created project:", project.title);

  // Create format rule for the project
  await prisma.formatRule.create({
    data: {
      projectId: project.id,
      pageMargins: JSON.stringify({ top: 25, bottom: 25, left: 30, right: 25 }),
      lineSpacing: 1.5,
      headingStyles: JSON.stringify({
        level1: { font: "SimHei", size: 16, bold: true },
        level2: { font: "SimHei", size: 14, bold: true },
        level3: { font: "SimHei", size: 12, bold: true },
      }),
      bodyFont: JSON.stringify({ family: "SimSun", size: 12 }),
      headerFooter: JSON.stringify({ header: "硕士学位论文", footer: "{page}" }),
    },
  });

  // Activate GB/T 7714 for the project
  await prisma.projectCitationStyle.create({
    data: {
      projectId: project.id,
      citationStyleId: gbt.id,
      isActive: true,
    },
  });

  // Create outline tree
  const ch1 = await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      title: "绪论",
      type: "chapter",
      sortOrder: 0,
    },
  });

  const ch1s1 = await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch1.id,
      title: "研究背景与意义",
      type: "section",
      sortOrder: 0,
      content: "自然语言处理是人工智能领域的重要分支...",
    },
  });

  await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch1.id,
      title: "国内外研究现状",
      type: "section",
      sortOrder: 1,
    },
  });

  const ch2 = await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      title: "相关技术综述",
      type: "chapter",
      sortOrder: 1,
    },
  });

  await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch2.id,
      title: "Transformer 架构",
      type: "section",
      sortOrder: 0,
    },
  });

  await prisma.outlineNode.create({
    data: {
      projectId: project.id,
      parentId: ch2.id,
      title: "注意力机制详解",
      type: "section",
      sortOrder: 1,
      content: "注意力机制的核心思想是...",
    },
  });

  console.log("Created outline tree with chapters and sections");

  // Create a reference
  const ref = await prisma.reference.create({
    data: {
      projectId: project.id,
      doi: "10.1038/nature14539",
      title: "Deep learning",
      authors: JSON.stringify([
        { given: "Yann", family: "LeCun", order: 0 },
        { given: "Yoshua", family: "Bengio", order: 1 },
        { given: "Geoffrey", family: "Hinton", order: 2 },
      ]),
      journal: "Nature",
      volume: "521",
      issue: "7553",
      pages: "436-444",
      year: 2015,
      publisher: "Nature Publishing Group",
      abstract: "Deep learning allows computational models...",
    },
  });
  console.log("Created reference:", ref.title);

  // Link reference to outline node
  await prisma.outlineReference.create({
    data: {
      outlineNodeId: ch1s1.id,
      referenceId: ref.id,
      citationText: "[1]",
    },
  });
  console.log("Linked reference to outline node");

  // Query verification: fetch project with full tree
  const fullProject = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      outlineNodes: {
        where: { parentId: null },
        include: {
          children: {
            include: { children: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      references: true,
      formatRule: true,
      citationStyles: { include: { citationStyle: true } },
    },
  });

  console.log("\n=== Full Project Query ===");
  console.log("Title:", fullProject?.title);
  console.log("Chapters:", fullProject?.outlineNodes.length);
  console.log("References:", fullProject?.references.length);
  console.log("Format rule:", fullProject?.formatRule ? "exists" : "missing");
  console.log("Active citation style:", fullProject?.citationStyles.find((cs) => cs.isActive)?.citationStyle.name);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\nSeed completed successfully.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Add seed config to package.json**

In `package.json`, add the prisma seed configuration after the `"scripts"` block:

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Install tsx for running seed**

```bash
cd d:\thesis-outline && npm install -D tsx
```

- [ ] **Step 4: Run seed script**

```bash
cd d:\thesis-outline && npx prisma db seed
```

Expected output: logs showing created citation styles, project, outline tree, reference, and linked reference, ending with "Seed completed successfully."

---

### Task 5: Commit

**Files:** all created/modified

- [ ] **Step 1: Verify everything is clean**

```bash
cd d:\thesis-outline && npx prisma validate
```

Expected: schema valid.

- [ ] **Step 2: Commit all changes**

```bash
cd d:\thesis-outline && git add prisma/schema.prisma prisma/migrations/ prisma/seed.ts src/lib/prisma.ts src/generated/ package.json package-lock.json && git commit -m "feat: add core Prisma schema with 7 models for thesis management"
```
