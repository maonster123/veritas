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
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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

    const node = await prisma.outlineNode.findUnique({
      where: { id: nodeId },
      include: {
        project: { select: { userId: true, title: true, lang: true } },
        parent: { select: { title: true } },
      },
    });
    if (!node) return { success: false, error: "节点不存在" };
    if (node.project.userId !== session.user.id) return { success: false, error: "无权操作" };

    const isEnglish = node.project.lang === "en";

    // Build search query from node title + chapter + thesis title
    const searchTerms = [node.title, node.parent?.title ?? "", node.project.title]
      .filter(Boolean).join(" ").replace(/[^a-zA-Z0-9\s-]/g, " ").trim();

    // Search CrossRef for real papers
    const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(searchTerms)}&rows=6&filter=type:journal-article&sort=relevance`;
    const cfRes = await fetch(crossrefUrl, {
      headers: { "User-Agent": "Veritas/1.0 (mailto:dev@localhost)" },
    });

    if (!cfRes.ok) return { success: false, error: "CrossRef 搜索失败" };

    const cfData = await cfRes.json();
    const items = cfData.message?.items ?? [];

    if (items.length === 0) return { success: false, error: "未找到相关文献" };

    const resources: ResourceItem[] = [];

    // For Chinese mode: add domestic search links first
    if (!isEnglish) {
      const zhQuery = encodeURIComponent(searchTerms);
      resources.push({
        name: "中国知网 (CNKI)",
        url: `https://kns.cnki.net/kns8s/search?classid=VDNJYZVH&kw=${zhQuery}`,
        description: "中文学位论文与期刊文章 — 国内可直接访问",
        needsVpn: false,
        citation: "",
      });
      resources.push({
        name: "万方数据",
        url: `https://s.wanfangdata.com.cn/paper?q=${zhQuery}`,
        description: "中文学术论文与会议文献 — 国内可直接访问",
        needsVpn: false,
        citation: "",
      });
      resources.push({
        name: "百度学术",
        url: `https://xueshu.baidu.com/s?wd=${zhQuery}`,
        description: "中文文献综合搜索 — 国内可直接访问",
        needsVpn: false,
        citation: "",
      });
    }

    // CrossRef papers (supplementary)
    const crossRefResources = items.slice(0, isEnglish ? 5 : 2).map((item: any) => {
      const authors = (item.author ?? []).map((a: any) => `${a.family ?? ""} ${a.given ?? ""}`.trim()).join(", ");
      const title = item.title?.[0] ?? "Untitled";
      const journal = item["container-title"]?.[0] ?? "";
      const year = item["published-print"]?.["date-parts"]?.[0]?.[0] ?? item.created?.["date-parts"]?.[0]?.[0] ?? "n.d.";
      const doi = item.DOI ?? "";
      const url = doi ? `https://doi.org/${doi}` : item.URL ?? "";
      const vol = item.volume ?? "";
      const issue = item.issue ?? "";
      const pages = item.page ?? "";

      // Build APA-style citation
      const authorList = (item.author ?? []).slice(0, 5).map((a: any) => {
        const family = a.family ?? "";
        const initials = (a.given ?? "").split(/\s+/).map((w: string) => (w[0] ?? "").toUpperCase() + ".").join(" ");
        return `${family}, ${initials}`;
      });
      const authorStr = authorList.length === 1 ? authorList[0]
        : authorList.length === 2 ? `${authorList[0]}, & ${authorList[1]}`
        : authorList.length > 2 ? `${authorList.slice(0, -1).join(", ")}, & ${authorList[authorList.length - 1]}`
        : "(n.d.)";
      const extraAuthors = (item.author ?? []).length > 5 ? " et al." : "";
      const volIssue = vol ? (issue ? `${vol}(${issue})` : vol) : "";
      const pagesStr = pages || "";
      const yearNum = typeof year === "number" ? year : (parseInt(String(year)) || year);

      const citation = `${authorStr}${extraAuthors} (${yearNum}). ${title}. ${journal}${volIssue || pagesStr ? `, ${[volIssue, pagesStr].filter(Boolean).join(", ")}` : ""}. ${doi ? `https://doi.org/${doi}` : url}`;

      // Most CrossRef papers link to paywalled publisher sites — assume VPN needed
      // Only open-access platforms are freely accessible in China
      const isOpenAccess = /arxiv|pubmed central|pmc|plos|frontiersin|mdpi|hindawi|biomed central/i.test(url + (item.publisher ?? ""));
      const needsVpn = !isOpenAccess;

      return {
        name: title.length > 80 ? title.slice(0, 77) + "..." : title,
        url: url || `https://doi.org/${doi}`,
        description: `${journal} (${year})${authors ? ` — ${authors.split(",")[0]}` : ""}`,
        needsVpn,
        citation,
      };
    });

    // Add CrossRef papers to the list
    resources.push(...crossRefResources);

    // Platform search fallbacks
    const query = encodeURIComponent(searchTerms);
    if (isEnglish) {
      resources.push({
        name: "Google Scholar Search",
        url: `https://scholar.google.com/scholar?q=${query}`,
        description: "Free search across all disciplines — VPN required in China",
        needsVpn: true,
        citation: "",
      });
    }
    resources.push({
      name: isEnglish ? "PubMed Search" : "PubMed 搜索",
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`,
      description: isEnglish ? "Biomedical literature — freely accessible" : "生物医学文献 — 国内可直接访问",
      needsVpn: false,
      citation: "",
    });

    return { success: true, resources };
  } catch (error) {
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

    // ── Step 1: Try DOI lookup (skip for Chinese mode — CNKI/万方 DOIs not on CrossRef) ──
    const doiMatch = rawText.match(/10\.\d{4,}\/[^\s"')\]]+/);
    const doi = (lang !== "zh" && doiMatch) ? doiMatch[0].replace(/[.,;]+$/, "") : null;

    if (doi) {
      // Resolve DOI to get accurate metadata via CrossRef
      try {
        const resolved = await resolveDOI(doi);

        // Get citation style template from DB
        const style = await prisma.citationStyle.findFirst({
          where: { name: targetFormat },
        });

        if (style && resolved) {
          // Use full journal name — abbreviation handled by citation formatter
          const journalName = resolved.journal;

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
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true, title: true, lang: true },
    });
    if (!project || project.userId !== session.user.id) return { success: false, error: "无权操作" };

    // Load all node content for full-text keyword extraction
    const allNodes = await prisma.outlineNode.findMany({
      where: { projectId },
      select: { title: true, type: true, content: true, notes: true },
      orderBy: { sortOrder: "asc" },
    });

    // Build full text summary: title + section headings + content
    const fullText = allNodes.map(n => {
      const parts = [`[${n.type}] ${n.title}`];
      if (n.content) parts.push(n.content.slice(0, 500));
      return parts.join("\n");
    }).join("\n\n");

    // Count total chars and scale keyword count
    const totalChars = fullText.length;
    const keywordCount = totalChars < 1000 ? 4 : totalChars < 3000 ? 6 : totalChars < 8000 ? 8 : 12;

    const isEn = project.lang === "en";

    const systemPrompt = isEn
      ? `You are an academic keyword extraction specialist. Analyze the full text of this thesis and extract ${keywordCount} precise, non-redundant keywords.

CRITICAL RULES:
1. Extract exactly ${keywordCount} keywords.
2. NO synonyms or near-duplicates: pick the most precise term for each concept. "cognitive behavioral therapy" and "CBT" are the same — pick one. "emotion regulation" and "emotional regulation" are the same — pick one.
3. Keywords must be specific academic terms, not generic words like "research", "study", "analysis".
4. ALWAYS include the primary discipline/field as the first keyword (e.g., "psychology", "clinical psychology", "cognitive science").
5. Cover the full scope: methodology terms, theoretical frameworks, key variables, population, and domain-specific concepts.
6. Return ONLY the keywords separated by commas. No numbering, no explanations.`
      : `你是学术关键词提取专家。分析这篇论文的全文，提取 ${keywordCount} 个精准且无重复的关键词。

严格规则：
1. 精确提取 ${keywordCount} 个关键词。
2. 严禁同义词或近义词重复：每个概念只选最精确的一个词。"认知行为疗法"和"CBT"是一回事——只选一个。"情绪调节"和"情感调节"是一回事——只选一个。
3. 关键词必须是具体学术术语，不能是"研究""分析""实验"等泛词。
4. 第一个关键词必须是学科领域名（如"心理学""临床心理学""认知科学"）。
5. 覆盖全文范围：方法论术语、理论框架、关键变量、研究对象、领域特有概念。
6. 只返回逗号分隔的关键词。不要编号，不要解释。`;

    const userPrompt = isEn
      ? `Thesis: "${project.title}".\n\nFull content summary:\n${fullText.slice(0, 6000)}\n\nExtract ${keywordCount} precise, non-redundant academic keywords.`
      : `论文标题：「${project.title}」。\n\n全文内容摘要：\n${fullText.slice(0, 6000)}\n\n提取 ${keywordCount} 个精准且无重复的学术关键词。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 256,
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
