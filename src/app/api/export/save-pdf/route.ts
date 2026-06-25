import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOutlineTree } from "@/app/actions/outline";
import { buildTree } from "@/lib/outline-utils";
import { buildDocument, type FormatConfig, type CitationConfig } from "@/lib/document-builder";
import { writeFileSync } from "fs";
import { join } from "path";

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

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.userId && project.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const nodes = await getOutlineTree(projectId);
  const tree = buildTree(nodes as any);

  const formatRule = await prisma.formatRule.findUnique({ where: { projectId } });
  const formatConfig: FormatConfig = formatRule
    ? { pageMargins: JSON.parse(formatRule.pageMargins), lineSpacing: formatRule.lineSpacing, headingStyles: JSON.parse(formatRule.headingStyles), bodyFont: JSON.parse(formatRule.bodyFont), headerFooter: JSON.parse(formatRule.headerFooter) }
    : { pageMargins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 }, lineSpacing: 2, headingStyles: {}, bodyFont: { family: "Times New Roman", size: 12 }, headerFooter: {} };

  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: { projectId, isActive: true, citationStyle: { name: project.lang === "zh" ? { in: ["GB/T 7714"] } : { notIn: ["GB/T 7714"] } } },
    include: { citationStyle: true },
  });
  const citationConfig: CitationConfig = activeStyle?.citationStyle
    ? { formatType: activeStyle.citationStyle.formatType as CitationConfig["formatType"], template: JSON.parse(activeStyle.citationStyle.template), styleName: activeStyle.citationStyle.name }
    : { formatType: "numeric", template: {} };

  const docData = buildDocument(project, tree, formatConfig, citationConfig);
  const tp: Record<string, string> = project.titlePage ? (() => { try { return JSON.parse(project.titlePage); } catch { return {}; } })() : {};

  // Build HTML
  const titleFields = [tp.authorName, tp.institution, tp.course, tp.instructor, tp.date].filter(Boolean)
    .map(f => `<p class="tp-field">${f}</p>`).join("\n");

  const kwHtml = project.keywords
    ? `<p class="keywords"><em><strong>${project.lang === "en" ? "Keywords" : "关键词"}</strong></em>: ${project.keywords}</p>`
    : "";

  const sectionsHtml = docData.sections.map(renderSectionHtml).join("\n");

  const refsHtml = docData.references.length > 0
    ? `<div style="page-break-before:always;"></div><h2 class="ref-heading">${project.lang === "en" ? "References" : "参考文献"}</h2>\n${docData.references.map(r => `<p class="ref-entry">${r.text}</p>`).join("\n")}`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${project.lang}">
<head><meta charset="utf-8"><title>${docData.title}</title>
<style>
@page { size: A4; margin: 25.4mm; }
body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2; color: #000; margin: 0; }
h1 { font-size: 12pt; font-weight: bold; text-align: center; margin: 14pt 0 6pt 0; }
h2 { font-size: 12pt; font-weight: bold; text-align: left; margin: 14pt 0 6pt 0; }
h3 { font-size: 12pt; font-weight: bold; font-style: italic; text-align: left; margin: 12pt 0 6pt 0; }
h4 { font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt 0; }
p { text-indent: 12.7mm; margin: 0; }
.tp-field { text-align: center; text-indent: 0; }
.title { font-size: 12pt; font-weight: bold; text-align: center; text-indent: 0; margin: 60pt 0 6pt 0; }
.subtitle { font-size: 12pt; text-align: center; text-indent: 0; margin: 0 0 12pt 0; }
.keywords { text-indent: 12.7mm; margin-top: 12pt; }
.ref-heading { text-align: center; font-size: 12pt; font-weight: bold; }
.ref-entry { padding-left: 12.7mm; text-indent: -12.7mm; margin: 0; }
</style></head>
<body>
<div class="title">${titleCase(docData.title)}</div>
${docData.subtitle ? `<div class="subtitle">${titleCase(docData.subtitle)}</div>` : ""}
${titleFields}
<div style="height:12pt;"></div>
${kwHtml}
${sectionsHtml}
${refsHtml}
</body></html>`;

  try {
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.launch({
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "25.4mm", bottom: "25.4mm", left: "25.4mm", right: "25.4mm" },
      printBackground: true,
    });
    await browser.close();

    const desktop = join(process.env.USERPROFILE || process.env.HOME || "", "Desktop");
    const safeName = docData.title.replace(/[\\/:*?"<>|]/g, "_");
    writeFileSync(join(desktop, `${safeName}.pdf`), pdf);

    return NextResponse.json({ success: true, path: join(desktop, `${safeName}.pdf`) });
  } catch (err) {
    return NextResponse.json({ error: `PDF生成失败: ${err instanceof Error ? err.message : "未知错误"}` }, { status: 500 });
  }
}

function renderSectionHtml(section: any): string {
  let r = "";
  const lvl = Math.min(section.level, 4);
  r += `<h${lvl}>${section.title}</h${lvl}>\n`;
  for (const seg of section.segments) {
    switch (seg.type) {
      case "heading": {
        const hl = Math.min((seg.level ?? 1) + 1, 4);
        const t = seg.content?.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("") ?? "";
        r += `<h${hl}>${t}</h${hl}>\n`;
        break;
      }
      case "paragraph": {
        const t = seg.content?.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("") ?? "";
        r += `<p>${t}</p>\n`;
        break;
      }
      case "list": {
        const items = seg.items?.map((item: any[]) => `<li>${item.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("")}</li>`).join("") ?? "";
        r += `<ul>${items}</ul>\n`;
        break;
      }
    }
  }
  for (const child of section.children) r += renderSectionHtml(child);
  return r;
}
