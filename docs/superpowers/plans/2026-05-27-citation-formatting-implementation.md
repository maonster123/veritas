# Citation Formatting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 GB/T 7714 / APA 7th / IEEE / MLA 四种引用格式的参考文献列表和文中引用输出。

**Architecture:** 创建 `src/lib/citation-formatter.ts`，根据 CitationStyle 的 formatType (numeric/author_year/author_page) 和 template JSON 字段模板，将 Reference 数据格式化为参考文献条目字符串。同时格式化文中引用标记（如 [1] / (Author, 2024) / Author (2024)）。

**Tech Stack:** 纯函数模块，无新依赖。更新 document-builder 调用 formatter。

---

## File Structure

```
src/
  lib/
    citation-formatter.ts      ← 创建: 引用格式化核心
    document-builder.ts         ← 修改: 调用 formatter
```

---

### Task 1: Create Citation Formatter

**Files:** Create `src/lib/citation-formatter.ts`

格式化逻辑：
- **numeric** (GB/T 7714, IEEE): 按出现顺序编号 `[1]`，参考文献列表按编号排列
- **author_year** (APA 7th): 文中 `(Author, 2024)`，参考文献列表按作者字母排列
- **author_page** (MLA 9th): 文中 `(Author 42)`，参考文献列表按作者字母排列

```typescript
interface AuthorEntry {
  given: string;
  family: string;
  order: number;
}

interface ReferenceData {
  id: string;
  title: string;
  authors: string;       // JSON string of AuthorEntry[]
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  year: number | null;
  publisher: string | null;
  url: string | null;
  doi: string | null;
}

// ── Author name formatting ──

function parseAuthors(authorsJson: string): AuthorEntry[] {
  try {
    return JSON.parse(authorsJson) as AuthorEntry[];
  } catch {
    return [];
  }
}

function formatAuthorsGB(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  return authors
    .sort((a, b) => a.order - b.order)
    .map((a) => `${a.family} ${a.given}`)
    .join(", ");
}

function formatAuthorsAPA(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  const names = sorted.map((a) => {
    const initials = a.given
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() + ".")
      .join(" ");
    return `${a.family}, ${initials}`;
  });
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  // 3-7: list all with & before last
  return names.slice(0, -1).join(", ") + ", & " + names[names.length - 1];
}

function formatAuthorsMLA(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  if (sorted.length === 1) return `${sorted[0].family}, ${sorted[0].given}`;
  if (sorted.length === 2) return `${sorted[0].family}, ${sorted[0].given}, and ${sorted[1].given} ${sorted[1].family}`;
  return `${sorted[0].family}, ${sorted[0].given}, et al.`;
}

function formatAuthorsIEEE(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  const names = sorted.map((a) => {
    const initials = a.given
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() + ".")
      .join(" ");
    return `${initials} ${a.family}`;
  });
  return names.join(", ");
}

// ── Template filling ──

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ── Reference entry formatting ──

export function formatReferenceEntry(
  ref: ReferenceData,
  style: { name: string; formatType: string; template: Record<string, string> },
  index: number
): string {
  const authors = parseAuthors(ref.authors);

  // Pick template key based on reference type (book vs article)
  const hasJournal = !!ref.journal;
  const tmplKey = hasJournal ? "article" : "book";
  const tmpl = style.template[tmplKey] ?? style.template["article"] ?? "";

  // Format authors according to style
  let authorsStr: string;
  switch (style.formatType) {
    case "author_year":
      authorsStr = formatAuthorsAPA(authors);
      break;
    case "author_page":
      authorsStr = formatAuthorsMLA(authors);
      break;
    default: // numeric
      if (style.name.startsWith("IEEE")) {
        authorsStr = formatAuthorsIEEE(authors);
      } else {
        authorsStr = formatAuthorsGB(authors);
      }
  }

  const vars: Record<string, string> = {
    authors: authorsStr,
    title: ref.title,
    journal: ref.journal ?? "",
    volume: ref.volume ?? "",
    issue: ref.issue ?? "",
    pages: ref.pages ?? "",
    year: ref.year?.toString() ?? "",
    publisher: ref.publisher ?? "",
    address: "",
    index: index.toString(),
    doi: ref.doi ?? "",
    url: ref.url ?? "",
  };

  return fillTemplate(tmpl, vars);
}

// ── In-text citation formatting ──

export function formatInTextCitation(
  ref: ReferenceData,
  style: { name: string; formatType: string },
  index: number
): string {
  const authors = parseAuthors(ref.authors);
  const firstAuthor = authors[0]?.family ?? "?";
  const year = ref.year?.toString() ?? "n.d.";

  switch (style.formatType) {
    case "numeric":
      return `[${index}]`;
    case "author_year":
      if (authors.length === 1) return `(${firstAuthor}, ${year})`;
      if (authors.length === 2) return `(${firstAuthor} & ${authors[1].family}, ${year})`;
      return `(${firstAuthor} et al., ${year})`;
    case "author_page":
      return `(${firstAuthor})`;
    default:
      return `[${index}]`;
  }
}
```

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 2: Update Document Builder to Use Formatter

**Files:** Modify `src/lib/document-builder.ts`

将原来的 `formatReference` 占位函数替换为调用 `citation-formatter`。

**Read the current file first**, then:

1. Add import at top:
```typescript
import { formatReferenceEntry } from "./citation-formatter";
```

2. Replace the `formatReference` function with one that fetches full reference data:

```typescript
function formatReference(
  refId: string,
  index: number,
  citationConfig: CitationConfig,
  _tree: FlatNode[]
): string {
  // The reference data is already collected in buildDocument via outlineReferences
  // For now, rely on the reference data attached to Reference records
  return ""; // Will be populated from the actual reference data
}
```

Wait — actually, the document-builder doesn't have direct access to the full Reference records. We need to pass them in or fetch them. Let me redesign:

3. Update `buildDocument` to accept references from the database. Change the function signature and body:

Instead of collecting references from the tree, pass the full reference list from the database. The actual change: modify `buildDocument` to accept `references: ReferenceData[]` from the caller.

Actually, the simpler approach: the `getOutlineTree` already returns outlineReferences with reference data (title, year). Let me update the builder to use this data and format it with the citation formatter.

Let me update the `buildDocument` function to properly handle the reference formatting. The key change: in `buildSections`, when we collect references, we already have access to the reference title/year. We just need to store the full reference data and format it.

Here's the exact change:

**Replace the entire formatReference function at the bottom:**

```typescript
function formatReference(
  refData: { id: string; title: string; year: number | null; authors?: string; journal?: string | null; volume?: string | null; issue?: string | null; pages?: string | null },
  index: number,
  citationConfig: CitationConfig
): string {
  return formatReferenceEntry(
    {
      id: refData.id,
      title: refData.title,
      authors: refData.authors ?? "[]",
      journal: refData.journal ?? null,
      volume: refData.volume ?? null,
      issue: refData.issue ?? null,
      pages: refData.pages ?? null,
      year: refData.year ?? null,
      publisher: null,
      url: null,
      doi: null,
    },
    {
      name: "",
      formatType: citationConfig.formatType,
      template: citationConfig.template,
    },
    index
  );
}
```

**Update the `refEntries` generation in buildDocument** to pass the full reference data through by changing the referencesList items to include the full reference data, and then calling formatReference with it:

In the `buildSections` function, when collecting references, store the full reference data instead of just id+text:

```typescript
// In buildSections, change:
if (!referencesList.find((r) => r.id === or.reference.id)) {
  referencesList.push({ id: or.reference.id, text: "" });
}

// Change referencesList type and the push to include full ref data
```

Actually, this is getting complex as an edit instruction. Let me rewrite the whole document-builder.ts. Let me present the complete updated file.

3. Replace `src/lib/document-builder.ts` completely with the updated version that integrates citation formatting properly.

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 3: Update Export Routes to Pass Full Reference Data

**Files:**
- Modify: `src/app/api/export/docx/route.ts`
- Modify: `src/app/export/page.tsx`

Both routes currently query the database. They need to also fetch the full Reference records and pass them to `buildDocument` (if the signature changes).

Actually if we keep the current signature approach (where buildDocument extracts ref data from the tree's outlineReferences), no changes needed here. Let me keep it simple:

The outlineReferences in the tree already contain `{ id, title, year }` from the include clause in `getOutlineTree`. We need to also include `authors`, `journal`, `volume`, `issue`, `pages` in the include clause.

**Update `getOutlineTree` in `src/app/actions/outline.ts`** to include full reference fields:

```typescript
outlineReferences: {
  include: {
    reference: {
      select: {
        id: true,
        title: true,
        year: true,
        authors: true,
        journal: true,
        volume: true,
        issue: true,
        pages: true,
      },
    },
  },
},
```

Then update `buildDocument` to use these fields in `formatReference`.

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 4: End-to-End Test

- Start dev server
- Export .docx and verify references are properly formatted
- View HTML preview and check reference list formatting
- Test with different citation styles (change active style in DB)

---

### Task 5: Commit

```bash
cd d:\thesis-outline && git add -A && git commit -m "feat: add citation formatting for GB/T 7714, APA, IEEE, and MLA"
```
