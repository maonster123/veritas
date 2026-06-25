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

const PROFILES: Record<string, { font: string; sizePt: number; lineH: number; margin: string; indent: string; centerHeadings: boolean; titleBold: boolean; titleSizePt: number; refsNewPage: boolean }> = {
  "APA 7th":  { font: "Times New Roman", sizePt: 12, lineH: 2, margin: "25.4mm", indent: "12.7mm", centerHeadings: true,  titleBold: true,  titleSizePt: 12, refsNewPage: true },
  "MLA 9th":  { font: "Times New Roman", sizePt: 12, lineH: 2, margin: "25.4mm", indent: "12.7mm", centerHeadings: false, titleBold: false, titleSizePt: 12, refsNewPage: true },
  "IEEE":     { font: "Times New Roman", sizePt: 10, lineH: 1.15, margin: "17.8mm", indent: "0", centerHeadings: true,  titleBold: true,  titleSizePt: 20, refsNewPage: false },
  "GB/T 7714": { font: "SimSun", sizePt: 12, lineH: 1.5, margin: "25mm 25mm 25mm 30mm", indent: "7.4mm", centerHeadings: true,  titleBold: true,  titleSizePt: 16, refsNewPage: false },
};

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

  const activeStyle = await prisma.projectCitationStyle.findFirst({
    where: { projectId, isActive: true },
    include: { citationStyle: { select: { name: true, formatType: true, template: true } } },
  });
  const citationName = activeStyle?.citationStyle?.name ?? (isEnglish ? "APA 7th" : "GB/T 7714");
  const pf = PROFILES[citationName] ?? (project.lang === "zh" ? PROFILES["GB/T 7714"] : PROFILES["APA 7th"]);

  const formatRule = await prisma.formatRule.findUnique({ where: { projectId } });
  const formatConfig: FormatConfig = formatRule
    ? { pageMargins: JSON.parse(formatRule.pageMargins), lineSpacing: formatRule.lineSpacing, headingStyles: JSON.parse(formatRule.headingStyles), bodyFont: JSON.parse(formatRule.bodyFont), headerFooter: JSON.parse(formatRule.headerFooter) }
    : { pageMargins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 }, lineSpacing: 2, headingStyles: {}, bodyFont: { family: pf.font, size: pf.sizePt }, headerFooter: {} };

  const citationConfig: CitationConfig = activeStyle?.citationStyle
    ? { formatType: activeStyle.citationStyle.formatType as CitationConfig["formatType"], template: JSON.parse(activeStyle.citationStyle.template), styleName: activeStyle.citationStyle.name }
    : { formatType: "numeric", template: {} };

  const docData = buildDocument(project, tree, formatConfig, citationConfig);
  const tp: Record<string, string> = project.titlePage ? (() => { try { return JSON.parse(project.titlePage); } catch { return {}; } })() : {};

  const isMLAMode = citationName === "MLA 9th";
  const hCenter = pf.centerHeadings ? "text-align:center;" : "text-align:left;";
  const refLabel = isEnglish
    ? (citationName === "MLA 9th" ? "Works Cited" : "References")
    : "参考文献";

  const titleFields = isMLAMode
    ? [tp.authorName, tp.instructor, tp.course, tp.date].filter(Boolean).map(f => `<p class="mla-field">${f}</p>`).join("\n")
    : [tp.authorName, tp.institution, tp.course, tp.instructor, tp.date].filter(Boolean).map(f => `<p class="tp-field">${f}</p>`).join("\n");

  const kwHtml = project.keywords
    ? `<p class="keywords"><em><strong>${isEnglish ? "Keywords" : "关键词"}</strong></em>: ${project.keywords}</p>`
    : "";

  const sectionsHtml = docData.sections.map((s: any) => renderSectionHtml(s, pf, isEnglish)).join("\n");

  const sortedRefs = [...docData.references].sort((a, b) =>
    a.text.localeCompare(b.text, "en", { sensitivity: "base" })
  );
  const refPageBreak = pf.refsNewPage ? ' style="page-break-before:always;"' : "";
  const refsHtml = sortedRefs.length > 0
    ? `<div${refPageBreak}><h2 class="ref-heading">${refLabel}</h2>\n${sortedRefs.map(r => `<p class="ref-entry">${r.text}</p>`).join("\n")}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${project.lang}">
<head><meta charset="utf-8"><title>${docData.title}</title>
<style>
@page { size: A4; margin: ${pf.margin}; }
body { font-family: "${pf.font}", serif; font-size: ${pf.sizePt}pt; line-height: ${pf.lineH}; color: #000; margin: 0; }
h1 { font-size: ${pf.sizePt}pt; font-weight: ${pf.centerHeadings ? "bold" : "normal"}; ${hCenter} margin: 14pt 0 6pt 0; }
h2 { font-size: ${pf.sizePt}pt; font-weight: ${pf.centerHeadings ? "bold" : "normal"}; ${hCenter} margin: 14pt 0 6pt 0; }
h3 { font-size: ${pf.sizePt}pt; font-weight: bold; font-style: italic; ${hCenter} margin: 12pt 0 6pt 0; }
h4 { font-size: ${pf.sizePt}pt; font-weight: bold; ${hCenter} margin: 10pt 0 4pt 0; }
p { text-indent: ${pf.indent}; margin: 0; }
.tp-field { text-align: center; text-indent: 0; }
.mla-field { text-align: left; text-indent: 0; }
.title { font-size: ${pf.titleSizePt}pt; font-weight: ${pf.titleBold ? "bold" : "normal"}; text-align: center; text-indent: 0; margin: 60pt 0 6pt 0; }
.subtitle { font-size: ${pf.sizePt}pt; text-align: center; text-indent: 0; margin: 0 0 12pt 0; }
.keywords { text-indent: ${pf.indent}; margin-top: 12pt; }
.ref-heading { font-size: ${pf.sizePt}pt; font-weight: bold; ${hCenter} }
.ref-entry { padding-left: 12.7mm; text-indent: -12.7mm; margin: 0; }
</style></head>
<body>
<div class="title">${isEnglish ? titleCase(docData.title) : docData.title}</div>
${docData.subtitle ? `<div class="subtitle">${isEnglish ? titleCase(docData.subtitle) : docData.subtitle}</div>` : ""}
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
      headless: true, args: ["--no-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: pf.margin, bottom: pf.margin, left: pf.margin, right: pf.margin },
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

function renderSectionHtml(section: any, pf: any, isEnglish: boolean): string {
  let r = "";
  const lvl = Math.min(section.level, 4);
  const title = isEnglish ? titleCase(section.title) : section.title;
  r += `<h${lvl}>${title}</h${lvl}>\n`;
  for (const seg of section.segments) {
    switch (seg.type) {
      case "heading": {
        const hl = Math.min((seg.level ?? 1) + 1, 4);
        const t = seg.content?.map((i: any) => i.bold ? `<strong>${i.text}</strong>` : i.italic ? `<em>${i.text}</em>` : i.text).join("") ?? "";
        const hTitle = isEnglish ? titleCase(t) : t;
        r += `<h${hl}>${hTitle}</h${hl}>\n`;
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
  for (const child of section.children) r += renderSectionHtml(child, pf, isEnglish);
  return r;
}
