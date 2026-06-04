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
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import type { ParsedInline } from "@/lib/markdown-parser";

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

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: formatConfig.bodyFont.family,
            size: formatConfig.bodyFont.size * 10,
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
          new Paragraph({
            text: docData.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          ...(docData.subtitle
            ? [
                new Paragraph({
                  text: docData.subtitle,
                  alignment: AlignmentType.CENTER,
                }),
              ]
            : []),
          new Paragraph({ text: "" }),
          ...renderSections(docData.sections),
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

  return new NextResponse(new Uint8Array(buffer), {
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
    const headingLevels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
    };

    result.push(
      new Paragraph({
        text: section.title,
        heading: headingLevels[section.level] ?? HeadingLevel.HEADING_4,
      })
    );

    for (const seg of section.segments) {
      result.push(...renderSegment(seg));
    }

    result.push(...renderSections(section.children));
  }

  return result;
}

function renderSegment(seg: any): Paragraph[] {
  switch (seg.type) {
    case "heading": {
      const levels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
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
