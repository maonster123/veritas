"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDOI } from "@/lib/doi-resolver";
import { formatReferenceEntry } from "@/lib/citation-formatter";

// ── AI Content Generation (no citations, logic-focused) ──

export async function generateAIContent(nodeId: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) {
      return { success: false, error: "MISSING_KEY" };
    }

    const node = await prisma.outlineNode.findUnique({
      where: { id: nodeId },
      include: {
        project: { select: { userId: true, title: true, subtitle: true, lang: true } },
        parent: { select: { title: true } },
      },
    });
    if (!node) return { success: false, error: "节点不存在" };
    if (node.project.userId !== session.user.id) return { success: false, error: "无权操作" };

    const isEnglish = node.project.lang === "en";
    const thesisTitle = node.project.title + (node.project.subtitle ? ` — ${node.project.subtitle}` : "");
    const chapter = node.parent?.title ?? "";
    const typeLabelEn = node.type === "chapter" ? "Chapter" : node.type === "section" ? "Section" : node.type === "subsection" ? "Subsection" : "Paragraph";
    const typeLabelZh = node.type === "chapter" ? "章" : node.type === "section" ? "节" : "小节";

    const systemPrompt = isEnglish
      ? `You are a senior academic writing advisor. Thesis: "${thesisTitle}".

CORE MISSION: Write logically coherent, evidence-based academic prose WITHOUT citing any references. Focus on reasoning, argumentation, and conceptual clarity — not on literature review.

RULES:
1. NO CITATIONS: Do not cite any papers, authors, studies, or references. Do not use markers like [1], (Author, 2020), or "According to...". Write as if you are presenting your own analysis.
2. LOGICAL STRUCTURE: Each paragraph should make a clear point, supported by reasoning rather than external citations. Use deductive logic, analogies, theoretical frameworks, and conceptual arguments.
3. SCIENTIFIC ACCURACY: Every factual claim must be precise and verifiable. Use exact terminology. "Mean age was 45.2 years (SD = 12.7)" NOT "average age was around 45".
4. LANGUAGE QUALITY: Native-level academic English. No garbled sentences, no invented words. Proofread before output.
5. TERMINOLOGY: Use established disciplinary terms. Define acronyms on first use.
6. NO FILLER: Cut "it is worth noting", "interestingly", "in other words". One clear sentence > three hedging ones.
7. VARY SENTENCE STRUCTURE: Alternate short and long sentences.

After each paragraph, provide an ACCURATE Chinese translation marked "【中文】" on its own line. CRITICAL: translate ALL technical terms fully — "average" → "平均", "mean" → "均值", "standard deviation" → "标准差", never abbreviate.`
      : `你是学术论文写作导师。论文题目：「${thesisTitle}」。

核心任务：撰写逻辑清晰、有理有据的学术内容，不引用任何文献。聚焦推理、论证和概念分析。

规则：
1. 不引用任何文献：不提及任何论文、作者、研究。不写 [1]、(张三, 2020)、"根据..."等引用标记。像呈现自己的分析一样写作。
2. 逻辑结构：每段有明确论点，用推理支撑而非外部引用。运用演绎逻辑、类比、理论框架和概念论证。
3. 科学准确：事实性陈述精确可验证。使用确切术语。
4. 语言质量：专业学术中文，表述流畅，不啰嗦。
5. 术语规范：使用学科标准术语，首次出现时定义缩写。
6. 不废话：直接进入主题，一句话说清楚。
7. 句式多样：长短句交替。`;

    const userPrompt = isEnglish
      ? `Write approximately 200-400 words of rigorous academic content for "${node.title}" (section: ${chapter}, type: ${typeLabelEn}). Focus on logical argumentation and conceptual analysis — do NOT cite any references. After each paragraph, add a Chinese translation on the next line starting with "【中文】".`
      : `请为「${node.title}」（所属：${chapter}，类型：${typeLabelZh}）撰写约200-400字的学术内容，注重逻辑论证和概念分析，不要引用任何文献。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { success: false, error: `API 错误 ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: "AI 返回为空" };

    await prisma.outlineNode.update({
      where: { id: nodeId },
      data: { aiContent: content },
    });

    return { success: true, content };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "请求超时" };
    }
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

// ── Resource / Website Recommendation ──

interface ResourceItem {
  name: string;
  url: string;
  description: string;
  needsVpn: boolean;
  citation: string;
}

export async function recommendResources(
  nodeId: string
): Promise<{ success: boolean; resources?: ResourceItem[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) {
      return { success: false, error: "MISSING_KEY" };
    }

    const node = await prisma.outlineNode.findUnique({
      where: { id: nodeId },
      include: {
        project: {
          select: {
            userId: true, title: true, subtitle: true, lang: true,
            citationStyles: {
              where: { isActive: true },
              include: { citationStyle: { select: { name: true } } },
            },
          },
        },
        parent: { select: { title: true } },
      },
    });
    if (!node) return { success: false, error: "节点不存在" };
    if (node.project.userId !== session.user.id) return { success: false, error: "无权操作" };

    const isEnglish = node.project.lang === "en";
    const thesisTitle = node.project.title + (node.project.subtitle ? ` — ${node.project.subtitle}` : "");
    const chapter = node.parent?.title ?? "";

    // Determine citation format
    const activeStyle = node.project.citationStyles[0]?.citationStyle;
    const citationFormat = activeStyle?.name ?? (isEnglish ? "APA 7th" : "GB/T 7714");

    const citationRule = isEnglish
      ? `IMPORTANT: For each resource, also generate a properly formatted citation in ${citationFormat} format. Include the citation as a "citation" field. For websites: use "Author/Organization. (Year). Title. Site Name. URL" or the ${citationFormat}-specific equivalent. If year is unknown, use "n.d.".`
      : `重要：为每个资源生成符合 ${citationFormat} 格式的规范引用，放在 "citation" 字段中。`;

    const systemPrompt = isEnglish
      ? `You are an academic research assistant. Recommend 3-5 real academic resources relevant to the user's research topic.

CRITICAL URL RULES:
1. ONLY generate search URLs on major platforms — NEVER guess specific article/journal/file URLs.
2. For each resource, use the platform's search URL with the user's topic as query.
3. Valid platforms and their URL patterns:
   - Google Scholar: https://scholar.google.com/scholar?q=KEYWORDS
   - PubMed: https://pubmed.ncbi.nlm.nih.gov/?term=KEYWORDS
   - arXiv: https://arxiv.org/search/?query=KEYWORDS&searchtype=all
   - CNKI: https://kns.cnki.net/kns8s/search?classid=VDNJYZVH&kw=KEYWORDS
   - Wanfang: https://s.wanfangdata.com.cn/paper?q=KEYWORDS
   - Web of Science: https://www.webofscience.com/wos/woscc/basic-search (then user searches manually)
   - Scopus: https://www.scopus.com/search/form.uri?display=basic (then user searches manually)
   - Google Books: https://books.google.com/books?q=KEYWORDS
   - ScienceDirect: https://www.sciencedirect.com/search?qs=KEYWORDS
   - JSTOR: https://www.jstor.org/action/doBasicSearch?Query=KEYWORDS
   - APA PsycINFO: https://www.apa.org/pubs/databases/psycinfo (resource homepage)
4. NEVER invent any URL not on this list. If unsure, use Google Scholar.
5. For each resource provide: name, URL, 1-sentence description on why it's relevant, VPN requirement, and citation.
6. VPN: Google Scholar/Google Books → true. CNKI/Wanfang/PubMed/arXiv → false.

Return ONLY JSON array:
[{"name":"...","url":"https://...","description":"...","needsVpn":true/false,"citation":"..."}]`
      : `你是学术研究助手。推荐 3-5 个真实学术资源。

网址规则（极其重要）：
1. 只能使用大平台的搜索链接，绝不猜测具体论文/期刊/文件链接。
2. 每个资源用平台搜索URL + 用户关键词。
3. 可用平台及URL格式：
   - 知网：https://kns.cnki.net/kns8s/search?classid=VDNJYZVH&kw=关键词
   - 万方：https://s.wanfangdata.com.cn/paper?q=关键词
   - 百度学术：https://xueshu.baidu.com/s?wd=关键词
   - Google Scholar：https://scholar.google.com/scholar?q=关键词
   - PubMed：https://pubmed.ncbi.nlm.nih.gov/?term=关键词
   - arXiv：https://arxiv.org/search/?query=关键词
   - 维普：http://www.cqvip.com/QK/Search.aspx?key=关键词
   - ScienceDirect：https://www.sciencedirect.com/search?qs=关键词
4. 绝不编造不在列表中的网址。不确定就用百度学术或Google Scholar。
5. 每个资源提供：名称、URL、一句话描述、VPN需求、规范引用。
6. VPN：Google Scholar/Google Books → true。知网/万方/维普/百度学术/PubMed/arXiv → false。

只返回JSON数组：
[{"name":"...","url":"https://...","description":"...","needsVpn":true/false,"citation":"..."}]`;

    const userPrompt = isEnglish
      ? `Thesis: "${thesisTitle}". Section: "${node.title}" (under ${chapter}). Content: ${node.content ? node.content.slice(0, 800) : "(none)"}. Recommend 3-5 academic resources using major platform search URLs with relevant keywords. Return only JSON array.`
      : `论文：「${thesisTitle}」。章节：「${node.title}」（${chapter}）。内容：${node.content ? node.content.slice(0, 800) : "（无）"}。推荐3-5个学术资源，用大平台搜索链接+相关关键词。只返回JSON数组。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { success: false, error: `API 错误 ${res.status}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { success: false, error: "AI 返回为空" };

    // Parse JSON — DeepSeek may wrap it in an object or return a bare array
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { success: false, error: "AI 返回格式异常，请重试" };
    }

    // Handle both { "resources": [...] } and [...] formats
    const resources: ResourceItem[] = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>).resources && Array.isArray((parsed as Record<string, unknown>).resources)
        ? (parsed as Record<string, unknown>).resources as ResourceItem[]
        : [];

    if (resources.length === 0) {
      return { success: false, error: "未找到相关资源推荐" };
    }

    // Validate URLs — filter out dead links
    const valid: ResourceItem[] = [];
    for (const r of resources) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const head = await fetch(r.url, { method: "HEAD", signal: ctrl.signal }).finally(() => clearTimeout(t));
        if (head.ok) valid.push(r);
      } catch {
        // Dead URL — skip it
      }
    }

    if (valid.length === 0) {
      return { success: false, error: "AI 推荐的网址均无法访问，请重试" };
    }

    return { success: true, resources: valid };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "请求超时" };
    }
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

// ── Citation Normalizer ──

export async function normalizeCitation(
  rawText: string,
  targetFormat: string,
  lang: string
): Promise<{ success: boolean; citation?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    // ── Step 1: Try DOI lookup ──
    const doiMatch = rawText.match(/10\.\d{4,}\/[^\s"')\]]+/);
    const doi = doiMatch ? doiMatch[0].replace(/[.,;]+$/, "") : null;

    if (doi) {
      // Resolve DOI to get accurate metadata via CrossRef
      try {
        const resolved = await resolveDOI(doi);

        // Get citation style template from DB
        const style = await prisma.citationStyle.findFirst({
          where: { name: targetFormat },
        });

        if (style && resolved) {
          // IEEE uses abbreviated journal name if available
          const journalName = targetFormat === "IEEE" && resolved.shortJournal
            ? resolved.shortJournal
            : resolved.journal;

          const refData = {
            id: "norm",
            title: resolved.title.replace(/\.+$/, ""),
            authors: JSON.stringify(resolved.authors),
            journal: journalName,
            volume: resolved.volume,
            issue: resolved.issue,
            pages: resolved.pages,
            year: resolved.year,
            publisher: resolved.publisher,
            url: resolved.url ?? doi,
            doi,
          };

          const styleData = {
            name: style.name,
            formatType: style.formatType,
            template: JSON.parse(style.template) as Record<string, string>,
          };

          const citation = formatReferenceEntry(refData, styleData, 1);
          return { success: true, citation };
        }
      } catch {
        // DOI resolve failed — fall through to AI
      }
    }

    // ── Step 2: Fallback to AI ──
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) {
      return { success: false, error: "MISSING_KEY" };
    }

    const isEn = lang === "en";

    const sourceNote = doi
      ? "DOI was found in the text but CrossRef lookup failed. Please format based on available information from the text."
      : "No DOI found. Extract metadata from the text directly.";

    const systemPrompt = isEn
      ? `You are a citation formatting expert. Format the given reference into proper ${targetFormat} style. ${sourceNote} Return ONLY the formatted citation — no explanations.`
      : `你是参考文献格式化专家。将给定文献转换为标准 ${targetFormat} 格式。${sourceNote} 只返回格式化后的引用文本。`;

    const userPrompt = isEn
      ? `Format this reference in ${targetFormat} style:\n\n${rawText}`
      : `请将此文献按 ${targetFormat} 格式规范输出：\n\n${rawText}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return { success: false, error: `API 错误 ${res.status}` };

    const data = await res.json();
    const citation = data.choices?.[0]?.message?.content;
    if (!citation) return { success: false, error: "AI 返回为空" };

    return { success: true, citation: citation.trim() };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "请求超时" };
    }
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

// ── Keyword Generation ──

export async function generateKeywords(
  projectId: string
): Promise<{ success: boolean; keywords?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) return { success: false, error: "MISSING_KEY" };

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true, title: true, lang: true },
    });
    if (!project || project.userId !== session.user.id) return { success: false, error: "无权操作" };

    // Get chapter titles for context
    const chapters = await prisma.outlineNode.findMany({
      where: { projectId, type: "chapter" },
      select: { title: true },
      orderBy: { sortOrder: "asc" },
    });

    const chapterTitles = chapters.map(c => c.title).join(", ");
    const isEn = project.lang === "en";

    const systemPrompt = isEn
      ? `Extract 3-5 keywords from the thesis title and chapter titles. Return ONLY the keywords, separated by commas. No explanations.`
      : `从论文标题和章节标题中提取 3-5 个关键词。只返回用逗号分隔的关键词，不要解释。`;

    const userPrompt = isEn
      ? `Thesis: "${project.title}". Chapters: ${chapterTitles}. Extract 3-5 academic keywords.`
      : `论文标题：「${project.title}」。章节标题：${chapterTitles}。提取 3-5 个学术关键词。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 128,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return { success: false, error: `API 错误 ${res.status}` };
    const data = await res.json();
    const keywords = data.choices?.[0]?.message?.content?.trim();
    if (!keywords) return { success: false, error: "AI 返回为空" };

    // Save to project
    await prisma.project.update({ where: { id: projectId }, data: { keywords } });

    return { success: true, keywords };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { success: false, error: "请求超时" };
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

export async function saveDeepseekKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { deepseekApiKey: apiKey },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "保存失败" };
  }
}
