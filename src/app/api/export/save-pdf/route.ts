import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import { writeFileSync } from "fs";
import { join } from "path";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
        pageMargins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
        lineSpacing: 2,
        headingStyles: {},
        bodyFont: { family: "Times New Roman", size: 12 },
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

  // Build HTML content
  const sectionsHtml = docData.sections.map(renderSectionHtml).join("\n");

  const refsHtml = docData.references.length > 0
    ? `<h2>参考文献</h2>\n${docData.references.map(r => `<p class="ref-entry">${r.text}</p>`).join("\n")}`
    : "";

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${docData.title}</title>
<style>
@page { size: A4; margin: 25.4mm; }
body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2; color: #000; }
h1 { font-size: 12pt; font-weight: bold; text-align: center; margin-top: 18pt; }
h2 { font-size: 12pt; font-weight: bold; text-align: left; margin-top: 14pt; }
h3 { font-size: 12pt; font-weight: bold; font-style: italic; text-align: left; margin-top: 12pt; }
h4 { font-size: 12pt; font-weight: bold; }
p { text-indent: 12.7mm; margin: 0; }
ul { text-indent: 12.7mm; margin: 0; padding-left: 24mm; }
ul li { list-style-type: disc; }
.title { font-size: 12pt; font-weight: bold; text-align: center; text-indent: 0; margin-bottom: 12pt; margin-top: 60pt; }
.subtitle { font-size: 12pt; text-align: center; text-indent: 0; margin-bottom: 24pt; }
.ref-entry { padding-left: 12.7mm; text-indent: -12.7mm; margin: 0; font-size: 12pt; }
@media print {
  body { margin: 0; padding: 0; }
}
</style>
</head>
<body>
<div class="title">${docData.title}</div>
${docData.subtitle ? `<div class="subtitle">${docData.subtitle}</div>` : ""}
${sectionsHtml}
${refsHtml}
</body>
</html>`;

  try {
    const desktop = join(process.env.USERPROFILE || process.env.HOME || "", "Desktop");
    const safeName = docData.title.replace(/[\\/:*?"<>|]/g, "_");
    writeFileSync(join(desktop, `${safeName}.html`), html, "utf-8");
    return NextResponse.json({ success: true, path: join(desktop, `${safeName}.html`) });
  } catch {
    return NextResponse.json({ error: "无法保存到桌面" }, { status: 500 });
  }
}

function renderSectionHtml(section: any): string {
  let result = "";
  const hLevel = Math.min(section.level, 4);
  result += `<h${hLevel}>${section.title}</h${hLevel}>\n`;

  for (const seg of section.segments) {
    switch (seg.type) {
      case "heading": {
        const lvl = Math.min((seg.level ?? 1) + 1, 4);
        const text = seg.content?.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("") ?? "";
        result += `<h${lvl}>${text}</h${lvl}>\n`;
        break;
      }
      case "paragraph": {
        const text = seg.content?.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("") ?? "";
        result += `<p>${text}</p>\n`;
        break;
      }
      case "list": {
        const items = seg.items?.map((item: any[]) => `<li>${item.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("")}</li>`).join("") ?? "";
        result += `<ul>${items}</ul>\n`;
        break;
      }
    }
  }

  for (const child of section.children) {
    result += renderSectionHtml(child);
  }

  return result;
}
