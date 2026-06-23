import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertMillimetersToTwip,
} from "docx";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFileSync } from "fs";
import { join } from "path";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import type { ParsedInline } from "@/lib/markdown-parser";

// APA 7th standard metrics
const APA_MARGIN_MM = 25.4; // 1 inch = 2.54 cm
const APA_INDENT_MM = 12.7; // 0.5 inch = 1.27 cm
const APA_FONT = "Times New Roman";
const APA_SIZE_PT = 12;
const APA_LINE_SPACING = 480; // double spacing in twips

const MARGIN = convertMillimetersToTwip(APA_MARGIN_MM);
const FIRST_INDENT = convertMillimetersToTwip(APA_INDENT_MM);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.userId && project.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isEnglish = project.lang === "en";

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
        pageMargins: { top: APA_MARGIN_MM, bottom: APA_MARGIN_MM, left: APA_MARGIN_MM, right: APA_MARGIN_MM },
        lineSpacing: 2.0,
        headingStyles: {},
        bodyFont: { family: APA_FONT, size: APA_SIZE_PT },
        headerFooter: {},
      };

  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: {
      projectId,
      isActive: true,
      citationStyle: {
        name: project.lang === "zh" ? { in: ["GB/T 7714"] } : { notIn: ["GB/T 7714"] },
      },
    },
    include: { citationStyle: true },
  });
  const citationConfig: CitationConfig = activeStyle?.citationStyle
    ? {
        formatType: activeStyle.citationStyle.formatType as CitationConfig["formatType"],
        template: JSON.parse(activeStyle.citationStyle.template),
        styleName: activeStyle.citationStyle.name,
      }
    : { formatType: "numeric", template: {} };

  const docData = buildDocument(project, tree, formatConfig, citationConfig);

  // Base text run properties (docx uses half-points: 24 = 12pt)
  const baseRun = { font: APA_FONT, size: APA_SIZE_PT * 2 };

  const doc = new Document({
    styles: {
      default: {
        document: { run: baseRun },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children: [
          // ── Title Page ──
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
          // Title — bold, centered
          new Paragraph({
            children: [new TextRun({ text: docData.title, bold: true, ...baseRun })],
            alignment: AlignmentType.CENTER,
            spacing: { line: APA_LINE_SPACING },
          }),
          // Subtitle if present
          ...(docData.subtitle
            ? [new Paragraph({
                text: docData.subtitle,
                alignment: AlignmentType.CENTER,
                spacing: { line: APA_LINE_SPACING },
              })]
            : []),
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
          // Author placeholder
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
          new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),

          // ── Abstract page (if English) / Keywords ──
          ...(project.keywords
            ? [
                new Paragraph({ text: "", spacing: { line: APA_LINE_SPACING } }),
                new Paragraph({
                  children: [new TextRun({ text: isEnglish ? "Keywords" : "关键词", bold: true, italics: true, ...baseRun }),
                    new TextRun({ text: `: ${project.keywords}`, ...baseRun })],
                  spacing: { line: APA_LINE_SPACING },
                  indent: { firstLine: FIRST_INDENT },
                }),
              ]
            : []),

          // ── Body sections ──
          ...renderSections(docData.sections, baseRun),

          // ── References ──
          new Paragraph({
            children: [new TextRun({ text: isEnglish ? "References" : "参考文献", bold: true, ...baseRun })],
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { line: APA_LINE_SPACING, after: 200 },
          }),
          ...docData.references.map(
            (ref) =>
              new Paragraph({
                text: ref.text,
                spacing: { line: APA_LINE_SPACING },
                indent: { left: FIRST_INDENT, hanging: FIRST_INDENT },
              })
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  // Save to Desktop
  try {
    const desktop = join(process.env.USERPROFILE || process.env.HOME || "", "Desktop");
    const safeName = docData.title.replace(/[\\/:*?"<>|]/g, "_");
    writeFileSync(join(desktop, `${safeName}.docx`), Buffer.from(buffer));
  } catch { /* ignore save errors */ }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(docData.title)}.docx"`,
    },
  });
}

// ── Section rendering ──

function renderSections(sections: any[], baseRun: { font: string; size: number }): Paragraph[] {
  const result: Paragraph[] = [];

  for (const section of sections) {
    // Level 1: Centered bold
    // Level 2: Left bold
    // Level 3: Left bold italic
    const isL1 = section.level === 1;
    const isL2 = section.level === 2;
    const isL3 = section.level === 3;

    result.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            italics: isL3,
            ...baseRun,
          }),
        ],
        alignment: isL1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { line: APA_LINE_SPACING, before: 200, after: 100 },
      })
    );

    for (const seg of section.segments) {
      result.push(...renderSegment(seg, baseRun));
    }

    result.push(...renderSections(section.children, baseRun));
  }

  return result;
}

function renderSegment(seg: any, baseRun: { font: string; size: number }): Paragraph[] {
  switch (seg.type) {
    case "heading": {
      const hLevel = (seg.level ?? 1) + 1;
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: seg.content?.map((i: ParsedInline) => i.text).join("") ?? "",
              bold: true,
              italics: hLevel >= 3,
              ...baseRun,
            }),
          ],
          alignment: hLevel <= 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: APA_LINE_SPACING, before: 200, after: 100 },
        }),
      ];
    }
    case "paragraph":
      return [
        new Paragraph({
          children: (seg.content as ParsedInline[]).map(
            (i) =>
              new TextRun({ text: i.text, bold: i.bold, italics: i.italic, ...baseRun })
          ),
          spacing: { line: APA_LINE_SPACING },
          indent: { firstLine: FIRST_INDENT },
        }),
      ];
    case "list":
      return (seg.items as ParsedInline[][]).map(
        (item) =>
          new Paragraph({
            children: [
              new TextRun({ text: "\t•\t", ...baseRun }),
              ...item.map((i) => new TextRun({ text: i.text, bold: i.bold, italics: i.italic, ...baseRun })),
            ],
            spacing: { line: APA_LINE_SPACING },
            indent: { firstLine: FIRST_INDENT },
          })
      );
    default:
      return [];
  }
}
