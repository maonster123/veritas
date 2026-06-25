import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, convertMillimetersToTwip,
} from "docx";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFileSync } from "fs";
import { join } from "path";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import type { ParsedInline } from "@/lib/markdown-parser";

// ── APA 7th constants (all in twips) ──
const MARGIN_TWIPS = 1440;              // 1 inch = 25.4mm
const FIRST_INDENT_TWIPS = 720;         // 0.5 inch = 12.7mm
const HANGING_INDENT_TWIPS = 720;
const LINE_SPACING = 480;               // double spacing (240 = single)
const FONT = "Times New Roman";
const SIZE_HALF_PTS = 24;               // 12pt in half-points

// Title case helper — capitalize all words except prepositions/articles
const MINOR = new Set(["a","an","the","and","but","or","nor","for","so","yet",
  "at","by","in","of","on","to","up","as","is","it","be","am","are","was","were","been",
  "from","with","into","onto","upon","within","without","than","that"]);

function titleCase(t: string): string {
  return t.split(/\s+/).map((w, i, a) => {
    if (i === 0 || i === a.length - 1) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    if (MINOR.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

// Shared run options
const run = { font: FONT, size: SIZE_HALF_PTS, eastAsia: FONT };
const bold = { ...run, bold: true };
const boldItalic = { ...run, bold: true, italics: true };
const italic = { ...run, italics: true };

function lineSpacing(after = 0, before = 0) {
  return { line: LINE_SPACING, lineRule: "auto" as const, after, before };
}

function center(...children: (Paragraph | TextRun)[]) {
  return { alignment: AlignmentType.CENTER, spacing: lineSpacing() };
}

// ── Main Route ──

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.userId && project.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isEnglish = project.lang === "en";
  const nodes = await getOutlineTree(projectId);
  const tree = buildTree(nodes as any);

  const formatRule = await prisma.formatRule.findUnique({ where: { projectId } });
  const formatConfig: FormatConfig = formatRule
    ? { pageMargins: JSON.parse(formatRule.pageMargins), lineSpacing: formatRule.lineSpacing, headingStyles: JSON.parse(formatRule.headingStyles), bodyFont: JSON.parse(formatRule.bodyFont), headerFooter: JSON.parse(formatRule.headerFooter) }
    : { pageMargins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 }, lineSpacing: 2, headingStyles: {}, bodyFont: { family: FONT, size: 12 }, headerFooter: {} };

  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: { projectId, isActive: true, citationStyle: { name: project.lang === "zh" ? { in: ["GB/T 7714"] } : { notIn: ["GB/T 7714"] } } },
    include: { citationStyle: true },
  });
  const citationConfig: CitationConfig = activeStyle?.citationStyle
    ? { formatType: activeStyle.citationStyle.formatType as CitationConfig["formatType"], template: JSON.parse(activeStyle.citationStyle.template), styleName: activeStyle.citationStyle.name }
    : { formatType: "numeric", template: {} };

  const docData = buildDocument(project, tree, formatConfig, citationConfig);

  // Parse title page info
  const tp: Record<string, string> = project.titlePage ? (() => { try { return JSON.parse(project.titlePage); } catch { return {}; } })() : {};

  const children: Paragraph[] = [];

  // ═══ TITLE PAGE ═══
  children.push(new Paragraph({ spacing: lineSpacing() }));
  children.push(new Paragraph({ spacing: lineSpacing() }));
  children.push(new Paragraph({ spacing: lineSpacing() }));

  // Title — bold, centered, title case
  children.push(new Paragraph({
    children: [new TextRun({ text: titleCase(docData.title), ...bold })],
    alignment: AlignmentType.CENTER,
    spacing: lineSpacing(),
  }));

  // Subtitle — centered, not bold, title case
  if (docData.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: titleCase(docData.subtitle), ...run })],
      alignment: AlignmentType.CENTER,
      spacing: lineSpacing(),
    }));
  }

  children.push(new Paragraph({ spacing: lineSpacing() }));

  // Title page fields — centered
  const titleFields = [tp.authorName, tp.institution, tp.course, tp.instructor, tp.date].filter(Boolean);
  for (const field of titleFields) {
    children.push(new Paragraph({
      children: [new TextRun({ text: field!, ...run })],
      alignment: AlignmentType.CENTER,
      spacing: lineSpacing(),
    }));
  }

  children.push(new Paragraph({ spacing: lineSpacing() }));

  // Keywords — bold italic label, first-line indent
  if (project.keywords) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: isEnglish ? "Keywords" : "关键词", ...boldItalic }),
        new TextRun({ text: `: ${project.keywords}`, ...run }),
      ],
      spacing: lineSpacing(),
      indent: { firstLine: FIRST_INDENT_TWIPS },
    }));
    children.push(new Paragraph({ spacing: lineSpacing() }));
  }

  // ═══ BODY ═══
  for (const section of docData.sections) {
    children.push(...renderSection(section));
  }

  // ═══ REFERENCES (new page) ═══
  children.push(new Paragraph({
    children: [new TextRun({ text: isEnglish ? "References" : "参考文献", ...bold })],
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, after: 200, lineRule: "auto" as const },
    pageBreakBefore: true,
  }));

  for (const ref of docData.references) {
    children.push(new Paragraph({
      text: ref.text,
      spacing: lineSpacing(),
      indent: { left: HANGING_INDENT_TWIPS, hanging: HANGING_INDENT_TWIPS },
    }));
  }

  // Assemble document
  const doc = new Document({
    styles: { default: { document: { run } } },
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);

  // Save to Desktop
  try {
    const desktop = join(process.env.USERPROFILE || process.env.HOME || "", "Desktop");
    const safeName = docData.title.replace(/[\\/:*?"<>|]/g, "_");
    writeFileSync(join(desktop, `${safeName}.docx`), Buffer.from(buffer));
  } catch { /* ignore */ }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(docData.title)}.docx"`,
    },
  });
}

// ── Section rendering ──

function renderSection(section: any): Paragraph[] {
  const result: Paragraph[] = [];
  const level = section.level;

  // APA heading styles by level
  const headingStyle = level === 1
    ? { alignment: AlignmentType.CENTER as typeof AlignmentType.CENTER, spacing: { line: LINE_SPACING, before: 200, after: 100, lineRule: "auto" as const } }
    : level === 2
    ? { spacing: { line: LINE_SPACING, before: 200, after: 100, lineRule: "auto" as const } }
    : level === 3
    ? { spacing: { line: LINE_SPACING, before: 200, after: 100, lineRule: "auto" as const } }
    : { spacing: lineSpacing() };

  const headingRun = level === 1 ? bold : level === 3 ? boldItalic : bold;

  result.push(new Paragraph({
    children: [new TextRun({ text: titleCase(section.title), ...headingRun })],
    ...headingStyle,
  }));

  for (const seg of section.segments) {
    result.push(...renderSegment(seg));
  }

  for (const child of section.children) {
    result.push(...renderSection(child));
  }

  return result;
}

function renderSegment(seg: any): Paragraph[] {
  switch (seg.type) {
    case "heading": {
      const level = Math.min((seg.level ?? 1) + 1, 4);
      const hRun = level <= 2 ? bold : boldItalic;
      const hAlign = level <= 1 ? AlignmentType.CENTER : undefined;
      return [new Paragraph({
        children: [new TextRun({ text: seg.content?.map((i: ParsedInline) => i.text).join("") ?? "", ...hRun })],
        alignment: hAlign,
        spacing: { line: LINE_SPACING, before: 200, after: 100, lineRule: "auto" as const },
      })];
    }
    case "paragraph":
      return [new Paragraph({
        children: (seg.content as ParsedInline[]).map((i) =>
          new TextRun({ text: i.text, bold: i.bold, italics: i.italic, ...run })
        ),
        spacing: lineSpacing(),
        indent: { firstLine: FIRST_INDENT_TWIPS },
      })];
    case "list":
      return (seg.items as ParsedInline[][]).map((item) =>
        new Paragraph({
          children: [
            new TextRun({ text: "\t•\t", ...run }),
            ...item.map((i) => new TextRun({ text: i.text, bold: i.bold, italics: i.italic, ...run })),
          ],
          spacing: lineSpacing(),
          indent: { firstLine: FIRST_INDENT_TWIPS },
        })
      );
    default:
      return [];
  }
}
