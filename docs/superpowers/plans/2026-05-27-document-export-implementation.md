# Document Export Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将大纲树 + FormatRule + CitationStyle 组装为 .docx 文件下载，并提供 HTML 页面用于浏览器打印 PDF。

**Architecture:** 服务端组装文档结构（Markdown → 段落），用 `docx` 库生成 .docx 并流式返回。PDF 通过干净 HTML 页面 + 浏览器打印实现，避免引入 puppeteer。

**Tech Stack:** `docx` npm, Next.js Route Handler, FormatRule JSON, Markdown 简单解析

---

## File Structure

```
src/
  lib/
    document-builder.ts   ← 创建: 文档组装引擎
    markdown-parser.ts    ← 创建: 简易 Markdown → 段落转换
  app/
    api/
      export/
        docx/
          route.ts        ← 创建: .docx 下载 API
        html/
          route.ts        ← 创建: HTML 预览（用于打印 PDF）
    export/
      page.tsx            ← 创建: 导出配置页面（格式选择 + 预览）
  components/
    outline/
      ExportButton.tsx    ← 创建: 导出按钮 + 格式菜单
```

---

### Task 1: Install `docx` library

**Run:**
```bash
cd d:\thesis-outline && npm install docx
```

---

### Task 2: Create Markdown Parser

**Files:** Create `src/lib/markdown-parser.ts`

Convert simple Markdown to structured paragraphs. First version handles:
- `# Heading` → heading levels
- Regular text → paragraphs
- `**bold**` / `*italic*` → inline formatting
- `- list items` → bullet lists

```typescript
export interface ParsedSegment {
  type: "heading" | "paragraph" | "list";
  level?: number;  // heading level (1-4)
  items?: ParsedInline[][];  // list items, each item is an array of inlines
  content?: ParsedInline[];
}

export interface ParsedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export function parseMarkdown(md: string): ParsedSegment[] {
  const lines = md.split("\n");
  const segments: ParsedSegment[] = [];
  let listItems: ParsedInline[][] = [];

  function flushList() {
    if (listItems.length > 0) {
      segments.push({ type: "list", items: [...listItems] });
      listItems = [];
    }
  }

  for (const line of lines) {
    // Heading: # Title
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      flushList();
      segments.push({
        type: "heading",
        level: headingMatch[1].length,
        content: parseInline(headingMatch[2]),
      });
      continue;
    }

    // List item: - text or * text
    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(parseInline(listMatch[1]));
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    segments.push({ type: "paragraph", content: parseInline(line) });
  }

  flushList();
  return segments;
}

function parseInline(text: string): ParsedInline[] {
  const result: ParsedInline[] = [];
  // Match **bold** or *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      result.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      // **bold**
      result.push({ text: match[2], bold: true });
    } else if (match[3]) {
      // *italic*
      result.push({ text: match[3], italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ text }];
}
```

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 3: Create Document Builder

**Files:** Create `src/lib/document-builder.ts`

Assembles the outline tree into a structured document, applying FormatRule settings.

```typescript
import { parseMarkdown, type ParsedSegment } from "./markdown-parser";
import type { FlatNode } from "./outline-utils";
import { flattenTree } from "./outline-utils";

export interface FormatConfig {
  pageMargins: { top: number; bottom: number; left: number; right: number };
  lineSpacing: number;
  headingStyles: Record<string, { font: string; size: number; bold: boolean }>;
  bodyFont: { family: string; size: number };
  headerFooter: { header?: string; footer?: string };
}

export interface CitationConfig {
  formatType: "numeric" | "author_year" | "author_page";
  template: Record<string, string>;
}

export interface DocumentData {
  title: string;
  subtitle?: string | null;
  sections: DocumentSection[];
  references: {
    index: number;
    text: string;
    id: string;
  }[];
}

export interface DocumentSection {
  nodeId: string;
  title: string;
  type: string;
  level: number;
  segments: ParsedSegment[];
  citations: string[];  // citation keys like "[1]"
  children: DocumentSection[];
}

function getNodeLevel(node: FlatNode, tree: FlatNode[]): number {
  // Count ancestors to determine depth
  let level = 1;
  let current = node;
  const flat = flattenTree(tree);
  while (current.parentId) {
    level++;
    current = flat.find((n) => n.id === current.parentId)!;
    if (!current) break;
  }
  return Math.min(level, 4);
}

export function buildDocument(
  project: { title: string; subtitle?: string | null },
  tree: FlatNode[],
  formatConfig: FormatConfig,
  citationConfig: CitationConfig
): DocumentData {
  const flat = flattenTree(tree);
  const referencesList: { id: string; text: string }[] = [];

  function buildSections(nodes: FlatNode[]): DocumentSection[] {
    return nodes.map((node) => {
      const segments = node.content ? parseMarkdown(node.content) : [];
      const level = getNodeLevel(node, tree);

      // Collect citations from outlineReferences
      const citations: string[] = [];
      if (node.outlineReferences) {
        for (const or of node.outlineReferences) {
          if (or.citationText) {
            citations.push(or.citationText);
          }
          if (!referencesList.find((r) => r.id === or.reference.id)) {
            referencesList.push({ id: or.reference.id, text: "" });
          }
        }
      }

      return {
        nodeId: node.id,
        title: node.title,
        type: node.type,
        level,
        segments,
        citations,
        children: buildSections(node.children),
      };
    });
  }

  const sections = buildSections(tree);

  // Format reference list text
  const refEntries = referencesList.map((ref, index) => {
    const num = index + 1;
    const text = formatReference(ref.id, num, citationConfig, tree);
    return { index: num, text, id: ref.id };
  });

  return {
    title: project.title,
    subtitle: project.subtitle,
    sections,
    references: refEntries,
  };
}

function formatReference(
  refId: string,
  index: number,
  _citationConfig: CitationConfig,
  _tree: FlatNode[]
): string {
  // Placeholder: will be fully implemented in Phase 5 (Citation Formatting)
  // For now, format as "[index] title (year)"
  return `[${index}] Reference ${refId}`;
}
```

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 4: Create .docx Export Route

**Files:** Create `src/app/api/export/docx/route.ts`

Generate .docx using the `docx` library and return as download.

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertMillimetersToTwip,
  NumberFormat,
} from "docx";
import { prisma } from "@/lib/prisma";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import type { ParsedInline } from "@/lib/markdown-parser";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Fetch project, tree, formatRule, and active citation style
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const nodes = await getOutlineTree(projectId);
  const tree = buildTree(nodes as any);

  const formatRule = await prisma.formatRule.findUnique({ where: { projectId } });
  const formatConfig: FormatConfig = formatRule
    ? {
        pageMargins: JSON.parse(formatRule.pageMargins),
        lineSpacing: formatRule.lineSpacing,
        headingStyles: JSON.parse(formatRule.headingStyles),
        bodyFont: JSON.parse(formatRule.bodyFont),
        headerFooter: JSON.parse(formatRule.headerFooter),
      }
    : {
        pageMargins: { top: 25, bottom: 25, left: 30, right: 25 },
        lineSpacing: 1.5,
        headingStyles: {
          level1: { font: "SimHei", size: 16, bold: true },
          level2: { font: "SimHei", size: 14, bold: true },
          level3: { font: "SimHei", size: 12, bold: true },
        },
        bodyFont: { family: "SimSun", size: 12 },
        headerFooter: {},
      };

  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: { projectId, isActive: true },
    include: { citationStyle: true },
  });
  const citationConfig: CitationConfig = activeStyle?.citationStyle
    ? {
        formatType: activeStyle.citationStyle.formatType as CitationConfig["formatType"],
        template: JSON.parse(activeStyle.citationStyle.template),
      }
    : { formatType: "numeric", template: {} };

  // Build document data
  const docData = buildDocument(project, tree, formatConfig, citationConfig);

  // Generate .docx
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: formatConfig.bodyFont.family,
            size: formatConfig.bodyFont.size * 10,  // half-points
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(formatConfig.pageMargins.top),
              bottom: convertMillimetersToTwip(formatConfig.pageMargins.bottom),
              left: convertMillimetersToTwip(formatConfig.pageMargins.left),
              right: convertMillimetersToTwip(formatConfig.pageMargins.right),
            },
          },
        },
        children: [
          // Title
          new Paragraph({
            text: docData.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          // Subtitle
          ...(docData.subtitle
            ? [
                new Paragraph({
                  text: docData.subtitle,
                  alignment: AlignmentType.CENTER,
                }),
              ]
            : []),
          new Paragraph({ text: "" }),
          // Body sections
          ...renderSections(docData.sections),
          // References
          new Paragraph({
            text: "参考文献",
            heading: HeadingLevel.HEADING_1,
          }),
          ...docData.references.map(
            (ref) =>
              new Paragraph({
                text: ref.text,
                spacing: { after: 120 },
              })
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(docData.title)}.docx"`,
    },
  });
}

function renderSections(sections: any[]): Paragraph[] {
  const result: Paragraph[] = [];

  for (const section of sections) {
    const headingLevels: Record<number, HeadingLevel> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
    };

    // Section heading
    result.push(
      new Paragraph({
        text: section.title,
        heading: headingLevels[section.level] ?? HeadingLevel.HEADING_4,
      })
    );

    // Content segments
    for (const seg of section.segments) {
      result.push(...renderSegment(seg));
    }

    // Children
    result.push(...renderSections(section.children));
  }

  return result;
}

function renderSegment(seg: any): Paragraph[] {
  switch (seg.type) {
    case "heading": {
      const levels: Record<number, HeadingLevel> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
      };
      return [
        new Paragraph({
          text: seg.content?.map((i: ParsedInline) => i.text).join("") ?? "",
          heading: levels[seg.level ?? 1] ?? HeadingLevel.HEADING_4,
        }),
      ];
    }
    case "paragraph":
      return [
        new Paragraph({
          children: (seg.content as ParsedInline[]).map(
            (i) =>
              new TextRun({
                text: i.text,
                bold: i.bold,
                italics: i.italic,
              })
          ),
        }),
      ];
    case "list":
      return (seg.items as ParsedInline[][]).map(
        (item) =>
          new Paragraph({
            children: [
              new TextRun({ text: "•\t" }),
              ...item.map(
                (i) =>
                  new TextRun({
                    text: i.text,
                    bold: i.bold,
                    italics: i.italic,
                  })
              ),
            ],
          })
      );
    default:
      return [];
  }
}
```

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 5: Create HTML Preview Route (for PDF printing)

**Files:**
- Create `src/components/export/PrintButton.tsx`
- Create `src/app/export/page.tsx`

A clean HTML page that renders the document for browser "Print to PDF".

**Step 0: Create PrintButton client component**

Create `src/components/export/PrintButton.tsx`:

```tsx
"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        padding: "8px 16px",
        background: "#2563eb",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        zIndex: 1000,
      }}
    >
      打印为 PDF
    </button>
  );
}
```

**Step 1: Create the export page**

```tsx
import { prisma } from "@/lib/prisma";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree, flattenTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import type { ParsedInline } from "@/lib/markdown-parser";
import PrintButton from "@/components/export/PrintButton";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (!projectId) {
    return <div className="p-8 text-red-500">Missing projectId parameter</div>;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return <div className="p-8 text-red-500">Project not found</div>;
  }

  const nodes = await getOutlineTree(projectId);
  const tree = buildTree(nodes as any);

  const formatRule = await prisma.formatRule.findUnique({ where: { projectId } });
  const formatConfig: FormatConfig = formatRule
    ? {
        pageMargins: JSON.parse(formatRule.pageMargins),
        lineSpacing: formatRule.lineSpacing,
        headingStyles: JSON.parse(formatRule.headingStyles),
        bodyFont: JSON.parse(formatRule.bodyFont),
        headerFooter: JSON.parse(formatRule.headerFooter),
      }
    : {
        pageMargins: { top: 25, bottom: 25, left: 30, right: 25 },
        lineSpacing: 1.5,
        headingStyles: {},
        bodyFont: { family: "SimSun", size: 12 },
        headerFooter: {},
      };

  const docData = buildDocument(project, tree, formatConfig, {
    formatType: "numeric",
    template: {},
  });

  const fontFamily = formatConfig.bodyFont.family;
  const fontSize = formatConfig.bodyFont.size;
  const headingStyle = (level: number) => {
    const key = `level${level}`;
    const style = formatConfig.headingStyles[key];
    if (!style) return {};
    return {
      fontFamily: style.font,
      fontSize: style.size,
      fontWeight: style.bold ? "bold" : "normal",
    };
  };

  return (
    <html>
      <head>
        <title>{docData.title} - 导出预览</title>
        <style>{`
          @page {
            size: A4;
            margin: ${formatConfig.pageMargins.top}mm ${formatConfig.pageMargins.right}mm ${formatConfig.pageMargins.bottom}mm ${formatConfig.pageMargins.left}mm;
          }
          body {
            font-family: "${fontFamily}", serif;
            font-size: ${fontSize}pt;
            line-height: ${formatConfig.lineSpacing};
            color: #000;
          }
          h1 { font-size: ${headingStyle(1).fontSize}pt; font-weight: ${headingStyle(1).fontWeight}; }
          h2 { font-size: ${headingStyle(2).fontSize}pt; font-weight: ${headingStyle(2).fontWeight}; }
          h3 { font-size: ${headingStyle(3).fontSize}pt; font-weight: ${headingStyle(3).fontWeight}; }
          .title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 12pt; }
          .subtitle { text-align: center; font-size: 14pt; margin-bottom: 24pt; }
          .references { margin-top: 24pt; border-top: 1px solid #000; padding-top: 12pt; }
          @media print {
            button { display: none; }
          }
        `}</style>
      </head>
      <body>
        <PrintButton />

        <div className="title">{docData.title}</div>
        {docData.subtitle && <div className="subtitle">{docData.subtitle}</div>}

        {docData.sections.map((section) => renderSection(section))}

        {docData.references.length > 0 && (
          <div className="references">
            <h2>参考文献</h2>
            {docData.references.map((ref) => (
              <p key={ref.id}>{ref.text}</p>
            ))}
          </div>
        )}
      </body>
    </html>
  );
}

function renderSection(section: any): React.ReactNode {
  const HeadingTag = `h${Math.min(section.level, 4)}` as keyof JSX.IntrinsicElements;
  return (
    <div key={section.nodeId}>
      <HeadingTag>{section.title}</HeadingTag>
      {section.segments.map((seg: any, i: number) => {
        switch (seg.type) {
          case "heading":
            const H = `h${Math.min((seg.level ?? 1) + 1, 4)}` as keyof JSX.IntrinsicElements;
            return (
              <H key={i}>
                {seg.content?.map((inline: ParsedInline, j: number) =>
                  inline.bold ? (
                    <strong key={j}>{inline.text}</strong>
                  ) : inline.italic ? (
                    <em key={j}>{inline.text}</em>
                  ) : (
                    <span key={j}>{inline.text}</span>
                  )
                )}
              </H>
            );
          case "paragraph":
            return (
              <p key={i}>
                {seg.content?.map((inline: ParsedInline, j: number) =>
                  inline.bold ? (
                    <strong key={j}>{inline.text}</strong>
                  ) : inline.italic ? (
                    <em key={j}>{inline.text}</em>
                  ) : (
                    <span key={j}>{inline.text}</span>
                  )
                )}
              </p>
            );
          case "list":
            return (
              <ul key={i}>
                {seg.items?.map((item: ParsedInline[], j: number) => (
                  <li key={j}>
                    {item.map((inline, k) =>
                      inline.bold ? (
                        <strong key={k}>{inline.text}</strong>
                      ) : inline.italic ? (
                        <em key={k}>{inline.text}</em>
                      ) : (
                        <span key={k}>{inline.text}</span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            );
          default:
            return null;
        }
      })}
      {section.children.length > 0 &&
        section.children.map((child: any) => renderSection(child))}
    </div>
  );
}
```

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 6: Add Export Button to Main Page

**Files:** Modify `src/app/page.tsx`

Add an export dropdown button in the left sidebar header. Use the Read tool first, then Edit to add the button.

Add this import at the top:
```tsx
import { useState } from "react";
```

Replace the left sidebar header section (the `<div className="sticky...">` block) with:

```tsx
<div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
  <h1 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
    论文大纲
  </h1>
  <div className="relative">
    <button
      onClick={() => setShowExport(!showExport)}
      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
    >
      导出
    </button>
    {showExport && (
      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg z-20 py-1 min-w-[140px]">
        <a
          href={`/api/export/docx?projectId=${PROJECT_ID}`}
          className="block px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Word (.docx)
        </a>
        <a
          href={`/export?projectId=${PROJECT_ID}`}
          target="_blank"
          className="block px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          打印 PDF
        </a>
      </div>
    )}
  </div>
</div>
```

Also add state at the top of the Home component (after existing hooks):
```tsx
const [showExport, setShowExport] = useState(false);
```

**Verify:**
```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 7: End-to-End Test

- Start dev server
- Open the page, click "导出" → "Word (.docx)" → verify .docx file downloads
- Click "导出" → "打印 PDF" → verify clean HTML page with "打印为 PDF" button
- Test with real content from seed data

---

### Task 8: Commit

```bash
cd d:\thesis-outline && git add -A && git commit -m "feat: add document export engine with .docx and PDF support"
```
