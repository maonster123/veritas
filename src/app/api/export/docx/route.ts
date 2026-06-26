import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun,
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

// ── Title case ──
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

// ── Format profiles ──

interface FormatProfile {
  font: string;
  eastAsiaFont: string;       // CJK fallback
  headingFont: string;
  sizePt: number;             // body font size in points
  sizeHalfPts: number;        // docx half-points
  lineSpacing: number;        // twips
  marginMm: { top: number; bottom: number; left: number; right: number };
  indentFirstMm: number;      // first-line indent (0 = none)
  titlePageSpacer: number;    // extra empty paragraphs before title
  titleBold: boolean;
  titleSizeHalfPts: number;   // title font size
  headingsCentered: boolean;
  headingsBold: boolean;
  refsNewPage: boolean;
  labelStyle: string;         // citation style name
}

const PROFILES: Record<string, FormatProfile> = {
  "APA 7th": {
    font: "Times New Roman", eastAsiaFont: "Times New Roman", headingFont: "Times New Roman",
    sizePt: 12, sizeHalfPts: 24, lineSpacing: 480,
    marginMm: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    indentFirstMm: 12.7, titlePageSpacer: 3, titleBold: true, titleSizeHalfPts: 24,
    headingsCentered: true, headingsBold: true, refsNewPage: true,
    labelStyle: "APA 7th",
  },
  "MLA 9th": {
    font: "Times New Roman", eastAsiaFont: "Times New Roman", headingFont: "Times New Roman",
    sizePt: 12, sizeHalfPts: 24, lineSpacing: 480,
    marginMm: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    indentFirstMm: 12.7, titlePageSpacer: 0, titleBold: false, titleSizeHalfPts: 24,
    headingsCentered: false, headingsBold: false, refsNewPage: true,
    labelStyle: "MLA 9th",
  },
  "IEEE": {
    font: "Times New Roman", eastAsiaFont: "Times New Roman", headingFont: "Times New Roman",
    sizePt: 10, sizeHalfPts: 20, lineSpacing: 240,
    marginMm: { top: 17.8, bottom: 17.8, left: 17.8, right: 17.8 },
    indentFirstMm: 0, titlePageSpacer: 2, titleBold: true, titleSizeHalfPts: 40, // 20pt
    headingsCentered: true, headingsBold: true, refsNewPage: false,
    labelStyle: "IEEE",
  },
  "NLM": { font: "Times New Roman", eastAsiaFont: "Times New Roman", headingFont: "Times New Roman", sizePt: 12, sizeHalfPts: 24, lineSpacing: 480, marginMm: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 }, indentFirstMm: 12.7, titlePageSpacer: 2, titleBold: true, titleSizeHalfPts: 24, headingsCentered: true, headingsBold: true, refsNewPage: true, labelStyle: "NLM" },
  "GB/T 7714": {
    font: "SimSun", eastAsiaFont: "SimSun", headingFont: "SimHei",
    sizePt: 12, sizeHalfPts: 24, lineSpacing: 360,
    marginMm: { top: 25, bottom: 25, left: 30, right: 25 },
    indentFirstMm: 7.4, titlePageSpacer: 3, titleBold: true, titleSizeHalfPts: 32, // 16pt (三号)
    headingsCentered: true, headingsBold: true, refsNewPage: false,
    labelStyle: "GB/T 7714",
  },
};

function getProfile(citationName: string, lang: string): FormatProfile {
  // Try exact match first
  if (PROFILES[citationName]) return PROFILES[citationName];
  // Fallback based on language
  return lang === "zh" ? PROFILES["GB/T 7714"] : PROFILES["APA 7th"];
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

  // Get active citation style name
  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: { projectId, isActive: true },
    include: { citationStyle: { select: { name: true, formatType: true, template: true } } },
  });

  const citationName = activeStyle?.citationStyle?.name ?? (isEnglish ? "APA 7th" : "GB/T 7714");
  const pf = getProfile(citationName, project.lang);

  const formatRule = await prisma.formatRule.findUnique({ where: { projectId } });
  const formatConfig: FormatConfig = formatRule
    ? { pageMargins: JSON.parse(formatRule.pageMargins), lineSpacing: formatRule.lineSpacing, headingStyles: JSON.parse(formatRule.headingStyles), bodyFont: JSON.parse(formatRule.bodyFont), headerFooter: JSON.parse(formatRule.headerFooter) }
    : { pageMargins: pf.marginMm, lineSpacing: pf.lineSpacing / 240, headingStyles: {}, bodyFont: { family: pf.font, size: pf.sizePt }, headerFooter: {} };

  const citationConfig: CitationConfig = activeStyle?.citationStyle
    ? { formatType: activeStyle.citationStyle.formatType as CitationConfig["formatType"], template: JSON.parse(activeStyle.citationStyle.template), styleName: activeStyle.citationStyle.name }
    : { formatType: "numeric", template: {} };

  const docData = buildDocument(project, tree, formatConfig, citationConfig);
  const tp: Record<string, string> = project.titlePage ? (() => { try { return JSON.parse(project.titlePage); } catch { return {}; } })() : {};

  // Computed values from profile
  const marginTwips = convertMillimetersToTwip(pf.marginMm.top);
  const indentTwips = pf.indentFirstMm > 0 ? convertMillimetersToTwip(pf.indentFirstMm) : 0;
  const isChinese = pf.font === "SimSun";

  // Run options — body vs heading fonts differ for GB/T 7714
  const bodyRun = { font: pf.font, size: pf.sizeHalfPts, eastAsia: pf.eastAsiaFont };
  const headingRun = { font: pf.headingFont, size: pf.sizeHalfPts, eastAsia: pf.eastAsiaFont };
  const titleRun = { font: pf.headingFont, size: pf.titleSizeHalfPts, eastAsia: pf.eastAsiaFont };

  const refLabel = isEnglish
    ? (citationName === "MLA 9th" ? "Works Cited" : "References")
    : "参考文献";

  const children: Paragraph[] = [];

  // ═══ MLA: header block at top, left-aligned ═══
  if (citationName === "MLA 9th") {
    const mlaFields = [tp.authorName, tp.instructor, tp.course, tp.date].filter(Boolean);
    for (const f of mlaFields) {
      children.push(new Paragraph({
        children: [new TextRun({ text: f!, ...bodyRun })],
        spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
      }));
    }
    // Blank line before title
    children.push(new Paragraph({ spacing: { line: pf.lineSpacing, lineRule: "auto" as const } }));
  }

  // ═══ TITLE PAGE (non-MLA) ═══
  if (citationName !== "MLA 9th" && pf.titlePageSpacer > 0) {
    for (let i = 0; i < pf.titlePageSpacer; i++) {
      children.push(new Paragraph({ spacing: { line: pf.lineSpacing, lineRule: "auto" as const } }));
    }
  }

  // Title — centered (MLA: not bold; others: per profile)
  children.push(new Paragraph({
    children: [new TextRun({ text: isEnglish ? titleCase(docData.title) : docData.title, bold: pf.titleBold, ...titleRun })],
    alignment: citationName === "MLA 9th" ? AlignmentType.CENTER : AlignmentType.CENTER,
    spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
  }));

  // Subtitle
  if (docData.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: isEnglish ? titleCase(docData.subtitle) : docData.subtitle, ...bodyRun })],
      alignment: AlignmentType.CENTER,
      spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
    }));
  }

  // Title page info (non-MLA: centered author/institution/etc)
  if (citationName !== "MLA 9th") {
    children.push(new Paragraph({ spacing: { line: pf.lineSpacing, lineRule: "auto" as const } }));
    const fields = [tp.authorName, tp.institution, tp.course, tp.instructor, tp.date].filter(Boolean);
    for (const f of fields) {
      children.push(new Paragraph({
        children: [new TextRun({ text: f!, ...bodyRun })],
        alignment: AlignmentType.CENTER,
        spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
      }));
    }
  }

  children.push(new Paragraph({ spacing: { line: pf.lineSpacing, lineRule: "auto" as const } }));

  // Keywords (skip for MLA)
  if (project.keywords && citationName !== "MLA 9th") {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: isEnglish ? "Keywords" : "关键词", bold: true, italics: true, ...bodyRun }),
        new TextRun({ text: `: ${project.keywords}`, ...bodyRun }),
      ],
      spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
      indent: indentTwips > 0 ? { firstLine: indentTwips } : undefined,
    }));
    children.push(new Paragraph({ spacing: { line: pf.lineSpacing, lineRule: "auto" as const } }));
  }

  // ═══ BODY ═══
  for (const section of docData.sections) {
    children.push(...renderSection(section, pf, bodyRun, headingRun, indentTwips));
  }

  // ═══ REFERENCES ═══
  const sortedRefs = [...docData.references].sort((a, b) =>
    a.text.localeCompare(b.text, "en", { sensitivity: "base" })
  );

  if (sortedRefs.length > 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: refLabel, bold: citationName !== "MLA 9th", ...headingRun })],
      alignment: AlignmentType.CENTER,
      spacing: { line: pf.lineSpacing, lineRule: "auto" as const, after: 200 },
      pageBreakBefore: pf.refsNewPage ? true : undefined,
    }));

    const hangIndent = convertMillimetersToTwip(12.7);
    for (const ref of sortedRefs) {
      children.push(new Paragraph({
        text: ref.text,
        spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
        indent: { left: hangIndent, hanging: hangIndent },
      }));
    }
  }

  // Assemble
  const doc = new Document({
    styles: { default: { document: { run: bodyRun } } },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(pf.marginMm.top),
            bottom: convertMillimetersToTwip(pf.marginMm.bottom),
            left: convertMillimetersToTwip(pf.marginMm.left),
            right: convertMillimetersToTwip(pf.marginMm.right),
          },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);

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

function renderSection(section: any, pf: FormatProfile, bodyRun: any, headingRun: any, indentTwips: number): Paragraph[] {
  const result: Paragraph[] = [];
  const isEnglish = pf.font !== "SimSun";
  const title = isEnglish ? titleCase(section.title) : section.title;

  result.push(new Paragraph({
    children: [new TextRun({ text: title, bold: pf.headingsBold, italics: section.level >= 3, ...headingRun })],
    alignment: pf.headingsCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { line: pf.lineSpacing, lineRule: "auto" as const, before: 200, after: 100 },
  }));

  for (const seg of section.segments) {
    result.push(...renderSegment(seg, pf, bodyRun, headingRun, indentTwips));
  }
  for (const child of section.children) {
    result.push(...renderSection(child, pf, bodyRun, headingRun, indentTwips));
  }
  return result;
}

function renderSegment(seg: any, pf: FormatProfile, bodyRun: any, headingRun: any, indentTwips: number): Paragraph[] {
  switch (seg.type) {
    case "heading": {
      const title = seg.content?.map((i: ParsedInline) => i.text).join("") ?? "";
      return [new Paragraph({
        children: [new TextRun({ text: pf.font !== "SimSun" ? titleCase(title) : title, bold: pf.headingsBold, ...headingRun })],
        alignment: pf.headingsCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { line: pf.lineSpacing, lineRule: "auto" as const, before: 200, after: 100 },
      })];
    }
    case "paragraph":
      return [new Paragraph({
        children: (seg.content as ParsedInline[]).map((i) =>
          new TextRun({ text: i.text, bold: i.bold, italics: i.italic, ...bodyRun })
        ),
        spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
        indent: indentTwips > 0 ? { firstLine: indentTwips } : undefined,
      })];
    case "list":
      return (seg.items as ParsedInline[][]).map((item) =>
        new Paragraph({
          children: [
            new TextRun({ text: "\t•\t", ...bodyRun }),
            ...item.map((i) => new TextRun({ text: i.text, bold: i.bold, italics: i.italic, ...bodyRun })),
          ],
          spacing: { line: pf.lineSpacing, lineRule: "auto" as const },
          indent: indentTwips > 0 ? { firstLine: indentTwips } : undefined,
        })
      );
    default: return [];
  }
}
