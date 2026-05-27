import React from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import type { ParsedInline } from "@/lib/markdown-parser";
import PrintButton from "@/components/export/PrintButton";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-8 text-red-500">请先登录</div>;
  }

  const { projectId } = await searchParams;
  if (!projectId) {
    return <div className="p-8 text-red-500">Missing projectId parameter</div>;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return <div className="p-8 text-red-500">Project not found</div>;
  }
  if (project.userId && project.userId !== session.user.id) {
    return <div className="p-8 text-red-500">无权访问该项目</div>;
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

  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: { projectId, isActive: true },
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
            max-width: 210mm;
            margin: 0 auto;
            padding: ${formatConfig.pageMargins.top}mm ${formatConfig.pageMargins.right}mm;
          }
          h1 { font-size: ${headingStyle(1).fontSize ?? 16}pt; font-weight: ${headingStyle(1).fontWeight ?? "bold"}; }
          h2 { font-size: ${headingStyle(2).fontSize ?? 14}pt; font-weight: ${headingStyle(2).fontWeight ?? "bold"}; }
          h3 { font-size: ${headingStyle(3).fontSize ?? 12}pt; font-weight: ${headingStyle(3).fontWeight ?? "bold"}; }
          .title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 12pt; }
          .subtitle { text-align: center; font-size: 14pt; margin-bottom: 24pt; }
          .references { margin-top: 24pt; border-top: 1px solid #000; padding-top: 12pt; }
          @media print {
            button { display: none; }
            body { padding: 0; }
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

function renderInline(content: ParsedInline[], keyPrefix: string): React.ReactNode[] {
  return content.map((inline, idx) =>
    inline.bold ? (
      <strong key={`${keyPrefix}-${idx}`}>{inline.text}</strong>
    ) : inline.italic ? (
      <em key={`${keyPrefix}-${idx}`}>{inline.text}</em>
    ) : (
      <span key={`${keyPrefix}-${idx}`}>{inline.text}</span>
    )
  );
}

function renderSection(section: any): React.ReactNode {
  const sectionLevel = Math.min(section.level, 4);
  return (
    <div key={section.nodeId}>
      {React.createElement(`h${sectionLevel}`, null, section.title)}
      {section.segments.map((seg: any, i: number) => {
        switch (seg.type) {
          case "heading": {
            const hLevel = Math.min((seg.level ?? 1) + 1, 4);
            return React.createElement(
              `h${hLevel}`,
              { key: i },
              ...(seg.content ? renderInline(seg.content, `h-${i}`) : [])
            );
          }
          case "paragraph":
            return (
              <p key={i}>
                {seg.content ? renderInline(seg.content, `p-${i}`) : null}
              </p>
            );
          case "list":
            return (
              <ul key={i}>
                {seg.items?.map((item: ParsedInline[], j: number) => (
                  <li key={j}>{item ? renderInline(item, `li-${i}-${j}`) : null}</li>
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
