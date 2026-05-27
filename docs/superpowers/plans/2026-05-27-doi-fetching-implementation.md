# DOI Reference Fetching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 输入 DOI 自动从 CrossRef/DataCite 抓取文献元数据，存入 Reference 表。

**Architecture:** 纯服务端处理。Next.js Server Action 接收 DOI，调用 `src/lib/doi-resolver.ts` 查询 CrossRef API（fallback DataCite），解析 JSON 映射到 Reference 字段，写入数据库并返回结果给客户端。

**Tech Stack:** Next.js 16 Server Actions, CrossRef REST API, @prisma/adapter-libsql

---

## File Structure

```
src/
  lib/
    prisma.ts           ← 已存在
    doi-resolver.ts     ← 创建: DOI查询 + 字段映射
  app/
    actions/
      lookup-doi.ts     ← 创建: Server Action, 调doi-resolver
    page.tsx            ← 修改: 添加DOI输入UI
```

---

### Task 1: Create DOI Resolver Module

**Files:**
- Create: `src/lib/doi-resolver.ts`

- [ ] **Step 1: Write the DOI resolver**

Create `src/lib/doi-resolver.ts`:

```typescript
interface Author {
  given: string;
  family: string;
  order: number;
}

interface CrossRefWork {
  title?: string[];
  author?: { given?: string; family?: string }[];
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  "published-print"?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  publisher?: string;
  URL?: string;
  abstract?: string;
}

interface ResolvedReference {
  title: string;
  authors: Author[];
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  year: number | null;
  publisher: string | null;
  url: string | null;
  abstract: string | null;
  rawBibtex: string | null;
}

function pickYear(work: CrossRefWork): number | null {
  const parts =
    work["published-print"]?.["date-parts"]?.[0] ??
    work.published?.["date-parts"]?.[0];
  return parts?.[0] ?? null;
}

function parseAuthors(work: CrossRefWork): Author[] {
  return (work.author ?? []).map((a, i) => ({
    given: a.given ?? "",
    family: a.family ?? "",
    order: i,
  }));
}

async function fetchCrossRef(doi: string): Promise<ResolvedReference | null> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ThesisOutline/0.1 (mailto:dev@localhost)" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const work: CrossRefWork = json.message;

  return {
    title: work.title?.[0] ?? "Unknown Title",
    authors: parseAuthors(work),
    journal: work["container-title"]?.[0] ?? null,
    volume: work.volume ?? null,
    issue: work.issue ?? null,
    pages: work.page ?? null,
    year: pickYear(work),
    publisher: work.publisher ?? null,
    url: work.URL ?? null,
    abstract: work.abstract ?? null,
    rawBibtex: null,
  };
}

async function fetchDataCite(doi: string): Promise<ResolvedReference | null> {
  const url = `https://api.datacite.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.datacite.datacite+json" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const attrs = json.data?.attributes ?? {};

  return {
    title: attrs.titles?.[0]?.title ?? "Unknown Title",
    authors: (attrs.creators ?? []).map((c: any, i: number) => ({
      given: c.givenName ?? "",
      family: c.familyName ?? "",
      order: i,
    })),
    journal: attrs.container?.title ?? null,
    volume: attrs.container?.volume ?? null,
    issue: attrs.container?.issue ?? null,
    pages: `${attrs.container?.firstPage ?? ""}${attrs.container?.firstPage && attrs.container?.lastPage ? "-" + attrs.container?.lastPage : ""}` || null,
    year: attrs.publicationYear ?? null,
    publisher: attrs.publisher ?? null,
    url: attrs.url ?? null,
    abstract: attrs.descriptions?.[0]?.description ?? null,
    rawBibtex: null,
  };
}

export async function resolveDOI(doi: string): Promise<ResolvedReference> {
  // Normalize DOI: strip "https://doi.org/" prefix if present
  const normalized = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();

  // Try CrossRef first, then DataCite
  const result = (await fetchCrossRef(normalized)) ?? (await fetchDataCite(normalized));

  if (!result) {
    throw new Error(`Could not resolve DOI: ${normalized}`);
  }

  return result;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit src/lib/doi-resolver.ts
```

Expected: no errors.

---

### Task 2: Create Server Action

**Files:**
- Create: `src/app/actions/lookup-doi.ts`

- [ ] **Step 1: Write the server action**

Create directory `src/app/actions/` first, then create `src/app/actions/lookup-doi.ts`:

```typescript
"use server";

import { resolveDOI } from "@/lib/doi-resolver";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface LookupResult {
  success: boolean;
  reference?: {
    id: string;
    title: string;
    authors: string;
    journal: string | null;
    year: number | null;
    doi: string | null;
  };
  error?: string;
}

export async function lookupAndSaveDOI(
  projectId: string,
  doi: string
): Promise<LookupResult> {
  try {
    // Check if DOI already exists in this project
    const existing = await prisma.reference.findUnique({
      where: { projectId_doi: { projectId, doi } },
    });
    if (existing) {
      return {
        success: false,
        error: "该 DOI 已存在于当前项目的文献库中",
      };
    }

    // Resolve DOI
    const resolved = await resolveDOI(doi);

    // Save to database
    const reference = await prisma.reference.create({
      data: {
        projectId,
        doi,
        title: resolved.title,
        authors: JSON.stringify(resolved.authors),
        journal: resolved.journal,
        volume: resolved.volume,
        issue: resolved.issue,
        pages: resolved.pages,
        year: resolved.year,
        publisher: resolved.publisher,
        url: resolved.url,
        abstract: resolved.abstract,
        rawBibtex: resolved.rawBibtex,
      },
      select: {
        id: true,
        title: true,
        authors: true,
        journal: true,
        year: true,
        doi: true,
      },
    });

    revalidatePath("/");

    return { success: true, reference };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3: Add DOI Input UI

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the UI component**

Replace `src/app/page.tsx` with a minimal DOI lookup page:

```tsx
"use client";

import { useState, useTransition } from "react";
import { lookupAndSaveDOI } from "@/app/actions/lookup-doi";

export default function Home() {
  const [doi, setDoi] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doi.trim()) return;

    setMessage(null);
    startTransition(async () => {
      // Use a placeholder project ID for now; will be dynamic later
      const result = await lookupAndSaveDOI("placeholder-project-id", doi.trim());
      if (result.success && result.reference) {
        setMessage({
          type: "success",
          text: `已添加: ${result.reference.title} (${result.reference.year ?? "N/A"})`,
        });
        setDoi("");
      } else {
        setMessage({ type: "error", text: result.error ?? "添加失败" });
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col gap-8 w-full max-w-xl px-8 py-32">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            论文文献管理
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            输入 DOI 自动获取文献信息
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="输入 DOI，例如 10.1038/nature14539"
            className="flex-1 h-12 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !doi.trim()}
            className="h-12 px-6 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "查询中..." : "添加"}
          </button>
        </form>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

Expected: no errors.

---

### Task 4: Test End-to-End with Dev Server

- [ ] **Step 1: Start dev server and test with curl**

```bash
cd d:\thesis-outline && npm run dev
```

Wait for the server to start, then in another terminal:

```bash
# First, find a project ID from the seed data
cd d:\thesis-outline && npx tsx -e "
import { PrismaClient } from './src/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
const p = new PrismaClient({ adapter: new PrismaLibSql({ url: 'file:./dev.db' }) });
p.project.findFirst().then(r => { console.log(r?.id); p.\$disconnect(); });
"
```

Then test the server action with the found project ID. The UI should successfully:
1. Accept a DOI like `10.1038/nature14539`
2. Show "查询中..." while loading
3. Display success with title and year
4. Show error for invalid DOIs

---

### Task 5: Commit

- [ ] **Step 1: Commit**

```bash
cd d:\thesis-outline && git add -A && git status
```

```bash
cd d:\thesis-outline && git commit -m "feat: add DOI auto-fetching via CrossRef and DataCite"
```
